import { describe, expect, it } from "vitest";
import { beamGroups, engrave } from "../src/game/rhythm";
import type { NoteEvent } from "../src/game/types";

let nextId = 1;

function note(partial: Partial<NoteEvent> & { beat: number; beats: number }): NoteEvent {
  return {
    id: partial.id ?? nextId++,
    beat: partial.beat,
    beats: partial.beats,
    step: partial.step ?? 4,
    rest: partial.rest ?? false,
    tied: partial.tied ?? false,
  };
}

describe("engrave", () => {
  it("keeps an on-beat dotted quarter whole", () => {
    const [engraved] = engrave([note({ id: 1, beat: 1, beats: 1.5 })]);

    expect(engraved.beat).toBe(1);
    expect(engraved.beats).toBe(1.5);
    expect(engraved.tieFrom).toBe(false);
    expect(engraved.tieTo).toBe(false);
  });

  it("splits an off-beat dotted quarter at the beat and ties it", () => {
    const segments = engrave([note({ id: 2, beat: 0.5, beats: 1.5 })]);

    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({ beat: 0.5, beats: 0.5, tieTo: true, tieFrom: false });
    expect(segments[1]).toMatchObject({ beat: 1, beats: 1, tieFrom: true, tieTo: false });
    expect(segments[0].sourceId).toBe(segments[1].sourceId);
  });

  it("splits a two-beat off-beat note at both beats", () => {
    const segments = engrave([note({ id: 3, beat: 0.5, beats: 2 })]);

    expect(segments.map((s) => s.beats)).toEqual([0.5, 1, 0.5]);
    expect(segments.map((s) => s.beat)).toEqual([0.5, 1, 2]);
    expect(segments.map((s) => s.tieTo)).toEqual([true, true, false]);
    expect(segments.map((s) => s.tieFrom)).toEqual([false, true, true]);
  });

  it("splits a syncopated rest without ties", () => {
    const segments = engrave([note({ id: 4, beat: 0.5, beats: 1.5, rest: true })]);

    expect(segments).toHaveLength(2);
    expect(segments.every((s) => !s.tieFrom && !s.tieTo)).toBe(true);
  });

  it("keeps the original rhythm untouched for scoring", () => {
    const notes = [note({ id: 5, beat: 0.5, beats: 1.5 })];
    const segments = engrave(notes);

    expect(notes[0].beats).toBe(1.5);
    expect(segments).toHaveLength(2);
  });
});

describe("beaming", () => {
  it("beams adjacent eighths inside one beat", () => {
    const groups = beamGroups(
      engrave([
        note({ id: 1, beat: 4, beats: 0.5 }),
        note({ id: 2, beat: 4.5, beats: 0.5 }),
        note({ id: 3, beat: 5, beats: 0.5 }),
        note({ id: 4, beat: 6, beats: 1 }),
        note({ id: 5, beat: 7, beats: 0.5 }),
        note({ id: 6, beat: 7.5, beats: 0.5 }),
      ]),
    );

    expect(groups).toHaveLength(2);
    expect(groups[0].map((n) => n.beat)).toEqual([4, 4.5, 5]);
    expect(groups[1].map((n) => n.beat)).toEqual([7, 7.5]);
  });

  it("never beams a lone eighth", () => {
    const groups = beamGroups(
      engrave([
        note({ beat: 0, beats: 0.5 }),
        note({ beat: 1, beats: 0.5 }),
        note({ beat: 2, beats: 0.5 }),
      ]),
    );
    expect(groups).toHaveLength(0);
  });

  it("beams adjacent eighths across a beat inside the half-bar", () => {
    const groups = beamGroups(
      engrave([
        note({ beat: 0.5, beats: 0.5 }),
        note({ beat: 1, beats: 0.5 }),
      ]),
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].map((n) => n.beat)).toEqual([0.5, 1]);
  });

  it("does not beam across the half-bar", () => {
    const groups = beamGroups(
      engrave([
        note({ beat: 1.5, beats: 0.5 }),
        note({ beat: 2, beats: 0.5 }),
      ]),
    );
    expect(groups).toHaveLength(0);
  });

  it("does not beam across a rest", () => {
    const groups = beamGroups(
      engrave([
        note({ beat: 0, beats: 0.5 }),
        note({ beat: 0.5, beats: 0.5, rest: true }),
        note({ beat: 1, beats: 0.5 }),
        note({ beat: 1.5, beats: 0.5 }),
      ]),
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].map((n) => n.beat)).toEqual([1, 1.5]);
  });

  it("beams a syncopated pair within the half-bar", () => {
    const groups = beamGroups(
      engrave([
        note({ beat: 0.5, beats: 0.5 }),
        note({ beat: 1, beats: 0.5 }),
        note({ beat: 1.5, beats: 0.5 }),
      ]),
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].map((n) => n.beat)).toEqual([0.5, 1, 1.5]);
  });
});
