import { frequencyForStep, type Sound } from "./audio";
import { birdPerchY, generateCourse, staffY } from "./layout";
import { engrave, type EngravedNote } from "./rhythm";
import { TIMING, timingDirection, timingGrade, timingScore } from "./scoring";
import { METERS } from "./tiers";
import type {
  BarSummary,
  BirdState,
  Grade,
  MeterConfig,
  MeterId,
  NoteEvent,
  NoteOutcome,
  Phase,
  RunSummary,
  StaffMode,
  SubdivisionMode,
  Tier,
} from "./types";
import { WORLD } from "./world";

const SUBDIVISION_STEPS: Record<SubdivisionMode, number> = {
  off: 0,
  "8": 2,
  "3": 3,
  "16": 4,
};

export const RUN_BARS = 8;
const RAMP_EVERY = 8;
const MAX_BPM = 184;
const CLICK_LOOKAHEAD = 0.16;
const POPUP_LIFE = 0.78;

const HOP = {
  airShare: 0.6,
  minAirBeats: 0.35,
  maxAirBeats: 1,
  lift: 22,
};

const LATE_WINDOW = TIMING.ok;
const HOLD_MIN_BEATS = 0.5 + 1e-4;
const RELEASE_EARLY = 0.15;
const HOLD_COMPLETE_GRACE = 0.15;
const HOLD_BONUS = 25;

export interface Popup {
  text: string;
  subtext?: string;
  kind: Grade | "MISS" | "HELD";
  x: number;
  life: number;
}

export interface GameConfig {
  tier: Tier;
  seed: string;
  sound: Sound;
  meterId?: MeterId;
  staffMode?: StaffMode;
  startBpm?: number;
  practiceMode?: boolean;
  latencyMs?: number;
  focusBar?: number | null;
}

export class Game {
  readonly tier: Tier;
  readonly seed: string;
  readonly meterId: MeterId;
  readonly meter: MeterConfig;
  readonly staffMode: StaffMode;
  readonly practiceMode: boolean;
  readonly focusBar: number | null;
  readonly barCount: number;
  readonly runEndBeat: number;

  readonly notes: NoteEvent[];
  readonly engraved: EngravedNote[];
  private readonly landings: NoteEvent[];
  private readonly sound: Sound;

  phase: Phase = "ready";
  bpm: number;
  latencyMs: number;
  beatsElapsed = 0;
  score = 0;
  combo = 0;
  bestCombo = 0;
  hits = 0;
  misses = 0;
  bird: BirdState;
  flash = 0;
  lastStep = 4;
  popups: Popup[] = [];

  /** Per-note outcome map for persistent staff colouring and post-run diagnostics. */
  readonly outcomes = new Map<number, NoteOutcome>();
  /** Current active hold note (if sustaining > eighth). */
  hold: { noteId: number; startBeat: number; endBeat: number; step: number } | null = null;

  onEnd?: (summary: RunSummary) => void;

  private readonly hitIds = new Set<number>();
  private readonly missedIds = new Set<number>();
  private nextClickBeat = 0;
  private subdivisionSteps = 0;
  private nextRamp = RAMP_EVERY;
  private hopTo = 0;
  private spaceDown = false;
  private restPenalized = false;

  private anchorAudioTime = 0;
  private anchorBeats = 0;

  constructor(config: GameConfig) {
    this.tier = config.tier;
    this.seed = config.seed;
    this.sound = config.sound;
    this.meterId = config.meterId ?? "4/4";
    this.meter = METERS[this.meterId];
    this.staffMode = config.staffMode ?? "treble";
    this.practiceMode = config.practiceMode ?? false;
    this.focusBar = config.focusBar ?? null;
    this.barCount = this.focusBar !== null ? 4 : RUN_BARS;
    this.runEndBeat = this.meter.preRollQuarters + this.barCount * this.meter.quartersPerBar + 1;

    this.bpm = config.startBpm ?? config.tier.startBpm;
    this.latencyMs = config.latencyMs ?? 0;
    this.bird = { y: birdPerchY(4, this.staffMode), vy: 0 };

    this.notes = generateCourse(
      config.tier,
      config.seed,
      this.meterId,
      RUN_BARS,
      this.focusBar,
    );
    this.engraved = engrave(this.notes, this.meterId);
    this.landings = this.notes.filter((note) => !note.rest);
  }

  get quartersPerSecond(): number {
    return (this.bpm / 60) * this.meter.clickIntervalQuarters;
  }

  get currentBarNumber(): number {
    const rel = this.beatsElapsed - this.meter.preRollQuarters;
    if (rel < 0) return 0;
    return Math.min(this.barCount, Math.floor(rel / this.meter.quartersPerBar) + 1);
  }

  start(): void {
    if (this.phase !== "ready") return;
    this.sound.stopNote();
    this.sound.ensure();
    this.phase = "running";
    this.beatsElapsed = 0;
    this.nextClickBeat = 0;
    this.bird = { y: birdPerchY(4, this.staffMode), vy: 0 };
    this.hopTo = 0;
    this.hold = null;
    this.spaceDown = false;
    this.restPenalized = false;
    this.reanchorClock();
  }

  private reanchorClock(): void {
    this.anchorAudioTime = this.sound.now();
    this.anchorBeats = this.beatsElapsed;
  }

  private effectiveBeatNow(): number {
    return this.beatsElapsed - (this.latencyMs / 1000) * this.quartersPerSecond;
  }

  press(): void {
    if (this.phase !== "running") return;
    this.spaceDown = true;
    this.restPenalized = false;

    const qps = this.quartersPerSecond;
    const effectiveBeat = this.effectiveBeatNow();

    let target: NoteEvent | null = null;
    let bestAbsDelta = Number.POSITIVE_INFINITY;
    let bestSignedDelta = 0;

    for (const note of this.notes) {
      if (note.rest || this.hitIds.has(note.id) || this.missedIds.has(note.id)) continue;
      const signedDelta = (effectiveBeat - note.beat) / qps;
      const absDelta = Math.abs(signedDelta);
      if (absDelta < bestAbsDelta) {
        bestAbsDelta = absDelta;
        bestSignedDelta = signedDelta;
        target = note;
      }
    }

    if (target && bestAbsDelta <= LATE_WINDOW) {
      const grade = timingGrade(bestAbsDelta);
      if (grade !== "MISS") {
        this.registerHit(target, grade, bestSignedDelta);
        if (target.beats > HOLD_MIN_BEATS) {
          this.hold = {
            noteId: target.id,
            startBeat: target.beat,
            endBeat: target.beat + target.beats,
            step: target.step,
          };
        }
        return;
      }
    }

    this.registerStrayMiss();
  }

  release(): void {
    this.spaceDown = false;
    this.restPenalized = false;
    if (!this.hold) {
      this.sound.stopNote();
      return;
    }

    const { noteId, endBeat } = this.hold;
    const remaining = (endBeat - this.effectiveBeatNow()) / this.quartersPerSecond;
    this.hold = null;
    this.sound.stopNote();

    if (remaining > RELEASE_EARLY) {
      const prev = this.outcomes.get(noteId);
      if (prev) {
        this.outcomes.set(noteId, { ...prev, grade: "TOO SHORT" });
      }
      this.registerPenalty("TOO SHORT");
      return;
    }

    const prev = this.outcomes.get(noteId);
    if (prev) {
      this.outcomes.set(noteId, { ...prev, heldComplete: true });
    }
    this.score += HOLD_BONUS;
    this.popups.push({
      text: "HELD",
      subtext: `+${HOLD_BONUS}`,
      kind: "HELD",
      x: WORLD.birdX,
      life: POPUP_LIFE,
    });
  }

  setBpm(bpm: number): void {
    this.bpm = Math.max(40, Math.min(240, bpm));
    this.nextRamp = this.hits + RAMP_EVERY;
    this.reanchorClock();
  }

  setLatencyMs(ms: number): void {
    this.latencyMs = Math.max(-150, Math.min(150, ms));
  }

  setSubdivision(mode: SubdivisionMode): void {
    this.subdivisionSteps = SUBDIVISION_STEPS[mode] ?? 0;
  }

  get accuracy(): number {
    const judged = this.hits + this.misses;
    return judged === 0 ? 100 : Math.round((this.hits / judged) * 100);
  }

  pause(): void {
    if (this.phase !== "running") return;
    this.phase = "paused";
    this.sound.stopNote();
    this.hold = null;
    this.spaceDown = false;
    this.restPenalized = false;
  }

  resume(): void {
    if (this.phase !== "paused") return;
    this.sound.ensure();
    this.phase = "running";
    this.nextClickBeat = Math.ceil(this.beatsElapsed / this.meter.clickIntervalQuarters) *
      this.meter.clickIntervalQuarters;
    this.reanchorClock();
  }

  update(dt: number): void {
    if (this.phase !== "running") return;

    if (this.sound.isRunning() && this.anchorAudioTime > 0) {
      const elapsedAudio = Math.max(0, this.sound.now() - this.anchorAudioTime);
      this.beatsElapsed = this.anchorBeats + elapsedAudio * this.quartersPerSecond;
    } else {
      this.beatsElapsed += this.quartersPerSecond * Math.min(dt, 0.05);
    }

    this.scheduleClicks();

    if (this.beatsElapsed >= this.runEndBeat) {
      this.finish();
      return;
    }

    this.cullMissed();
    this.checkHold();
    this.checkRest();
    this.hopBird(dt);

    this.flash = Math.max(0, this.flash - dt);
    for (const popup of this.popups) popup.life -= dt;
    this.popups = this.popups.filter((popup) => popup.life > 0);
  }

  screenX(beat: number): number {
    return WORLD.birdX + (beat - this.beatsElapsed) * this.meter.pxPerQuarter;
  }

  private checkHold(): void {
    if (this.hold && this.beatsElapsed >= this.hold.endBeat + HOLD_COMPLETE_GRACE) {
      const prev = this.outcomes.get(this.hold.noteId);
      if (prev) {
        this.outcomes.set(this.hold.noteId, { ...prev, heldComplete: true });
      }
      this.hold = null;
      this.sound.stopNote();
    }
  }

  private checkRest(): void {
    if (!this.spaceDown || this.restPenalized) return;
    const eff = this.effectiveBeatNow();
    for (const note of this.notes) {
      if (!note.rest) continue;
      if (eff > note.beat + 0.06 && eff < note.beat + note.beats - 0.06) {
        this.restPenalized = true;
        this.registerPenalty("TOO LONG");
        return;
      }
    }
  }

  private scheduleClicks(): void {
    const qps = this.quartersPerSecond;
    const interval = this.meter.clickIntervalQuarters;
    const clickDurSeconds = interval / qps;

    while ((this.nextClickBeat - this.beatsElapsed) / qps < CLICK_LOOKAHEAD) {
      const delay = Math.max(0, (this.nextClickBeat - this.beatsElapsed) / qps);
      const at = this.sound.now() + delay;
      const rel = this.nextClickBeat - this.meter.preRollQuarters;
      const inBar = ((rel % this.meter.quartersPerBar) + this.meter.quartersPerBar) %
        this.meter.quartersPerBar;
      const isDownbeat = inBar < 1e-4 || Math.abs(inBar - this.meter.quartersPerBar) < 1e-4;

      this.sound.click(isDownbeat, at);
      if (this.subdivisionSteps > 1) {
        for (let i = 1; i < this.subdivisionSteps; i += 1) {
          this.sound.subdivision(at + (i / this.subdivisionSteps) * clickDurSeconds);
        }
      }
      this.nextClickBeat += interval;
    }
  }

  private cullMissed(): void {
    const qps = this.quartersPerSecond;
    const eff = this.effectiveBeatNow();
    for (const note of this.notes) {
      if (note.rest || this.hitIds.has(note.id) || this.missedIds.has(note.id)) continue;
      const lateSeconds = (eff - note.beat) / qps;
      if (lateSeconds > LATE_WINDOW) {
        this.missedIds.add(note.id);
        this.outcomes.set(note.id, { grade: "MISS" });
        this.registerPenalty("MISS");
      }
    }
  }

  private hopBird(dt: number): void {
    while (
      this.hopTo < this.landings.length &&
      this.landings[this.hopTo].beat <= this.beatsElapsed
    ) {
      this.hopTo += 1;
    }
    const to = this.landings[this.hopTo];
    const from = this.landings[this.hopTo - 1];
    const fromY = from ? birdPerchY(from.step, this.staffMode) : birdPerchY(4, this.staffMode);
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
        const ease = p * p * (3 - 2 * p);
        y =
          fromY +
          (birdPerchY(to.step, this.staffMode) - fromY) * ease -
          Math.sin(Math.PI * p) * HOP.lift;
      }
    }

    this.bird.vy = dt > 0 ? (y - this.bird.y) / dt : 0;
    this.bird.y = y;
  }

  private registerHit(note: NoteEvent, grade: Grade, signedDeltaSeconds: number): void {
    this.hitIds.add(note.id);
    this.hits += 1;
    this.score += timingScore(grade, this.combo);
    this.combo += 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.flash = 0.24;
    this.lastStep = note.step;

    const deltaMs = Math.round(signedDeltaSeconds * 1000);
    const dir = timingDirection(signedDeltaSeconds);
    this.outcomes.set(note.id, { grade, deltaMs, direction: dir });

    let subtext: string | undefined;
    if (dir === "EARLY") subtext = `${deltaMs}ms EARLY`;
    else if (dir === "LATE") subtext = `+${deltaMs}ms LATE`;

    this.popups.push({
      text: grade,
      subtext,
      kind: grade,
      x: WORLD.birdX,
      life: POPUP_LIFE,
    });

    const frequency = frequencyForStep(note.step, this.staffMode);
    if (note.beats > HOLD_MIN_BEATS) {
      this.sound.startNote(frequency);
    } else {
      const seconds = Math.min(1.1, Math.max(0.12, note.beats / this.quartersPerSecond));
      this.sound.playNote(frequency, seconds);
    }

    if (!this.practiceMode && this.hits >= this.nextRamp) {
      this.bpm = Math.min(MAX_BPM, this.bpm + 5);
      this.nextRamp += RAMP_EVERY;
      this.reanchorClock();
    }
  }

  private registerStrayMiss(): void {
    this.registerPenalty("MISS");
  }

  private registerPenalty(text: string): void {
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

  buildSummary(): RunSummary {
    const deltas: number[] = [];
    let earlyCount = 0;
    let onTimeCount = 0;
    let lateCount = 0;

    for (const outcome of this.outcomes.values()) {
      if (typeof outcome.deltaMs === "number") {
        deltas.push(outcome.deltaMs);
        if (outcome.direction === "EARLY") earlyCount += 1;
        else if (outcome.direction === "LATE") lateCount += 1;
        else onTimeCount += 1;
      }
    }

    const avgDeltaMs =
      deltas.length > 0
        ? Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length)
        : null;

    const bars: BarSummary[] = [];
    for (let b = 0; b < this.barCount; b += 1) {
      const start = this.meter.preRollQuarters + b * this.meter.quartersPerBar;
      const end = start + this.meter.quartersPerBar;
      const barNotes = this.notes.filter(
        (n) => !n.rest && n.beat >= start - 1e-4 && n.beat < end - 1e-4,
      );
      let barHits = 0;
      let barMisses = 0;
      const barDeltas: number[] = [];
      for (const n of barNotes) {
        const out = this.outcomes.get(n.id);
        if (!out) continue;
        if (out.grade === "PERFECT" || out.grade === "GOOD" || out.grade === "OK") {
          barHits += 1;
          if (typeof out.deltaMs === "number") barDeltas.push(out.deltaMs);
        } else {
          barMisses += 1;
        }
      }
      const total = barHits + barMisses;
      bars.push({
        barIndex: b,
        hits: barHits,
        misses: barMisses,
        totalNotes: barNotes.length,
        accuracy: total === 0 ? 100 : Math.round((barHits / total) * 100),
        avgDeltaMs:
          barDeltas.length > 0
            ? Math.round(barDeltas.reduce((a, c) => a + c, 0) / barDeltas.length)
            : null,
      });
    }

    return {
      score: this.score,
      accuracy: this.accuracy,
      hits: this.hits,
      misses: this.misses,
      bestCombo: this.bestCombo,
      topBpm: this.bpm,
      avgDeltaMs,
      earlyCount,
      onTimeCount,
      lateCount,
      bars,
      focusBar: this.focusBar,
    };
  }

  private finish(): void {
    if (this.phase !== "running") return;
    this.phase = "finished";
    this.hold = null;
    this.spaceDown = false;
    this.sound.stopNote();
    this.onEnd?.(this.buildSummary());
  }

  noteDotY(note: NoteEvent): number {
    return staffY(note.step, this.staffMode);
  }
}
