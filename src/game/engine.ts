import { frequencyForStep, type Sound } from "./audio";
import { birdPerchY, generateCourse, PX_PER_BEAT, PRE_ROLL_BEATS } from "./layout";
import { engrave, type EngravedNote } from "./rhythm";
import { TIMING, timingGrade, timingScore } from "./scoring";
import { WORLD } from "./world";
import type { BirdState, Grade, NoteEvent, Phase, Tier } from "./types";

export type SubdivisionMode = "off" | "8" | "3" | "16";

const SUBDIVISION_STEPS: Record<SubdivisionMode, number> = {
  off: 0,
  "8": 2,
  "3": 3,
  "16": 4,
};

const FIXED_STEP = 1 / 120;
export const RUN_BARS = 8;
/** Let the last note clear the hit window before the result appears. */
const RUN_END_BEAT = PRE_ROLL_BEATS + RUN_BARS * 4 + 1;
const RAMP_EVERY = 8;
const MAX_BPM = 184;
const CLICK_LOOKAHEAD = 0.15;
const POPUP_LIFE = 0.7;
/**
 * The bird hops between notes instead of gliding: it leaves the note it last
 * played, arcs over the staff, and touches down on the next notehead exactly on
 * that note's beat.
 */
const HOP = {
  /** Share of the gap between two notes spent in the air. */
  airShare: 0.6,
  /** Floor and ceiling for the hang time, so fast notes still hop and long gaps do not float. */
  minAirBeats: 0.35,
  maxAirBeats: 1,
  /** Peak of the arc, in px above the two noteheads. */
  lift: 22,
};
/** How far behind the hit line a note may drift before it is counted as missed. */
const LATE_WINDOW = TIMING.ok;
/** Notes longer than an eighth are sustained: press and hold for their value. */
const HOLD_MIN_BEATS = 0.5 + 1e-6;
/** Releasing this much before the end is still a clean release. */
const RELEASE_EARLY = 0.15;
/** A hold that reaches its end and is not released is completed silently. */
const HOLD_COMPLETE_GRACE = 0.15;
const HOLD_BONUS = 25;

export interface Popup {
  text: string;
  kind: Grade | "MISS" | "HELD";
  x: number;
  life: number;
}

export interface GameOptions {
  tier: Tier;
  seed: string;
  sound: Sound;
  /** Metronome tempo the run starts at; defaults to the tier's own tempo. */
  startBpm?: number;
}

/**
 * Timing game, not a flight game: the bird perches above the hit line and hops
 * from note to note, landing on each notehead on its beat. The only input is
 * tapping in time.
 */
export class Game {
  readonly tier: Tier;
  readonly seed: string;

  phase: Phase = "ready";
  beatsElapsed = 0;
  bpm: number;
  bird: BirdState = { y: birdPerchY(4), vy: 0 };
  score = 0;
  combo = 0;
  bestCombo = 0;
  hits = 0;
  misses = 0;
  flash = 0;
  shake = 0;
  /** Step of the note last struck, so the hit ring can flash on that notehead. */
  lastStep = 4;
  popups: Popup[] = [];

  readonly notes: NoteEvent[];
  readonly engraved: EngravedNote[];
  readonly hitIds = new Set<number>();
  readonly missedIds = new Set<number>();

  onEnd?: () => void;

  private readonly sound: Sound;
  private readonly landings: NoteEvent[];
  /** Index into `landings` of the note the bird is hopping toward. */
  private hopTo = 0;
  private accumulator = 0;
  private nextClickBeat = 0;
  private nextRamp = RAMP_EVERY;
  private hold: { endBeat: number } | null = null;
  private spaceDown = false;
  private restPenalized = false;
  private subdivisionSteps = 0;

  constructor({ tier, seed, sound, startBpm }: GameOptions) {
    this.tier = tier;
    this.seed = seed;
    this.sound = sound;
    this.bpm = startBpm ?? tier.startBpm;
    this.notes = generateCourse(tier, seed);
    this.engraved = engrave(this.notes);
    this.landings = this.notes.filter((note) => !note.rest);
  }

  start(): void {
    if (this.phase !== "ready") return;
    this.phase = "running";
    this.beatsElapsed = 0;
    this.accumulator = 0;
    this.nextClickBeat = 0;
    this.bird = { y: birdPerchY(4), vy: 0 };
    this.hopTo = 0;
    this.hold = null;
    this.spaceDown = false;
    this.restPenalized = false;
    this.sound.stopNote();
    this.sound.ensure();
  }

  /**
   * Key or pointer down: judge the nearest note, and start sustaining it when it
   * is longer than an eighth.
   */
  press(): void {
    if (this.phase !== "running") return;
    this.spaceDown = true;
    this.restPenalized = false;

    const secondsPerBeat = 60 / this.bpm;
    let target: NoteEvent | null = null;
    let bestDelta = Number.POSITIVE_INFINITY;

    for (const note of this.notes) {
      if (note.rest || this.hitIds.has(note.id) || this.missedIds.has(note.id)) continue;
      const delta = Math.abs((note.beat - this.beatsElapsed) * secondsPerBeat);
      if (delta < bestDelta) {
        bestDelta = delta;
        target = note;
      }
    }

    if (target && bestDelta <= LATE_WINDOW) {
      const grade = timingGrade(bestDelta);
      if (grade !== "MISS") {
        this.registerHit(target, grade);
        if (target.beats > HOLD_MIN_BEATS) {
          this.hold = { endBeat: target.beat + target.beats };
        }
        return;
      }
    }

    this.registerMiss("MISS");
  }

  /** Key or pointer up: release the sustained note, or be penalised for leaving it early. */
  release(): void {
    this.spaceDown = false;
    this.restPenalized = false;

    if (!this.hold) {
      this.sound.stopNote();
      return;
    }

    const { endBeat } = this.hold;
    const remaining = ((endBeat - this.beatsElapsed) * 60) / this.bpm;
    this.hold = null;
    this.sound.stopNote();

    if (remaining > RELEASE_EARLY) {
      this.registerMiss("TOO SHORT");
      return;
    }

    this.score += HOLD_BONUS;
    this.popups.push({
      text: "HELD",
      kind: "HELD",
      x: WORLD.birdX,
      life: POPUP_LIFE,
    });
  }

  /** Change the tempo mid-run from the exercise controls. */
  setBpm(bpm: number): void {
    this.bpm = Math.max(40, Math.min(240, bpm));
    this.nextRamp = this.hits + RAMP_EVERY;
  }

  /** Add quiet clicks between beats: 8ths, triplets or 16ths. */
  setSubdivision(mode: SubdivisionMode): void {
    this.subdivisionSteps = SUBDIVISION_STEPS[mode] ?? 0;
  }

  /** Hits divided by judged events, as a percentage. */
  get accuracy(): number {
    const judged = this.hits + this.misses;
    return judged === 0 ? 100 : Math.round((this.hits / judged) * 100);
  }

  pause(): void {
    if (this.phase !== "running") return;
    this.phase = "paused";
  }

  resume(): void {
    if (this.phase !== "paused") return;
    this.phase = "running";
    this.accumulator = 0;
  }

  update(dt: number): void {
    if (this.phase !== "running") return;

    this.accumulator += Math.min(dt, 0.1);
    while (this.accumulator >= FIXED_STEP) {
      this.step(FIXED_STEP);
      this.accumulator -= FIXED_STEP;
      if (this.phase !== "running") break;
    }

    this.shake *= Math.pow(0.002, dt);
    this.flash = Math.max(0, this.flash - dt);
    for (const popup of this.popups) popup.life -= dt;
    this.popups = this.popups.filter((popup) => popup.life > 0);
  }

  screenX(note: NoteEvent): number {
    return WORLD.birdX + (note.beat - this.beatsElapsed) * PX_PER_BEAT;
  }

  private step(dt: number): void {
    this.beatsElapsed += (this.bpm / 60) * dt;
    this.scheduleClicks();

    if (this.beatsElapsed >= RUN_END_BEAT) {
      this.finish();
      return;
    }

    this.cullMissed();
    if (this.phase !== "running") return;
    this.checkHold();
    this.checkRest();
    if (this.phase !== "running") return;
    this.hopBird(dt);
  }

  /** A hold that reaches its end without a release is complete; the key is still down. */
  private checkHold(): void {
    if (this.hold && this.beatsElapsed >= this.hold.endBeat + HOLD_COMPLETE_GRACE) {
      this.hold = null;
      this.sound.stopNote();
    }
  }

  /** Holding the key through a rest is an articulation error. */
  private checkRest(): void {
    if (!this.spaceDown || this.restPenalized) return;

    for (const note of this.notes) {
      if (!note.rest) continue;
      if (
        this.beatsElapsed > note.beat + 0.05 &&
        this.beatsElapsed < note.beat + note.beats - 0.05
      ) {
        this.restPenalized = true;
        this.registerMiss("TOO LONG");
        return;
      }
    }
  }

  private scheduleClicks(): void {
    const secondsPerBeat = 60 / this.bpm;
    while ((this.nextClickBeat - this.beatsElapsed) * secondsPerBeat < CLICK_LOOKAHEAD) {
      const delay = Math.max(0, (this.nextClickBeat - this.beatsElapsed) * secondsPerBeat);
      const at = this.sound.now() + delay;
      this.sound.click(this.nextClickBeat % 4 === 0, at);
      if (this.subdivisionSteps > 1) {
        for (let i = 1; i < this.subdivisionSteps; i += 1) {
          this.sound.subdivision(at + (i / this.subdivisionSteps) * secondsPerBeat);
        }
      }
      this.nextClickBeat += 1;
    }
  }

  private cullMissed(): void {
    const secondsPerBeat = 60 / this.bpm;
    for (const note of this.notes) {
      if (note.rest || this.hitIds.has(note.id) || this.missedIds.has(note.id)) continue;
      const late = (this.beatsElapsed - note.beat) * secondsPerBeat;
      if (late > LATE_WINDOW) {
        this.missedIds.add(note.id);
        this.registerMiss();
        if (this.phase !== "running") return;
      }
    }
  }

  /**
   * Hop from note to note. The bird holds the pitch of the note it last played,
   * leaps, and touches down on the next note's perch on that note's beat, so the
   * touchdown and the note reaching the hit line are the same instant. The perch
   * band sits above the staff, so the bird never covers the notation.
   */
  private hopBird(dt: number): void {
    while (
      this.hopTo < this.landings.length &&
      this.landings[this.hopTo].beat <= this.beatsElapsed
    ) {
      this.hopTo += 1;
    }

    const to = this.landings[this.hopTo];
    const from = this.landings[this.hopTo - 1];
    // Before the first note the bird waits over the middle of the band.
    const fromY = from ? birdPerchY(from.step) : birdPerchY(4);
    const fromBeat = from ? from.beat : to ? to.beat - 2 : this.beatsElapsed;

    let y = fromY;
    if (to) {
      const air = Math.min(
        HOP.maxAirBeats,
        Math.max(HOP.minAirBeats, (to.beat - fromBeat) * HOP.airShare),
      );
      const takeoff = to.beat - air;
      if (this.beatsElapsed > takeoff) {
        const p = Math.min(1, (this.beatsElapsed - takeoff) / air);
        // Weight the pitch change, then lift the midpoint so the path is a hop.
        const ease = p * p * (3 - 2 * p);
        y =
          fromY +
          (birdPerchY(to.step) - fromY) * ease -
          Math.sin(Math.PI * p) * HOP.lift;
      }
    }

    this.bird.vy = dt > 0 ? (y - this.bird.y) / dt : 0;
    this.bird.y = y;
  }

  private registerHit(note: NoteEvent, grade: Grade): void {
    this.hitIds.add(note.id);
    this.hits += 1;

    this.score += timingScore(grade, this.combo);
    this.combo += 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.flash = 0.24;
    this.lastStep = note.step;

    this.popups.push({
      text: grade,
      kind: grade,
      x: WORLD.birdX,
      life: POPUP_LIFE,
    });

    const frequency = frequencyForStep(note.step);
    if (note.beats > HOLD_MIN_BEATS) {
      this.sound.startNote(frequency);
    } else {
      const seconds = Math.min(1.2, Math.max(0.12, (note.beats * 60) / this.bpm));
      this.sound.playNote(frequency, seconds);
    }

    if (this.hits >= this.nextRamp) {
      this.bpm = Math.min(MAX_BPM, this.bpm + 5);
      this.nextRamp += RAMP_EVERY;
    }
  }

  private registerMiss(text = "MISS"): void {
    this.combo = 0;
    this.misses += 1;

    this.popups.push({
      text,
      kind: "MISS",
      x: WORLD.birdX,
      life: POPUP_LIFE,
    });
    this.sound.miss();
  }

  private finish(): void {
    if (this.phase !== "running") return;
    this.phase = "crashed";
    this.hold = null;
    this.sound.stopNote();
    this.onEnd?.();
  }
}
