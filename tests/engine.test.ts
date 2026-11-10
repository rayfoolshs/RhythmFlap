import { describe, expect, it } from "vitest";
import type { Sound } from "../src/game/audio";
import { Game } from "../src/game/engine";
import { birdPerchY, PX_PER_BEAT, staffY } from "../src/game/layout";
import { TIMING } from "../src/game/scoring";
import { tierById } from "../src/game/tiers";
import type { NoteEvent } from "../src/game/types";

function fakeSound(): Sound {
  return {
    enabled: true,
    ensure: () => null,
    now: () => 0,
    click: () => undefined,
    hit: () => undefined,
    flap: () => undefined,
    miss: () => undefined,
    subdivision: () => undefined,
    playNote: () => undefined,
    startNote: () => undefined,
    stopNote: () => undefined,
    crash: () => undefined,
    stop: () => undefined,
  } as unknown as Sound;
}

function newGame(seed = "test-course", tierId = 1): Game {
  return new Game({ tier: tierById(tierId), seed, sound: fakeSound() });
}

function playableNotes(game: Game): NoteEvent[] {
  return game.notes.filter((note) => !note.rest);
}

/** Move the clock to a note's beat and tap, all in the current tempo. */
function tapAt(game: Game, beat: number): void {
  game.beatsElapsed = beat;
  game.press();
}

describe("game", () => {
  it("waits above the staff before the run starts", () => {
    const game = newGame();
    expect(game.phase).toBe("ready");
    expect(game.bird.y).toBeCloseTo(birdPerchY(4), 5);
    // The flight band clears the top line.
    expect(game.bird.y).toBeLessThan(staffY(8));

    game.start();
    expect(game.phase).toBe("running");
    expect(game.hits).toBe(0);
    expect(game.misses).toBe(0);
  });

  it("starts at the metronome tempo when one is chosen", () => {
    const game = new Game({
      tier: tierById(1),
      seed: "tempo",
      sound: fakeSound(),
      startBpm: 120,
    });
    expect(game.bpm).toBe(120);
  });

  it("generates the same course for the same seed", () => {
    expect(newGame("same").notes).toEqual(newGame("same").notes);
    expect(newGame("one").notes).not.toEqual(newGame("two").notes);
  });

  it("scores a tap on the beat as PERFECT", () => {
    const game = newGame();
    game.start();
    const first = playableNotes(game)[0];

    tapAt(game, first.beat);

    expect(game.hits).toBe(1);
    expect(game.combo).toBe(1);
    expect(game.score).toBe(100);
    expect(game.hitIds.has(first.id)).toBe(true);
  });

  it("scores a slightly late tap as GOOD", () => {
    const game = newGame();
    game.start();
    const first = playableNotes(game)[0];
    const lateBeats = ((TIMING.perfect + TIMING.good) / 2 / 60) * game.bpm;

    tapAt(game, first.beat + lateBeats);

    expect(game.score).toBe(50);
    expect(game.combo).toBe(1);
  });

  it("scores a very late tap as OK", () => {
    const game = newGame();
    game.start();
    const first = playableNotes(game)[0];
    const lateBeats = ((TIMING.good + TIMING.ok) / 2 / 60) * game.bpm;

    tapAt(game, first.beat + lateBeats);

    expect(game.score).toBe(20);
  });

  it("does not score the same note twice", () => {
    const game = newGame();
    game.start();
    const first = playableNotes(game)[0];

    tapAt(game, first.beat);
    tapAt(game, first.beat);

    expect(game.hits).toBe(1);
    expect(game.misses).toBe(1);
    expect(game.combo).toBe(0);
  });

  it("counts a tap with no note nearby as a miss", () => {
    const game = newGame();
    game.start();
    const first = playableNotes(game)[0];

    tapAt(game, first.beat - 2);

    expect(game.hits).toBe(0);
    expect(game.misses).toBe(1);
    expect(game.score).toBe(0);
  });

  it("does not target rests", () => {
    const game = newGame("rest-seed", 1);
    game.start();
    const rest = game.notes.find((note) => note.rest);
    expect(rest).toBeDefined();

    tapAt(game, rest!.beat);

    expect(game.hitIds.has(rest!.id)).toBe(false);
  });

  it("counts an ignored note as a miss once it passes", () => {
    const game = newGame();
    game.start();
    const first = playableNotes(game)[0];
    const secondsPerBeat = 60 / game.bpm;

    game.beatsElapsed = first.beat + (TIMING.ok + 0.1) / secondsPerBeat;
    game.update(1 / 60);

    expect(game.missedIds.has(first.id)).toBe(true);
    expect(game.misses).toBeGreaterThanOrEqual(1);
  });

  it("keeps going after mistakes and records them", () => {
    const game = newGame();
    game.start();
    const notes = playableNotes(game);

    tapAt(game, notes[0].beat - 2);
    tapAt(game, notes[0].beat - 2);
    tapAt(game, notes[0].beat - 2);

    expect(game.phase).toBe("running");
    expect(game.misses).toBe(3);
  });

  it("finishes after the eight-bar exercise", () => {
    const game = newGame();
    let ended = 0;
    game.onEnd = () => {
      ended += 1;
    };
    game.start();

    game.beatsElapsed = 1000;
    game.update(1 / 60);

    expect(game.phase).toBe("crashed");
    expect(ended).toBe(1);
  });

  it("reports accuracy across hits and misses", () => {
    const game = newGame("accuracy", 4);
    game.start();
    const first = playableNotes(game)[0];

    game.beatsElapsed = first.beat;
    game.press();
    game.beatsElapsed = first.beat + first.beats;
    game.release();
    expect(game.accuracy).toBe(100);

    game.beatsElapsed = 100000;
    game.press();
    game.release();
    expect(game.accuracy).toBe(50);
  });

  it("lands on the perch on the beat, not before", () => {
    const game = newGame();
    game.start();
    const first = playableNotes(game)[0];

    // A fifth of a beat out the bird is still in the air.
    while (game.beatsElapsed < first.beat - 0.2) game.update(1 / 60);
    expect(Math.abs(game.bird.y - birdPerchY(first.step))).toBeGreaterThan(6);

    // On the beat it is down on that note's perch.
    while (game.beatsElapsed < first.beat) game.update(1 / 60);
    expect(Math.abs(game.bird.y - birdPerchY(first.step))).toBeLessThan(4);
  });

  it("arcs above both perches between notes instead of gliding", () => {
    const game = newGame();
    game.start();
    const [first, second] = playableNotes(game);

    let peak = Number.POSITIVE_INFINITY;
    while (game.beatsElapsed < second.beat) {
      peak = Math.min(peak, game.bird.y);
      game.update(1 / 60);
    }

    // A glide between two perches never rises above both of them.
    const lowest = Math.max(birdPerchY(first.step), birdPerchY(second.step));
    expect(peak).toBeLessThan(lowest - 8);
  });

  it("ramps the tempo every eight hits", () => {
    const game = newGame();
    game.start();
    const startBpm = game.bpm;
    const notes = playableNotes(game).slice(0, 8);

    for (const note of notes) tapAt(game, note.beat);

    expect(game.hits).toBe(8);
    expect(game.bpm).toBe(startBpm + 5);
  });

  it("sustains a long note and rewards a clean release", () => {
    const game = newGame("holds", 4);
    game.start();
    const first = playableNotes(game).find((note) => note.beats >= 1);
    expect(first).toBeDefined();

    game.beatsElapsed = first!.beat;
    game.press();
    expect(game.hits).toBe(1);

    game.beatsElapsed = first!.beat + first!.beats;
    game.release();

    expect(game.misses).toBe(0);
    expect(game.score).toBe(125);
  });

  it("penalises releasing a sustained note early", () => {
    const game = newGame("holds", 4);
    game.start();
    const first = playableNotes(game).find((note) => note.beats >= 1);

    game.beatsElapsed = first!.beat;
    game.press();
    game.release();

    expect(game.misses).toBe(1);
    expect(game.combo).toBe(0);
  });

  it("penalises holding the key through a rest", () => {
    const game = newGame("rest-hold", 1);
    game.start();
    const rest = game.notes.find((note) => note.rest);
    expect(rest).toBeDefined();

    game.press();
    const afterPress = game.misses;

    // Pretend every earlier note was already played, so only the rest is judged.
    for (const note of game.notes) {
      if (note.beat < rest!.beat) game.hitIds.add(note.id);
    }
    game.beatsElapsed = rest!.beat + rest!.beats / 2;
    game.update(1 / 60);

    expect(game.misses).toBe(afterPress + 1);
  });

  it("pauses without advancing the beat clock", () => {
    const game = newGame();
    game.start();
    game.update(1 / 60);
    const beat = game.beatsElapsed;

    game.pause();
    game.update(1 / 60);
    expect(game.phase).toBe("paused");
    expect(game.beatsElapsed).toBe(beat);

    game.resume();
    game.update(1 / 60);
    expect(game.beatsElapsed).toBeGreaterThan(beat);
  });

  it("places notes one beat apart on screen", () => {
    const game = newGame();
    const [first, second] = game.notes;
    expect((game.screenX(second) - game.screenX(first)) / PX_PER_BEAT).toBeCloseTo(
      second.beat - first.beat,
      6,
    );
  });
});
