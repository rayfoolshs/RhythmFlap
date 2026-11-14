import { Beam, Dot, Formatter, Renderer, Stave, StaveNote, StaveTie, Tuplet, Voice } from "vexflow";
import type { Game } from "./engine";
import { staffY } from "./layout";
import {
  beamGroups,
  groupStemDirection,
  stemDirection,
  type EngravedNote,
} from "./rhythm";
import { WORLD } from "./world";

const INK = "#161226";
const SPACE = 18;
const SCALE = SPACE / 10;
const PAD = 70;
const NOTE_OFFSET = 9;
const KEYS = ["e/4", "f/4", "g/4", "a/4", "b/4", "c/5", "d/5", "e/5", "f/5"];

interface DurationSpec {
  code: string;
  dotted: boolean;
}

function durationFor(beats: number): DurationSpec {
  if (beats <= 0.3) return { code: "16", dotted: false };
  if (beats <= 0.42) return { code: "8", dotted: false }; // Triplet eighth (0.333)
  if (beats <= 0.75) return { code: "8", dotted: false };
  if (beats <= 1.25) return { code: "4", dotted: false };
  if (beats <= 1.75) return { code: "4", dotted: true };
  if (beats <= 2.25) return { code: "2", dotted: false };
  if (beats <= 3.5) return { code: "2", dotted: true };
  return { code: "1", dotted: false };
}

const cache = new Map<number, HTMLCanvasElement>();
let cachedGame: Game | null = null;

function buildBar(game: Game, barIndex: number): HTMLCanvasElement {
  const { meter, staffMode } = game;
  const barWidth = meter.quartersPerBar * meter.pxPerQuarter;
  const canvas = document.createElement("canvas");
  const width = barWidth + PAD * 2;
  const height = WORLD.height;

  const renderer = new Renderer(canvas, Renderer.Backends.CANVAS);
  const ctx = renderer.getContext();
  (ctx as unknown as { resize(w: number, h: number, dpr?: number): void }).resize(
    width,
    height,
    1,
  );
  ctx.scale(SCALE, SCALE);
  ctx.setFillStyle(INK);
  ctx.setStrokeStyle(INK);

  const startBeat = meter.preRollQuarters + barIndex * meter.quartersPerBar;
  const notes = game.engraved.filter(
    (note) =>
      note.beat >= startBeat - 1e-4 &&
      note.beat < startBeat + meter.quartersPerBar - 1e-4,
  );
  if (notes.length === 0) return canvas;

  const stave = new Stave(PAD / SCALE, 0, barWidth / SCALE);
  const topOffset = stave.getYForLine(0);
  const staveY =
    staffMode === "rhythm"
      ? staffY(4, "rhythm") / SCALE - stave.getYForLine(2)
      : staffY(8, "treble") / SCALE - topOffset;
  const placed = new Stave(PAD / SCALE, staveY, barWidth / SCALE);

  const groups = beamGroups(notes, game.meterId);
  const directions = new Map<string, number>();
  for (const note of notes) {
    const step = staffMode === "rhythm" ? 4 : note.step;
    directions.set(note.key, stemDirection(step));
  }
  for (const group of groups) {
    if (staffMode === "rhythm") {
      for (const note of group) directions.set(note.key, 1); // Stems up on 1-line rhythm staff
    } else {
      const direction = groupStemDirection(group);
      for (const note of group) directions.set(note.key, direction);
    }
  }
  if (staffMode === "rhythm") {
    for (const note of notes) directions.set(note.key, 1);
  }

  const vexNotes = notes.map((note) => {
    const { code, dotted } = durationFor(note.beats);
    const key = staffMode === "rhythm" ? "b/4" : KEYS[note.step];
    const vexNote = new StaveNote({
      keys: [key],
      duration: code + (note.rest ? "r" : ""),
      clef: "treble",
    });
    vexNote.setStemDirection(directions.get(note.key) ?? stemDirection(note.step));
    if (dotted) Dot.buildAndAttach([vexNote], { all: true });
    return vexNote;
  });

  // Build tuplets before Voice formatting
  const tuplets: Tuplet[] = [];
  const tupletMap = new Map<number, StaveNote[]>();
  notes.forEach((note, idx) => {
    if (!note.tupletGroup) return;
    const arr = tupletMap.get(note.tupletGroup) ?? [];
    arr.push(vexNotes[idx]);
    tupletMap.set(note.tupletGroup, arr);
  });
  for (const tNotes of tupletMap.values()) {
    if (tNotes.length >= 2) {
      tuplets.push(new Tuplet(tNotes));
    }
  }

  const voice = new Voice({
    numBeats: meter.numBeats,
    beatValue: meter.beatValue,
  }).setMode(Voice.Mode.SOFT);
  voice.addTickables(vexNotes);
  new Formatter().joinVoices([voice]).format([voice], barWidth / SCALE);

  notes.forEach((note, index) => {
    const vexNote = vexNotes[index];
    vexNote.setStave(placed);
    vexNote.setXShift(0);
    const desired =
      (PAD + (note.beat - startBeat) * meter.pxPerQuarter + NOTE_OFFSET) / SCALE;
    const context = vexNote.getTickContext();
    context.setX(0);
    const base = vexNote.getAbsoluteX();
    context.setX(desired - base);
  });

  const byKey = new Map<string, number>();
  notes.forEach((note, index) => byKey.set(note.key, index));
  for (const group of groups) {
    const stems = group
      .map((note) => byKey.get(note.key))
      .filter((index): index is number => index !== undefined)
      .map((index) => vexNotes[index]);
    if (stems.length > 1) new Beam(stems).setContext(ctx).draw();
  }

  for (let i = 0; i < notes.length - 1; i += 1) {
    const from = notes[i];
    const to = notes[i + 1];
    if (from.sourceId !== to.sourceId || !from.tieTo || !to.tieFrom) continue;
    new StaveTie({
      firstNote: vexNotes[i],
      lastNote: vexNotes[i + 1],
      firstIndexes: [0],
      lastIndexes: [0],
    })
      .setContext(ctx)
      .draw();
  }

  for (const note of vexNotes) note.setContext(ctx).draw();
  for (const tuplet of tuplets) tuplet.setContext(ctx).draw();

  return canvas;
}

function canvasFor(game: Game, barIndex: number): HTMLCanvasElement {
  const cached = cache.get(barIndex);
  if (cached) return cached;
  const canvas = buildBar(game, barIndex);
  cache.set(barIndex, canvas);
  return canvas;
}

export function drawScore(ctx: CanvasRenderingContext2D, game: Game): void {
  if (cachedGame !== game) {
    cache.clear();
    cachedGame = game;
  }

  const { meter } = game;
  const barWidth = meter.quartersPerBar * meter.pxPerQuarter;
  const currentBar = Math.floor(
    (game.beatsElapsed - meter.preRollQuarters) / meter.quartersPerBar,
  );

  ctx.save();
  ctx.beginPath();
  ctx.rect(134, 0, WORLD.width - 134, WORLD.height);
  ctx.clip();

  for (let bar = currentBar - 1; bar <= currentBar + 8; bar += 1) {
    if (bar < 0 || bar >= game.barCount) continue;
    const startBeat = meter.preRollQuarters + bar * meter.quartersPerBar;
    const x =
      WORLD.birdX + (startBeat - game.beatsElapsed) * meter.pxPerQuarter - PAD;
    if (x > WORLD.width || x + barWidth + PAD * 2 < 0) continue;
    ctx.drawImage(canvasFor(game, bar), x, 0);
  }

  ctx.restore();

  for (const key of cache.keys()) {
    if (key < currentBar - 2) cache.delete(key);
  }
}

export type { EngravedNote };
