import type { Game } from "./engine";
import { PX_PER_BEAT, PRE_ROLL_BEATS, staffY } from "./layout";
import { drawNotation } from "./notation";
import { WORLD } from "./world";
import type { BirdState } from "./types";

const PAPER = "#f3f2ee";
const INK = "#1e293b";
const ORANGE = "#f97316";

export function drawWorld(
  ctx: CanvasRenderingContext2D,
  game: Game | null,
  time: number,
  counts: boolean,
): void {
  ctx.save();
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  drawCard(ctx);

  // Shake the score inside the card, never the card itself.
  ctx.save();
  cardPath(ctx);
  ctx.clip();

  if (game && game.shake > 0.01) {
    const amount = game.shake * 6;
    ctx.translate((Math.random() - 0.5) * amount, (Math.random() - 0.5) * amount);
  }

  drawStaff(ctx);
  drawHitLine(ctx, game);

  if (game) {
    drawBarLines(ctx, game, time);
    drawNotation(ctx, game, counts);
    const bob = game.phase === "ready" ? Math.sin(time * 3) * 5 : 0;
    drawBird(ctx, game.bird, bob, game.phase === "crashed", game.flash);
    drawPopups(ctx, game);
  } else {
    drawBarLines(ctx, null, time);
    drawMenuScene(ctx, time);
  }

  ctx.restore();
  ctx.restore();
}

const CARD = { x: 12, y: 176, width: 936, height: 212, radius: 18 };

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
  ctx.shadowColor = "rgba(30, 41, 59, 0.14)";
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = "#fffdf8";
  cardPath(ctx);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "rgba(30, 41, 59, 0.08)";
  ctx.lineWidth = 1;
  cardPath(ctx);
  ctx.stroke();
}

function drawStaff(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = "rgba(30, 41, 59, 0.42)";
  ctx.lineWidth = 1.2;
  for (let step = 0; step <= 8; step += 2) {
    const y = staffY(step);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD.width, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(249, 115, 22, 0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, staffY(4));
  ctx.lineTo(WORLD.width, staffY(4));
  ctx.stroke();
}

/** The line the bird rides: notes are tapped as they cross it. */
function drawHitLine(ctx: CanvasRenderingContext2D, game: Game | null): void {
  const x = WORLD.birdX;
  const strength = game?.phase === "running" ? 0.4 : 0.22;

  ctx.save();
  ctx.strokeStyle = `rgba(249, 115, 22, ${strength})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, staffY(8) - 22);
  ctx.lineTo(x, staffY(0) + 22);
  ctx.stroke();

  ctx.fillStyle = `rgba(249, 115, 22, ${strength})`;
  ctx.beginPath();
  ctx.moveTo(x - 5, staffY(8) - 22);
  ctx.lineTo(x + 5, staffY(8) - 22);
  ctx.lineTo(x, staffY(8) - 13);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x - 5, staffY(0) + 22);
  ctx.lineTo(x + 5, staffY(0) + 22);
  ctx.lineTo(x, staffY(0) + 13);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Real bar lines, full staff height, numbered like a score. */
function drawBarLines(
  ctx: CanvasRenderingContext2D,
  game: Game | null,
  time: number,
): void {
  const beatsElapsed = game ? game.beatsElapsed : (time * 1.2) % 4;
  const currentBar = Math.floor((beatsElapsed - PRE_ROLL_BEATS) / 4);
  const top = staffY(8);
  const bottom = staffY(0);

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = "800 11px ui-sans-serif, system-ui, -apple-system, sans-serif";

  for (let bar = currentBar - 1; bar < currentBar + 8; bar += 1) {
    if (bar < 0) continue;
    const beat = PRE_ROLL_BEATS + bar * 4;
    const x = WORLD.birdX + (beat - beatsElapsed) * PX_PER_BEAT;
    if (x < -20 || x > WORLD.width + 20) continue;

    ctx.strokeStyle = "rgba(30, 41, 59, 0.5)";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();

    if (x > 60 && x < WORLD.width - 10) {
      ctx.fillStyle = "rgba(30, 41, 59, 0.45)";
      ctx.fillText(String(bar + 1), x, top - 12);
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
): void {
  const scale = 0.9;
  const headX = WORLD.birdX - 28;
  const headY = bird.y + bob;
  const angle = crashed ? 0.45 : Math.max(-0.16, Math.min(0.16, bird.vy / 7000));

  // Hit ring.
  if (flash > 0) {
    const progress = 1 - flash / 0.24;
    ctx.save();
    ctx.strokeStyle = `rgba(249, 115, 22, ${0.55 * (1 - progress)})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(headX + 12, headY + 12, 18 + progress * 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(headX, headY);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // Legs first, so the body covers where they meet the belly.
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

  // Body and head as one silhouette, with a long beak.
  birdPath(ctx);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.2;
  birdPath(ctx);
  ctx.stroke();

  // Wing.
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-13, 14);
  ctx.quadraticCurveTo(-3, 18, 5, 31);
  ctx.stroke();

  // Eye.
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
  // Beak: long, slightly drooping, pointing right.
  ctx.bezierCurveTo(24, -4, 36, -2, 46, 3);
  ctx.bezierCurveTo(48, 5, 47, 8, 43, 7);
  ctx.bezierCurveTo(33, 3, 22, 2, 12, 4);
  // Throat into the breast.
  ctx.bezierCurveTo(10, 10, 12, 16, 16, 20);
  // Belly and back.
  ctx.bezierCurveTo(24, 30, 16, 38, 4, 38);
  ctx.bezierCurveTo(-10, 38, -20, 30, -20, 18);
  ctx.bezierCurveTo(-20, 8, -17, 2, -13, 0);
  ctx.closePath();
}

function drawPopups(ctx: CanvasRenderingContext2D, game: Game): void {
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "800 15px ui-sans-serif, system-ui, -apple-system, sans-serif";

  for (const popup of game.popups) {
    const progress = 1 - popup.life / 0.7;
    const alpha = Math.min(1, popup.life * 3);
    const y = popup.y - 40 - progress * 24;

    ctx.globalAlpha = alpha;
    ctx.fillStyle =
      popup.kind === "PERFECT"
        ? ORANGE
        : popup.kind === "HELD"
          ? "#16a34a"
          : popup.kind === "GOOD"
            ? "#475569"
            : popup.kind === "MISS"
              ? "#dc2626"
              : "#94a3b8";

    ctx.fillText(popup.text, popup.x, y);
  }

  ctx.restore();
}

function drawMenuScene(ctx: CanvasRenderingContext2D, time: number): void {
  ctx.save();
  ctx.globalAlpha = 0.45;

  const scroll = (time * 46) % 220;
  for (let i = 0; i < 7; i += 1) {
    const x = 380 + i * 220 - scroll;
    if (x < -40 || x > WORLD.width + 40) continue;
    const step = [2, 4, 6, 4, 3, 5, 4][i % 7];
    drawMenuNote(ctx, x, staffY(step));
  }

  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.9;
  drawBird(ctx, { y: 300 + Math.sin(time * 2.2) * 6, vy: 0 }, 0, false, 0);
  ctx.restore();
}

function drawMenuNote(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.22);

  ctx.fillStyle = "rgba(30, 41, 59, 0.5)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 9.5, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(30, 41, 59, 0.5)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(8, -3);
  ctx.lineTo(8, -28);
  ctx.stroke();

  ctx.restore();
}

/** Letterbox the 960x540 world into the canvas and paint the bars. */
export function render(
  canvas: HTMLCanvasElement,
  game: Game | null,
  time: number,
  counts: boolean,
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
  ctx.fillStyle = "#e9e7e0";
  ctx.fillRect(0, 0, pixelWidth, pixelHeight);

  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, offsetX, offsetY);
  drawWorld(ctx, game, time, counts);
}
