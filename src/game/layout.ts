import { createRng, pick, randInt, type Rng } from "./rng";
import type { NoteEvent, Tier } from "./types";

export const BEATS_PER_BAR = 4;
/** Empty beats before the first note, so the count-in lands before the first target. */
export const PRE_ROLL_BEATS = 4;
export const MAX_STEP = 8;
/** Horizontal distance covered by one beat. Four beats make one measure. */
export const PX_PER_BEAT = 65;

/** Five staff lines live at steps 0, 2, 4, 6, 8. */
export const STAFF = {
  baseY: 322,
  stepPx: 9,
};

export function staffY(step: number): number {
  return STAFF.baseY - step * STAFF.stepPx;
}

/**
 * The bird flies in the space above the staff so it never covers the notation:
 * its lowest perch clears the top line, and higher notes perch higher.
 */
export const FLIGHT = {
  /** Gap between the lowest perch and the top line. */
  clearance: 8,
  /** How far the perch climbs for the top note. */
  band: 32,
};

/** Perch height — where the bird's feet sit — for a staff step. */
export function birdPerchY(step: number): number {
  const clamped = Math.max(0, Math.min(MAX_STEP, step));
  return staffY(MAX_STEP) - FLIGHT.clearance - (clamped / MAX_STEP) * FLIGHT.band;
}

function chooseDuration(tier: Tier, remaining: number, beat: number, rng: Rng): number {
  let values = tier.values.filter((value) => value <= remaining + 1e-6);
  if (values.length === 0) return remaining;

  // Unsyncopated tiers only place eighths off the beat.
  if (!tier.syncopation && Math.abs(beat - Math.round(beat)) > 1e-6) {
    const eighths = values.filter((value) => value === 0.5);
    if (eighths.length > 0) values = eighths;
  }

  return pick(rng, values);
}

export interface StepRef {
  value: number;
}

/** Generate one 4/4 bar starting at an absolute beat. */
export function generateBar(
  tier: Tier,
  rng: Rng,
  startBeat: number,
  nextId: { value: number },
  step: StepRef,
): NoteEvent[] {
  const notes: NoteEvent[] = [];
  let remaining = BEATS_PER_BAR;
  let beat = startBeat;

  while (remaining > 1e-6) {
    const duration = Math.min(chooseDuration(tier, remaining, beat, rng), remaining);
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

  if (tier.ties) {
    for (let i = 0; i < notes.length - 1; i += 1) {
      const current = notes[i];
      const next = notes[i + 1];
      if (current.rest || next.rest || current.tied) continue;
      if (current.beats + next.beats > 2) continue;
      if (rng() < 0.3) {
        current.beats += next.beats;
        current.tied = true;
        notes.splice(i + 1, 1);
        i -= 1;
      }
    }
  }

  return notes;
}

/** Pre-generate the whole course. 240 bars is many minutes of play at ramping tempi. */
export function generateCourse(tier: Tier, seed: string, bars = 240): NoteEvent[] {
  const rng = createRng(seed);
  const notes: NoteEvent[] = [];
  const nextId = { value: 0 };
  const step: StepRef = { value: 4 };

  for (let bar = 0; bar < bars; bar += 1) {
    const startBeat = PRE_ROLL_BEATS + bar * BEATS_PER_BAR;
    notes.push(...generateBar(tier, rng, startBeat, nextId, step));
  }

  return notes;
}
