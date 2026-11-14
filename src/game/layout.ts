import { createRng, pick, randInt, type Rng } from "./rng";
import { METERS } from "./tiers";
import type { MeterId, NoteEvent, StaffMode, Tier } from "./types";

export const MAX_STEP = 8;

export const STAFF = {
  baseY: 322,
  stepPx: 9,
};

export function staffY(step: number, staffMode: StaffMode = "treble"): number {
  if (staffMode === "rhythm") {
    return STAFF.baseY - 4 * STAFF.stepPx;
  }
  return STAFF.baseY - step * STAFF.stepPx;
}

export const FLIGHT = {
  clearance: 10,
  band: 32,
};

export function birdPerchY(step: number, staffMode: StaffMode = "treble"): number {
  if (staffMode === "rhythm") {
    return staffY(4, "rhythm") - 36;
  }
  const clamped = Math.max(0, Math.min(MAX_STEP, step));
  return staffY(MAX_STEP, "treble") - FLIGHT.clearance - (clamped / MAX_STEP) * FLIGHT.band;
}

export interface StepRef {
  value: number;
}

const SIXTEENTH_CELLS: readonly (readonly number[])[] = [
  [0.25, 0.25, 0.25, 0.25],
  [0.25, 0.25, 0.5],
  [0.5, 0.25, 0.25],
  [0.25, 0.25],
];

function chooseDuration(
  tier: Tier,
  remaining: number,
  inBar: number,
  meterId: MeterId,
  rng: Rng,
): number {
  let values = tier.values.filter((v) => v <= remaining + 1e-6 && v >= 0.5 - 1e-6);
  if (meterId === "6/8") {
    // Keep 6/8 clean in compound duple (eighths, quarters, dotted quarters).
    const compound = values.filter((v) => v === 0.5 || v === 1 || v === 1.5);
    if (compound.length > 0) values = compound;
    // Do not cross the 1.5-quarter middle of 6/8 with a 1.0 or 1.5 unless starting on 0 or 1.5.
    const posInGroup = ((inBar % 1.5) + 1.5) % 1.5;
    if (Math.abs(posInGroup - 0.5) < 1e-6) {
      // On beat 2 of 3-eighth group: allow 1.0 (quarter) or 0.5 (eighth)
      values = values.filter((v) => v <= 1.0 + 1e-6);
    } else if (Math.abs(posInGroup - 1.0) < 1e-6) {
      values = values.filter((v) => v <= 0.5 + 1e-6);
    }
  } else if (!tier.syncopation && Math.abs(inBar - Math.round(inBar)) > 1e-6) {
    const eighths = values.filter((v) => v === 0.5);
    if (eighths.length > 0) values = eighths;
  }
  if (values.length === 0) return Math.min(0.5, remaining);
  return pick(rng, values);
}

export function generateBar(
  tier: Tier,
  rng: Rng,
  startBeat: number,
  meterId: MeterId,
  nextId: { value: number },
  nextTupletId: { value: number },
  step: StepRef,
): NoteEvent[] {
  const meter = METERS[meterId];
  const notes: NoteEvent[] = [];
  let remaining = meter.quartersPerBar;
  let beat = startBeat;
  const hasSixteenths = tier.values.includes(0.25);

  while (remaining > 1e-6) {
    const inBar = beat - startBeat;
    const onBeat = Math.abs(inBar - Math.round(inBar)) < 1e-6;

    // Optional 1-beat triplet group on a beat in simple time
    if (
      meterId !== "6/8" &&
      tier.tripletProb &&
      onBeat &&
      remaining >= 1 - 1e-6 &&
      rng() < tier.tripletProb
    ) {
      const group = nextTupletId.value++;
      for (let i = 0; i < 3; i += 1) {
        step.value = Math.max(0, Math.min(MAX_STEP, step.value + randInt(rng, -1, 1)));
        notes.push({
          id: nextId.value++,
          beat: beat + i / 3,
          beats: 1 / 3,
          step: step.value,
          rest: false,
          tied: false,
          tupletGroup: group,
        });
      }
      remaining -= 1;
      beat += 1;
      continue;
    }

    // Optional sixteenth-note rhythmic cell on a beat or half-beat
    if (hasSixteenths && onBeat && rng() < 0.34) {
      const validCells = SIXTEENTH_CELLS.filter(
        (cell) => cell.reduce((a, b) => a + b, 0) <= remaining + 1e-6,
      );
      if (validCells.length > 0) {
        const cell = pick(rng, validCells);
        for (const dur of cell) {
          step.value = Math.max(0, Math.min(MAX_STEP, step.value + randInt(rng, -1, 1)));
          notes.push({
            id: nextId.value++,
            beat,
            beats: dur,
            step: step.value,
            rest: false,
            tied: false,
          });
          remaining -= dur;
          beat += dur;
        }
        continue;
      }
    }

    const duration = Math.min(chooseDuration(tier, remaining, inBar, meterId, rng), remaining);
    const rest = rng() < tier.restProb && tier.allowedRests.includes(duration);
    step.value = Math.max(0, Math.min(MAX_STEP, step.value + randInt(rng, -1, 1)));
    notes.push({
      id: nextId.value++,
      beat,
      beats: duration,
      step: rest ? 4 : step.value,
      rest,
      tied: false,
    });
    remaining -= duration;
    beat += duration;
  }

  if (tier.ties && meterId !== "6/8") {
    for (let i = 0; i < notes.length - 1; i += 1) {
      const current = notes[i];
      const next = notes[i + 1];
      if (current.rest || next.rest || current.tied) continue;
      if (current.tupletGroup || next.tupletGroup) continue;
      if (current.beats < 0.49 || next.beats < 0.49) continue;
      if (current.beats + next.beats > 2) continue;
      if (rng() < 0.28) {
        current.beats += next.beats;
        current.tied = true;
        notes.splice(i + 1, 1);
        i -= 1;
      }
    }
  }

  return notes;
}

export function generateCourse(
  tier: Tier,
  seed: string,
  meterId: MeterId = "4/4",
  bars = 8,
  focusBar: number | null = null,
): NoteEvent[] {
  const meter = METERS[meterId];
  const rng = createRng(`${seed}:${meterId}`);
  const nextId = { value: 0 };
  const nextTupletId = { value: 1 };
  const step: StepRef = { value: 4 };

  const generatedBars: NoteEvent[][] = [];
  for (let bar = 0; bar < bars; bar += 1) {
    const startBeat = meter.preRollQuarters + bar * meter.quartersPerBar;
    generatedBars.push(generateBar(tier, rng, startBeat, meterId, nextId, nextTupletId, step));
  }

  if (focusBar === null || focusBar < 0 || focusBar >= bars) {
    return generatedBars.flat();
  }

  // Practice focus mode: repeat the selected bar 4 times so the student can drill that measure.
  const template = generatedBars[focusBar];
  const templateStart = meter.preRollQuarters + focusBar * meter.quartersPerBar;
  const repeated: NoteEvent[] = [];
  let cloneId = 0;
  for (let rep = 0; rep < 4; rep += 1) {
    const repStart = meter.preRollQuarters + rep * meter.quartersPerBar;
    const tupletOffset = rep * 1000;
    for (const note of template) {
      repeated.push({
        ...note,
        id: cloneId++,
        beat: repStart + (note.beat - templateStart),
        tupletGroup: note.tupletGroup ? note.tupletGroup + tupletOffset : undefined,
      });
    }
  }
  return repeated;
}
