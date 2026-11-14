import type { Game } from "./engine";
import { staffY } from "./layout";
import { drawScore } from "./score";
import type { MeterId, StaffMode } from "./types";
import { WORLD } from "./world";

const INK = "#161226";
const MUSIC_SIZE = 72;
const MUSIC_FONT = '"Bravura", "Bravura Text", serif';

const GLYPH = {
  trebleClef: "\uE050",
  percussionClef: "\uE069",
  time: {
    "2": "\uE082",
    "3": "\uE083",
    "4": "\uE084",
    "6": "\uE086",
    "8": "\uE088",
  } as Record<string, string>,
};

export function drawNotation(
  ctx: CanvasRenderingContext2D,
  game: Game,
  counts: boolean,
): void {
  drawSystemStart(ctx, game.meterId, game.staffMode);
  drawScore(ctx, game);
  if (counts) drawCounts(ctx, game);
}

function drawCounts(ctx: CanvasRenderingContext2D, game: Game): void {
  const { meter, meterId } = game;
  ctx.save();
  ctx.beginPath();
  ctx.rect(134, 0, WORLD.width - 134, WORLD.height);
  ctx.clip();
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const y =
    game.staffMode === "rhythm"
      ? staffY(4, "rhythm") + 38
      : staffY(0, "treble") + 14;

  for (const note of game.engraved) {
    const x =
      WORLD.birdX + (note.beat - game.beatsElapsed) * meter.pxPerQuarter + 9;
    if (x < 128 || x > WORLD.width - 8) continue;

    const relative = note.beat - meter.preRollQuarters;
    const inBar =
      ((relative % meter.quartersPerBar) + meter.quartersPerBar) %
      meter.quartersPerBar;

    let label = "";
    let onBeat = false;

    if (meterId === "6/8") {
      const eighthNum = Math.round(inBar * 2) + 1; // 1..6
      label = String(eighthNum);
      onBeat = eighthNum === 1 || eighthNum === 4;
    } else if (note.tupletGroup) {
      const beatNum = Math.floor(inBar + 1e-4) + 1;
      const frac = inBar - Math.floor(inBar + 1e-4);
      if (frac < 0.1) {
        label = String(beatNum);
        onBeat = true;
      } else if (frac < 0.5) {
        label = "trip";
      } else {
        label = "let";
      }
    } else {
      const beatNum = Math.floor(inBar + 1e-4) + 1;
      const offset = inBar - Math.floor(inBar + 1e-4);
      if (offset < 0.12 || offset > 0.88) {
        label = String(beatNum);
        onBeat = true;
      } else if (offset < 0.37) {
        label = "e";
      } else if (offset < 0.63) {
        label = "+";
      } else {
        label = "a";
      }
    }

    ctx.font = onBeat
      ? '800 12px "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif'
      : '700 10px "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = onBeat ? "rgba(22, 18, 38, 0.72)" : "rgba(61, 74, 148, 0.85)";
    ctx.fillText(label, x, y);
  }

  ctx.restore();
}

export function drawSystemStart(
  ctx: CanvasRenderingContext2D,
  meterId: MeterId,
  staffMode: StaffMode,
): void {
  ctx.save();
  ctx.fillStyle = INK;
  ctx.font = `${MUSIC_SIZE}px ${MUSIC_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  if (staffMode === "rhythm") {
    ctx.fillText(GLYPH.percussionClef, 52, staffY(4, "rhythm"));
  } else {
    ctx.fillText(GLYPH.trebleClef, 50, staffY(2, "treble"));
  }

  const [num, den] = meterId.split("/");
  const topY = staffMode === "rhythm" ? staffY(4, "rhythm") - 18 : staffY(6, "treble");
  const botY = staffMode === "rhythm" ? staffY(4, "rhythm") + 18 : staffY(2, "treble");
  ctx.fillText(GLYPH.time[num] ?? GLYPH.time["4"], 98, topY);
  ctx.fillText(GLYPH.time[den] ?? GLYPH.time["4"], 98, botY);

  const lineTop = staffMode === "rhythm" ? staffY(4, "rhythm") - 36 : staffY(8, "treble");
  const lineBot = staffMode === "rhythm" ? staffY(4, "rhythm") + 36 : staffY(0, "treble");
  ctx.fillRect(122, lineTop, 3, lineBot - lineTop);
  ctx.restore();
}
