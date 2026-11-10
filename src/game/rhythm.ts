import type { NoteEvent } from "./types";

const EPS = 1e-6;

export interface EngravedNote {
  /** Unique per segment, e.g. "12:1". */
  key: string;
  /** The rhythm event this segment belongs to. */
  sourceId: number;
  beat: number;
  beats: number;
  step: number;
  rest: boolean;
  tieFrom: boolean;
  tieTo: boolean;
}

/**
 * Prepare notes for engraving. A note that starts off the beat and runs across
 * a beat boundary is split there and tied, so the metre stays readable. Notes
 * that begin on a beat keep their written value (a dotted quarter may cross a
 * beat, as it does in normal notation).
 *
 * This is a display transform only: the engine still scores one hit per
 * original rhythm event.
 */
export function engrave(notes: NoteEvent[]): EngravedNote[] {
  const out: EngravedNote[] = [];

  for (const note of notes) {
    const start = note.beat;
    const end = note.beat + note.beats;
    const offBeat = Math.abs(start - Math.round(start)) > EPS;

    const boundaries: number[] = [];
    if (offBeat) {
      for (let beat = Math.ceil(start + EPS); beat < end - EPS; beat += 1) {
        boundaries.push(beat);
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
        // Rests are never tied; notes are tied across the split.
        tieFrom: !note.rest && i > 0,
        tieTo: !note.rest && i < points.length - 2,
      });
    }
  }

  return out;
}

/**
 * Beam groups follow the metre: in 4/4 consecutive eighth notes are beamed
 * across a half-bar (up to four eighths), but never across the half-bar or bar
 * line. A rest or a longer value breaks the beam.
 */
export function beamGroups(notes: EngravedNote[]): EngravedNote[][] {
  const groups: EngravedNote[][] = [];
  let current: EngravedNote[] = [];

  const flush = (): void => {
    if (current.length > 1) groups.push(current);
    current = [];
  };

  for (const note of notes) {
    const isEighth = !note.rest && Math.abs(note.beats - 0.5) < EPS;
    if (!isEighth) {
      flush();
      continue;
    }

    if (current.length === 0) {
      current = [note];
      continue;
    }

    const previous = current[current.length - 1];
    const sameHalfBar =
      Math.floor(note.beat / 2 + EPS) === Math.floor(previous.beat / 2 + EPS);
    const adjacent = Math.abs(note.beat - (previous.beat + previous.beats)) < EPS;

    if (sameHalfBar && adjacent) {
      current.push(note);
    } else {
      flush();
      current = [note];
    }
  }

  flush();
  return groups;
}

/** Staff step of the middle line, B4: stems fall from here upward. */
export const MIDDLE_LINE = 4;
export const STEM_UP = 1;
export const STEM_DOWN = -1;

/** Stems point down on and above the B line, and up below it. */
export function stemDirection(step: number): number {
  return step >= MIDDLE_LINE ? STEM_DOWN : STEM_UP;
}

/**
 * A beam is one stroke, so its notes share a stem direction: the note farthest
 * from the middle line decides.
 */
export function groupStemDirection(notes: EngravedNote[]): number {
  let decisive = notes[0];
  for (const note of notes) {
    if (Math.abs(note.step - MIDDLE_LINE) > Math.abs(decisive.step - MIDDLE_LINE)) {
      decisive = note;
    }
  }
  return stemDirection(decisive.step);
}
