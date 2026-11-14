import { METERS } from "./tiers";
import type { MeterId, NoteEvent } from "./types";

const EPS = 1e-4;

export interface EngravedNote {
  key: string;
  sourceId: number;
  beat: number;
  beats: number;
  step: number;
  rest: boolean;
  tieFrom: boolean;
  tieTo: boolean;
  tupletGroup?: number;
}

/**
 * Prepare notes for engraving:
 * 1. Off-beat notes crossing a beat boundary split at the beat and tie.
 * 2. In 4/4, on-beat notes starting on beat 2 (offset 1.0) that cross beat 3 (offset 2.0)
 *    also split at the half-bar boundary to preserve standard engraving readability.
 * 3. Triplet notes are never split.
 */
export function engrave(notes: NoteEvent[], meterId: MeterId = "4/4"): EngravedNote[] {
  const meter = METERS[meterId];
  const out: EngravedNote[] = [];

  for (const note of notes) {
    if (note.tupletGroup) {
      out.push({
        key: String(note.id),
        sourceId: note.id,
        beat: note.beat,
        beats: note.beats,
        step: note.step,
        rest: note.rest,
        tieFrom: false,
        tieTo: false,
        tupletGroup: note.tupletGroup,
      });
      continue;
    }

    const start = note.beat;
    const end = note.beat + note.beats;
    const relStart = start - meter.preRollQuarters;
    const barIdx = Math.floor((relStart + EPS) / meter.quartersPerBar);
    const barStart = meter.preRollQuarters + barIdx * meter.quartersPerBar;
    const inBar = start - barStart;
    const offBeat = Math.abs(inBar - Math.round(inBar)) > EPS;

    const boundaries: number[] = [];

    if (meterId === "6/8") {
      // Split across the 1.5-quarter dotted-quarter midpoint if crossing it on an off-beat
      const mid = barStart + 1.5;
      if (start < mid - EPS && end > mid + EPS && Math.abs(inBar) > EPS) {
        boundaries.push(mid);
      }
    } else if (offBeat) {
      for (let b = Math.ceil(start + EPS); b < end - EPS; b += 1) {
        boundaries.push(b);
      }
    } else if (meterId === "4/4") {
      // On beat 2 (inBar === 1), split across beat 3 (inBar === 2) if crossing it
      const halfBar = barStart + 2;
      if (Math.abs(inBar - 1) < EPS && end > halfBar + EPS) {
        boundaries.push(halfBar);
      }
    }

    if (boundaries.length === 0) {
      out.push({
        key: String(note.id),
        sourceId: note.id,
        beat: start,
        beats: note.beats,
        step: note.step,
        rest: note.rest,
        tieFrom: false,
        tieTo: false,
      });
      continue;
    }

    const points = [start, ...boundaries, end];
    for (let i = 0; i < points.length - 1; i += 1) {
      out.push({
        key: `${note.id}:${i}`,
        sourceId: note.id,
        beat: points[i],
        beats: points[i + 1] - points[i],
        step: note.step,
        rest: note.rest,
        tieFrom: !note.rest && i > 0,
        tieTo: !note.rest && i < points.length - 2,
      });
    }
  }

  return out;
}

/**
 * Beam sub-quarter notes according to meter conventions:
 * - 4/4: beam eighths by half-bar, sixteenths by beat
 * - 3/4 & 2/4: beam eighths & sixteenths by beat
 * - 6/8: beam by dotted-quarter group (1.5 quarters)
 * - Triplets: beam each tupletGroup together
 */
export function beamGroups(notes: EngravedNote[], meterId: MeterId = "4/4"): EngravedNote[][] {
  const meter = METERS[meterId];
  const groups: EngravedNote[][] = [];
  let current: EngravedNote[] = [];

  const flush = (): void => {
    if (current.length > 1) groups.push(current);
    current = [];
  };

  const groupIndexFor = (note: EngravedNote): number => {
    if (note.tupletGroup) return note.tupletGroup * 10000;
    const rel = note.beat - meter.preRollQuarters;
    if (meterId === "6/8") {
      return Math.floor((rel + EPS) / 1.5);
    }
    if (meterId === "4/4" && Math.abs(note.beats - 0.5) < EPS) {
      return Math.floor((rel + EPS) / 2);
    }
    return Math.floor(rel + EPS);
  };

  for (const note of notes) {
    const isBeamable = !note.rest && note.beats < 0.75 - EPS;
    if (!isBeamable) {
      flush();
      continue;
    }

    if (current.length === 0) {
      current = [note];
      continue;
    }

    const previous = current[current.length - 1];
    const sameTuplet = (note.tupletGroup ?? 0) === (previous.tupletGroup ?? 0);
    const sameGroup = groupIndexFor(note) === groupIndexFor(previous);
    const adjacent = Math.abs(note.beat - (previous.beat + previous.beats)) < 0.01;
    // Break half-bar beam in 4/4 if mixing sixteenths across beats
    const crossBeatSixteenth =
      meterId === "4/4" &&
      (note.beats < 0.4 || previous.beats < 0.4) &&
      Math.floor(note.beat - meter.preRollQuarters + EPS) !==
        Math.floor(previous.beat - meter.preRollQuarters + EPS);

    if (sameTuplet && sameGroup && adjacent && !crossBeatSixteenth) {
      current.push(note);
    } else {
      flush();
      current = [note];
    }
  }

  flush();
  return groups;
}

export const MIDDLE_LINE = 4;
export const STEM_UP = 1;
export const STEM_DOWN = -1;

export function stemDirection(step: number): number {
  return step >= MIDDLE_LINE ? STEM_DOWN : STEM_UP;
}

export function groupStemDirection(notes: EngravedNote[]): number {
  let decisive = notes[0];
  for (const note of notes) {
    if (Math.abs(note.step - MIDDLE_LINE) > Math.abs(decisive.step - MIDDLE_LINE)) {
      decisive = note;
    }
  }
  return stemDirection(decisive.step);
}
