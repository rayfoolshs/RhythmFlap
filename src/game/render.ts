import type { Game } from "./engine";
import { birdPerchY, staffY } from "./layout";
import { drawNotation, drawSystemStart } from "./notation";
import { METERS } from "./tiers";
import type { BirdState, MeterId, StaffMode } from "./types";
import { WORLD } from "./world";

const PAGE = "#f5f6fa";
const CARD_FILL = "#ffffff";
const INK = "#161226";
const MUTED = "#6b6f80";
const BRAND = "#202b64";
const BRAND2 = "#3d4a94";
const LIME = "#c1d52d";
const GOOD = "#15915b";
const AMBER = "#c97a08";
const BAD = "#c23b52";
const TEAL = "#0d9488";
const STAFF = "#c9c6dd";

const CARD = { x: 12, y: 132, width: 936, height: 280, radius: 18 };
const FEET = 51;

export function render(
  canvas: HTMLCanvasElement,
  game: Game | null,
  time: number,
  counts: boolean,
  previewMeter: MeterId,
  previewStaff: StaffMode,
): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cssWidth = canvas.clientWidth || WORLD.width;
  const cssHeight = canvas.clientHeight || WORLD.height;
  const pixelWidth = Math.round(cssWidth * dpr);
  const pixelHeight = Math.round(cssHeight * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const scale = Math.min(cssWidth / WORLD.width, cssHeight / WORLD.height);
  const offsetX = ((cssWidth - WORLD.width * scale) / 2) * dpr;
  const offsetY = ((cssHeight - WORLD.height * scale) / 2) * dpr;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#eef1f9";
  ctx.fillRect(0, 0, pixelWidth, pixelHeight);
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, offsetX, offsetY);

  drawWorld(ctx, game, time, counts, previewMeter, previewStaff);
}

function drawWorld(
  ctx: CanvasRenderingContext2D,
  game: Game | null,
  time: number,
  counts: boolean,
  previewMeter: MeterId,
  previewStaff: StaffMode,
): void {
  const activeMeter = game ? game.meterId : previewMeter;
  const activeStaff = game ? game.staffMode : previewStaff;

  ctx.save();
  ctx.fillStyle = PAGE;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  drawCard(ctx);

  ctx.save();
  cardPath(ctx);
  ctx.clip();

  drawStaff(ctx, activeStaff);
  drawHitLine(ctx, game, activeStaff);

  if (game) {
    drawSustainRails(ctx, game);
    drawBarLines(ctx, game, time, activeMeter, activeStaff);
    drawNotation(ctx, game, counts);
    drawOutcomeMarkers(ctx, game);
    drawCountIn(ctx, game);
    const bob = game.phase === "ready" ? Math.sin(time * 3) * 4.5 : 0;
    drawBird(
      ctx,
      game.bird,
      bob,
      game.phase === "finished",
      game.flash,
      game.lastStep,
      activeStaff,
    );
    drawPopups(ctx, game);
  } else {
    drawSystemStart(ctx, activeMeter, activeStaff);
    drawBarLines(ctx, null, time, activeMeter, activeStaff);
    drawMenuScene(ctx, time, activeStaff);
  }

  ctx.restore();
  ctx.restore();
}

function cardPath(ctx: CanvasRenderingContext2D): void {
  const { x, y, width, height, radius } = CARD;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arcTo(x + width, y, x + width, y + radius, radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  ctx.lineTo(x + radius, y + height);
  ctx.arcTo(x, y + height, x, y + height - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

function drawCard(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.shadowColor = "rgba(20, 10, 60, 0.14)";
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = CARD_FILL;
  cardPath(ctx);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "rgba(22, 18, 38, 0.10)";
  ctx.lineWidth = 1;
  cardPath(ctx);
  ctx.stroke();

  ctx.save();
  cardPath(ctx);
  ctx.clip();
  ctx.fillStyle = LIME;
  ctx.fillRect(CARD.x, CARD.y, CARD.width, 4);
  ctx.restore();
}

function drawStaff(ctx: CanvasRenderingContext2D, staffMode: StaffMode): void {
  if (staffMode === "rhythm") {
    const y = staffY(4, "rhythm");
    ctx.strokeStyle = "#b4b0cc";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD.width, y);
    ctx.stroke();
    return;
  }

  ctx.strokeStyle = STAFF;
  ctx.lineWidth = 1.2;
  for (let step = 0; step <= 8; step += 2) {
    const y = staffY(step, "treble");
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD.width, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(61, 74, 148, 0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, staffY(4, "treble"));
  ctx.lineTo(WORLD.width, staffY(4, "treble"));
  ctx.stroke();
}

function drawHitLine(
  ctx: CanvasRenderingContext2D,
  game: Game | null,
  staffMode: StaffMode,
): void {
  const x = WORLD.birdX + 9;
  const strength = game?.phase === "running" ? 0.55 : 0.28;
  const top = staffMode === "rhythm" ? staffY(4, "rhythm") - 46 : staffY(8, "treble") - 22;
  const bot = staffMode === "rhythm" ? staffY(4, "rhythm") + 46 : staffY(0, "treble") + 22;

  ctx.save();
  ctx.strokeStyle = `rgba(32, 43, 100, ${strength})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, bot);
  ctx.stroke();

  ctx.fillStyle = `rgba(32, 43, 100, ${strength})`;
  ctx.beginPath();
  ctx.moveTo(x - 5, top);
  ctx.lineTo(x + 5, top);
  ctx.lineTo(x, top + 9);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x - 5, bot);
  ctx.lineTo(x + 5, bot);
  ctx.lineTo(x, bot - 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Draw sustain rails behind long notes (> eighth) and fill them live while holding. */
function drawSustainRails(ctx: CanvasRenderingContext2D, game: Game): void {
  const { meter } = game;
  ctx.save();
  ctx.beginPath();
  ctx.rect(134, 0, WORLD.width - 134, WORLD.height);
  ctx.clip();

  for (const note of game.notes) {
    if (note.rest || note.beats <= 0.501) continue;
    const x1 = WORLD.birdX + (note.beat - game.beatsElapsed) * meter.pxPerQuarter + 9;
    const x2 =
      WORLD.birdX + (note.beat + note.beats - game.beatsElapsed) * meter.pxPerQuarter + 3;
    if (x2 < 134 || x1 > WORLD.width) continue;

    const y = staffY(note.step, game.staffMode);
    const out = game.outcomes.get(note.id);
    const isHolding = game.hold?.noteId === note.id;

    // Base rail
    ctx.strokeStyle =
      out?.grade === "TOO SHORT"
        ? "rgba(194, 59, 82, 0.35)"
        : "rgba(13, 148, 136, 0.2)";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x1 + 6, y);
    ctx.lineTo(x2, y);
    ctx.stroke();

    // Live fill while held or when completed
    if (isHolding || out?.heldComplete) {
      const fillEnd = isHolding
        ? Math.min(x2, WORLD.birdX + 9)
        : x2;
      if (fillEnd > x1 + 6) {
        ctx.strokeStyle = "rgba(13, 148, 136, 0.65)";
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(x1 + 6, y);
        ctx.lineTo(fillEnd, y);
        ctx.stroke();
      }
    }

    // Release tick marker
    ctx.strokeStyle = "rgba(13, 148, 136, 0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x2, y - 7);
    ctx.lineTo(x2, y + 7);
    ctx.stroke();
  }

  ctx.restore();
}

/** Persistent status dots/rings on judged noteheads as they scroll left past the hit line. */
function drawOutcomeMarkers(ctx: CanvasRenderingContext2D, game: Game): void {
  const { meter } = game;
  ctx.save();
  ctx.beginPath();
  ctx.rect(134, 0, WORLD.width - 134, WORLD.height);
  ctx.clip();

  for (const note of game.notes) {
    if (note.rest) continue;
    const out = game.outcomes.get(note.id);
    if (!out) continue;
    const x = WORLD.birdX + (note.beat - game.beatsElapsed) * meter.pxPerQuarter + 9;
    if (x < 134 || x > WORLD.width) continue;
    const y = staffY(note.step, game.staffMode);

    const color =
      out.grade === "PERFECT"
        ? GOOD
        : out.grade === "GOOD"
          ? TEAL
          : out.grade === "OK"
            ? AMBER
            : BAD;

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.92;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

/** Visual 1 · 2 · 3 · 4 count-in before bar 1 arrives at the hit line. */
function drawCountIn(ctx: CanvasRenderingContext2D, game: Game): void {
  if (game.phase !== "running") return;
  const { meter } = game;
  if (game.beatsElapsed >= meter.preRollQuarters) return;

  const pulseIndex = Math.floor(game.beatsElapsed / meter.clickIntervalQuarters) + 1;
  const maxPulses = Math.round(meter.preRollQuarters / meter.clickIntervalQuarters);
  const displayNum = Math.min(maxPulses, Math.max(1, pulseIndex));
  const frac =
    (game.beatsElapsed % meter.clickIntervalQuarters) / meter.clickIntervalQuarters;
  const pop = 1 + Math.max(0, 1 - frac * 3) * 0.18;

  ctx.save();
  ctx.translate(WORLD.birdX + 9, staffY(4, game.staffMode));
  ctx.scale(pop, pop);
  ctx.fillStyle = "rgba(32, 43, 100, 0.92)";
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = '800 22px "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(String(displayNum), 0, 1);

  ctx.font = '700 10px "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = BRAND;
  ctx.fillText("COUNT IN", 0, -34);
  ctx.restore();
}

function drawBarLines(
  ctx: CanvasRenderingContext2D,
  game: Game | null,
  time: number,
  meterId: MeterId,
  staffMode: StaffMode,
): void {
  const meter = METERS[meterId];
  const beatsElapsed = game ? game.beatsElapsed : (time * 1.2) % meter.quartersPerBar;
  const currentBar = Math.floor((beatsElapsed - meter.preRollQuarters) / meter.quartersPerBar);
  const top = staffMode === "rhythm" ? staffY(4, "rhythm") - 30 : staffY(8, "treble");
  const bottom = staffMode === "rhythm" ? staffY(4, "rhythm") + 30 : staffY(0, "treble");

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = '800 11px "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif';

  const maxBars = game ? game.barCount : 8;
  for (let bar = currentBar - 1; bar <= currentBar + 8; bar += 1) {
    if (bar < 0 || bar > maxBars) continue;
    const beat = meter.preRollQuarters + bar * meter.quartersPerBar;
    const x = WORLD.birdX + (beat - beatsElapsed) * meter.pxPerQuarter;
    if (x < 134 || x > WORLD.width + 20) continue;

    ctx.strokeStyle = "rgba(22, 18, 38, 0.45)";
    ctx.lineWidth = bar === maxBars ? 3.2 : 1.8;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();

    if (bar < maxBars && x > 134 && x < WORLD.width - 10) {
      ctx.fillStyle = BRAND;
      const barLabel =
        game?.focusBar !== null && game?.focusBar !== undefined
          ? `Bar ${game.focusBar + 1} (${bar + 1}/4)`
          : String(bar + 1);
      ctx.fillText(barLabel, x + 2, top - 12);
    }
  }

  ctx.restore();
}

function drawBird(
  ctx: CanvasRenderingContext2D,
  bird: BirdState,
  bob: number,
  crashed: boolean,
  flash: number,
  ringStep: number,
  staffMode: StaffMode,
): void {
  const scale = 0.72;
  const perchX = WORLD.birdX + 4;
  const perchY = bird.y + bob;
  const angle = crashed ? 0.35 : Math.max(-0.18, Math.min(0.18, bird.vy / 1200));

  if (flash > 0) {
    const progress = 1 - flash / 0.24;
    ctx.save();
    ctx.strokeStyle = `rgba(21, 145, 91, ${0.6 * (1 - progress)})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(
      WORLD.birdX + 9,
      staffY(ringStep, staffMode),
      13 + progress * 16,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(perchX, perchY - FEET * scale);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.8;
  ctx.beginPath();
  ctx.moveTo(-3, 34);
  ctx.lineTo(-7, 51);
  ctx.moveTo(-7, 51);
  ctx.lineTo(-14, 51);
  ctx.moveTo(9, 34);
  ctx.lineTo(12, 51);
  ctx.moveTo(12, 51);
  ctx.lineTo(19, 51);
  ctx.stroke();

  birdPath(ctx);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.2;
  birdPath(ctx);
  ctx.stroke();

  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-13, 14);
  ctx.quadraticCurveTo(-3, 18, 5, 31);
  ctx.stroke();

  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(3, -5, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function birdPath(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(-13, 0);
  ctx.bezierCurveTo(-13, -12, -7, -14, 0, -14);
  ctx.bezierCurveTo(8, -14, 13, -8, 13, -1);
  ctx.bezierCurveTo(24, -4, 36, -2, 46, 3);
  ctx.bezierCurveTo(48, 5, 47, 8, 43, 7);
  ctx.bezierCurveTo(33, 3, 22, 2, 12, 4);
  ctx.bezierCurveTo(10, 10, 12, 16, 16, 20);
  ctx.bezierCurveTo(24, 30, 16, 38, 4, 38);
  ctx.bezierCurveTo(-10, 38, -20, 30, -20, 18);
  ctx.bezierCurveTo(-20, 8, -17, 2, -13, 0);
  ctx.closePath();
}

function drawPopups(ctx: CanvasRenderingContext2D, game: Game): void {
  ctx.save();
  ctx.textAlign = "center";
  const baseY =
    game.staffMode === "rhythm"
      ? staffY(4, "rhythm") + 58
      : staffY(0, "treble") + 54;

  for (const popup of game.popups) {
    const progress = 1 - popup.life / 0.78;
    const alpha = Math.min(1, popup.life * 2.8);
    const y = baseY - progress * 12;

    ctx.globalAlpha = alpha;
    ctx.font = '800 15px "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle =
      popup.kind === "PERFECT"
        ? GOOD
        : popup.kind === "HELD"
          ? TEAL
          : popup.kind === "GOOD"
            ? BRAND2
            : popup.kind === "OK"
              ? AMBER
              : popup.kind === "MISS"
                ? BAD
                : MUTED;
    ctx.fillText(popup.text, popup.x + 9, y);

    if (popup.subtext) {
      ctx.font = '700 11px "JetBrains Mono", ui-monospace, monospace';
      ctx.fillStyle = popup.kind === "HELD" ? TEAL : MUTED;
      ctx.fillText(popup.subtext, popup.x + 9, y + 16);
    }
  }
  ctx.restore();
}

function drawMenuScene(
  ctx: CanvasRenderingContext2D,
  time: number,
  staffMode: StaffMode,
): void {
  ctx.save();
  ctx.globalAlpha = 0.45;
  const scroll = (time * 46) % 220;
  for (let i = 0; i < 7; i += 1) {
    const x = 380 + i * 220 - scroll;
    if (x < 145 || x > WORLD.width + 40) continue;
    const step = staffMode === "rhythm" ? 4 : [2, 4, 6, 4, 3, 5, 4][i % 7];
    drawMenuNote(ctx, x, staffY(step, staffMode));
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.9;
  drawBird(
    ctx,
    { y: birdPerchY(4, staffMode) + Math.sin(time * 2.2) * 6, vy: 0 },
    0,
    false,
    0,
    4,
    staffMode,
  );
  ctx.restore();
}

function drawMenuNote(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.22);
  ctx.fillStyle = "rgba(22, 18, 38, 0.45)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 9.5, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(22, 18, 38, 0.45)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(8, -3);
  ctx.lineTo(8, -28);
  ctx.stroke();
  ctx.restore();
}
