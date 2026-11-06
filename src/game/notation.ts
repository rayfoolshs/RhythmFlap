import type { Game } from "./engine";
import { PX_PER_BEAT, PRE_ROLL_BEATS, staffY } from "./layout";
import { drawScore } from "./score";
import { WORLD } from "./world";

const INK = "#1e293b";
const MUSIC_SIZE = 72;
const MUSIC_FONT = '"Bravura", "Bravura Text", serif';

const GLYPH = {
  clef: "\uE050",
  timeFour: "\uE084",
};

export type NoteShape =
  | "eighth"
  | "quarter"
  | "dottedQuarter"
  | "half"
  | "dottedHalf"
  | "whole";

/** Map a beat duration to the note value that should be engraved. */
export function noteShape(beats: number): NoteShape {
  if (Math.abs(beats - 0.5) < 1e-6) return "eighth";
  if (Math.abs(beats - 1) < 1e-6) return "quarter";
  if (Math.abs(beats - 1.5) < 1e-6) return "dottedQuarter";
  if (Math.abs(beats - 2) < 1e-6) return "half";
  if (Math.abs(beats - 3) < 1e-6) return "dottedHalf";
  return "whole";
}

export function isFilled(shape: NoteShape): boolean {
  return shape === "eighth" || shape === "quarter" || shape === "dottedQuarter";
}

export function isDotted(shape: NoteShape): boolean {
  return shape === "dottedQuarter" || shape === "dottedHalf";
}

export function hasStem(shape: NoteShape): boolean {
  return shape !== "whole";
}

export function drawNotation(
  ctx: CanvasRenderingContext2D,
  game: Game,
  counts: boolean,
): void {
  drawSystemStart(ctx);
  drawScore(ctx, game);
  if (counts) drawCounts(ctx, game);
}

/** Count syllables under each rhythm event, beneath the stave. */
function drawCounts(ctx: CanvasRenderingContext2D, game: Game): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(134, 0, WORLD.width - 134, WORLD.height);
  ctx.clip();
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const y = staffY(0) + 14;

  for (const note of game.engraved) {
    const x = WORLD.birdX + (note.beat - game.beatsElapsed) * PX_PER_BEAT + 9;
    if (x < 128 || x > WORLD.width - 8) continue;

    const relative = note.beat - PRE_ROLL_BEATS;
    const inBar = ((relative % 4) + 4) % 4;
    const beat = Math.floor(inBar) + 1;
    const offset = inBar - Math.floor(inBar);
    const syllable =
      offset < 0.125 || offset > 0.875
        ? ""
        : offset < 0.375
          ? "e"
          : offset < 0.625
            ? "&"
            : "a";

    const onBeat = syllable === "";
    ctx.font = onBeat
      ? "800 12px ui-sans-serif, system-ui, -apple-system, sans-serif"
      : "700 10px ui-sans-serif, system-ui, -apple-system, sans-serif";
    ctx.fillStyle = onBeat ? "rgba(30, 41, 59, 0.62)" : "rgba(249, 115, 22, 0.72)";
    const label = onBeat ? String(beat) : syllable === "&" ? "+" : syllable;
    ctx.fillText(label, x, y);
  }

  ctx.restore();
}

function drawSystemStart(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.fillStyle = INK;
  ctx.font = `${MUSIC_SIZE}px ${MUSIC_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // Treble clef: the glyph origin sits on the G line.
  ctx.fillText(GLYPH.clef, 50, staffY(2));

  // 4/4: each glyph is two staff spaces tall, stacked in the staff halves.
  ctx.fillText(GLYPH.timeFour, 98, staffY(6));
  ctx.fillText(GLYPH.timeFour, 98, staffY(2));

  ctx.fillRect(122, staffY(8), 3, staffY(0) - staffY(8));
  ctx.restore();
}
