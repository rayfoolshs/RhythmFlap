import { Beam, Dot, Formatter, Renderer, Stave, StaveNote, StaveTie, Voice } from "vexflow";
import type { Game } from "./engine";
import { PX_PER_BEAT, PRE_ROLL_BEATS, staffY } from "./layout";
import { beamGroups, type EngravedNote } from "./rhythm";
import { WORLD } from "./world";

const INK = "#1e293b";
const SPACE = 18;
const SCALE = SPACE / 10;
const PAD = 70;
const BAR_BEATS = 4;
const BAR_WIDTH = BAR_BEATS * PX_PER_BEAT;
const NOTE_OFFSET = 9;

const KEYS = ["e/4", "f/4", "g/4", "a/4", "b/4", "c/5", "d/5", "e/5", "f/5"];

interface Duration {
  code: string;
  dotted: boolean;
}

function durationFor(beats: number): Duration {
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
  const canvas = document.createElement("canvas");
  const width = BAR_WIDTH + PAD * 2;
  const height = WORLD.height;

  const renderer = new Renderer(canvas, Renderer.Backends.CANVAS);
  const ctx = renderer.getContext();
  // Render at 1:1 world pixels; the main canvas handles the device scale.
  (ctx as unknown as { resize(w: number, h: number, dpr?: number): void }).resize(
    width,
    height,
    1,
  );
  ctx.scale(SCALE, SCALE);
  ctx.setFillStyle(INK);
  ctx.setStrokeStyle(INK);

  const startBeat = PRE_ROLL_BEATS + barIndex * BAR_BEATS;
  const notes = game.engraved.filter(
    (note) => note.beat >= startBeat - 1e-6 && note.beat < startBeat + BAR_BEATS - 1e-6,
  );

  if (notes.length === 0) return canvas;

  const stave = new Stave(PAD / SCALE, 0, BAR_WIDTH / SCALE);
  // VexFlow's stave y is not the top line; shift so line 0 lands on ours.
  const topOffset = stave.getYForLine(0);
  const placed = new Stave(PAD / SCALE, staffY(8) / SCALE - topOffset, BAR_WIDTH / SCALE);

  const vexNotes = notes.map((note) => {
    const { code, dotted } = durationFor(note.beats);
    const vexNote = new StaveNote({
      keys: [KEYS[note.step]],
      duration: code + (note.rest ? "r" : ""),
      clef: "treble",
    });
    if (dotted) Dot.buildAndAttach([vexNote], { all: true });
    return vexNote;
  });

  const voice = new Voice({ numBeats: 4, beatValue: 4 }).setMode(Voice.Mode.SOFT);
  voice.addTickables(vexNotes);
  new Formatter().joinVoices([voice]).format([voice], BAR_WIDTH / SCALE);

  notes.forEach((note, index) => {
    const vexNote = vexNotes[index];
    vexNote.setStave(placed);
    // Modifiers (dots) can shift a note; reset so every onset sits on its beat.
    vexNote.setXShift(0);
    const desired = (PAD + (note.beat - startBeat) * PX_PER_BEAT + NOTE_OFFSET) / SCALE;
    const context = vexNote.getTickContext();
    context.setX(0);
    const base = vexNote.getAbsoluteX();
    context.setX(desired - base);
  });

  const byKey = new Map<string, number>();
  notes.forEach((note, index) => byKey.set(note.key, index));

  for (const group of beamGroups(notes)) {
    const stems = group
      .map((note) => byKey.get(note.key))
      .filter((index): index is number => index !== undefined)
      .map((index) => vexNotes[index]);
    if (stems.length > 1) new Beam(stems).setContext(ctx).draw();
  }

  // VexFlow ties must be drawn while the notes are still pre-formatted.
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

  const currentBar = Math.floor((game.beatsElapsed - PRE_ROLL_BEATS) / BAR_BEATS);

  // Keep scrolling notes behind the fixed clef and time signature.
  ctx.save();
  ctx.beginPath();
  ctx.rect(134, 0, WORLD.width - 134, WORLD.height);
  ctx.clip();

  for (let bar = currentBar - 1; bar <= currentBar + 8; bar += 1) {
    if (bar < 0) continue;
    const startBeat = PRE_ROLL_BEATS + bar * BAR_BEATS;
    const x = WORLD.birdX + (startBeat - game.beatsElapsed) * PX_PER_BEAT - PAD;
    if (x > WORLD.width || x + BAR_WIDTH + PAD * 2 < 0) continue;
    ctx.drawImage(canvasFor(game, bar), x, 0);
  }

  ctx.restore();

  for (const key of cache.keys()) {
    if (key < currentBar - 2) cache.delete(key);
  }
}

/** Ties join the pieces of a note split across a beat. */
export function drawTies(ctx: CanvasRenderingContext2D, game: Game): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.9;

  for (let i = 0; i < game.engraved.length - 1; i += 1) {
    const from = game.engraved[i];
    const to = game.engraved[i + 1];
    if (from.sourceId !== to.sourceId || !from.tieTo || !to.tieFrom) continue;

    const x1 = WORLD.birdX + (from.beat - game.beatsElapsed) * PX_PER_BEAT + NOTE_OFFSET + 12;
    const x2 = WORLD.birdX + (to.beat - game.beatsElapsed) * PX_PER_BEAT + NOTE_OFFSET - 12;
    if (x2 - x1 < 6) continue;

    const y = staffY(from.step);
    const direction = y > staffY(4) ? 1 : -1;
    const tieY = y + 10 * direction;

    ctx.beginPath();
    ctx.moveTo(x1, tieY);
    ctx.quadraticCurveTo((x1 + x2) / 2, tieY + 13 * direction, x2, tieY);
    ctx.stroke();
  }
}

export type { EngravedNote };
