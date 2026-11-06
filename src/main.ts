import { Sound, type MetronomeStyle } from "./game/audio";
import { Game, type SubdivisionMode } from "./game/engine";
import { render } from "./game/render";
import { randomSeed } from "./game/rng";
import { comboMultiplier } from "./game/scoring";
import { bestFor, lastTier, loadSettings, recordScore, saveSettings, setLastTier } from "./game/storage";
import { tierById, TIERS } from "./game/tiers";
import { loadMusicFont } from "./fonts";

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id} in index.html`);
  return element as T;
}

const canvas = byId<HTMLCanvasElement>("stage");
const menu = byId<HTMLElement>("menu");
const tiersEl = byId<HTMLDivElement>("tiers");
const seedEl = byId<HTMLElement>("seed");
const crash = byId<HTMLElement>("crash");
const crashTitle = byId<HTMLElement>("crash-title");
const pause = byId<HTMLElement>("pause");
const hud = byId<HTMLElement>("hud");
const hint = byId<HTMLElement>("hint");
const scoreEl = byId<HTMLElement>("score");
const comboEl = byId<HTMLElement>("combo");
const livesEl = byId<HTMLElement>("lives");const bpmEl = byId<HTMLElement>("bpm");
const bestEl = byId<HTMLElement>("best");
const finalScore = byId<HTMLElement>("final-score");
const rGates = byId<HTMLElement>("r-gates");
const rCombo = byId<HTMLElement>("r-combo");
const rBpm = byId<HTMLElement>("r-bpm");
const rAcc = byId<HTMLElement>("r-acc");
const rBest = byId<HTMLElement>("r-best");
const metroBar = byId<HTMLElement>("metro-bar");
const playTempo = byId<HTMLInputElement>("play-tempo");
const playTempoValue = byId<HTMLElement>("play-tempo-value");
const playVolume = byId<HTMLInputElement>("play-volume");
const playVolumeValue = byId<HTMLElement>("play-volume-value");
const pauseTempo = byId<HTMLInputElement>("pause-tempo");
const pauseTempoValue = byId<HTMLElement>("pause-tempo-value");
const pauseVolume = byId<HTMLInputElement>("pause-volume");
const pauseVolumeValue = byId<HTMLElement>("pause-volume-value");
const resumeButton = byId<HTMLButtonElement>("resume");
const countToggle = byId<HTMLInputElement>("count-toggle");
const metroSound = byId<HTMLSelectElement>("metro-sound");
const accentToggle = byId<HTMLInputElement>("accent-toggle");
const subdivisionMode = byId<HTMLSelectElement>("subdivision-mode");

const sound = new Sound();
const params = new URLSearchParams(window.location.search);

function sanitizeSeed(value: string | null): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 24);
}

const sharedSeed = sanitizeSeed(params.get("seed"));
const sharedTier = Number(params.get("tier"));

let seed = sharedSeed || randomSeed();
let tierId = sharedTier >= 1 && sharedTier <= 9 ? sharedTier : Math.min(9, Math.max(1, lastTier()));
let selectedTier = tierId;
let best = bestFor(tierId);

const saved = loadSettings();
let tempo = saved.tempo ?? tierById(tierId).startBpm;
let volume = saved.volume;
let tempoTouched = saved.tempo !== null;
let countOn = saved.count;
let metroStyle: MetronomeStyle = saved.style;
let accentOn = saved.accent;
let subdivision = saved.subdivision;

function syncTempo(): void {
  playTempo.value = String(tempo);
  playTempoValue.textContent = String(tempo);
  pauseTempo.value = String(tempo);
  pauseTempoValue.textContent = String(tempo);
}

function syncVolume(): void {
  const percent = Math.round(volume * 100);
  playVolume.value = String(percent);
  playVolumeValue.textContent = String(percent);
  pauseVolume.value = String(percent);
  pauseVolumeValue.textContent = String(percent);
}

function persistSettings(): void {
  saveSettings({
    tempo,
    volume,
    count: countOn,
    style: metroStyle,
    accent: accentOn,
    subdivision,
  });
}
let game: Game | null = null;

function show(element: HTMLElement): void {
  element.classList.remove("hidden");
}

function hide(element: HTMLElement): void {
  element.classList.add("hidden");
}

function updateHud(): void {
  if (!game) return;
  const multiplier = comboMultiplier(game.combo);
  scoreEl.textContent = String(game.score);
  comboEl.textContent = `x${multiplier % 1 === 0 ? multiplier.toFixed(0) : multiplier.toFixed(1)}`;
  livesEl.textContent = `MISS ${game.misses}`;
  bpmEl.textContent = String(game.bpm);
  bestEl.textContent = String(best);
}

function updateUrl(): void {
  const url = `${window.location.pathname}?tier=${tierId}&seed=${seed}`;
  window.history.replaceState(null, "", url);
}

function renderTiers(): void {
  tiersEl.replaceChildren();
  for (const tier of TIERS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tier";
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(tier.id === selectedTier));

    const top = document.createElement("span");
    top.className = "tier-top";
    const name = document.createElement("span");
    name.className = "tier-name";
    name.textContent = tier.name;
    const id = document.createElement("span");
    id.className = "tier-id";
    id.textContent = `LVL ${tier.id}`;
    top.append(name, id);

    const meta = document.createElement("span");
    meta.className = "tier-meta";
    meta.textContent = `${tier.startBpm} BPM · best ${bestFor(tier.id)}`;

    button.append(top, meta);
    button.addEventListener("click", () => {
      selectedTier = tier.id;
      if (!tempoTouched) {
        tempo = tier.startBpm;
        syncTempo();
        persistSettings();
      }
      startRun();
    });
    button.addEventListener("dblclick", () => {
      selectedTier = tier.id;
      startRun(true);
    });

    tiersEl.append(button);
  }
}

function refreshSeed(): void {
  seedEl.textContent = seed;
}

function onEnd(): void {
  if (!game) return;
  const result = recordScore(tierId, game.score);
  best = result.best;

  finalScore.textContent = String(game.score);
  rAcc.textContent = String(game.accuracy);
  rGates.textContent = String(game.hits);
  rCombo.textContent = String(game.bestCombo);
  rBpm.textContent = String(game.bpm);
  rBest.textContent = String(best);
  crashTitle.textContent = result.isBest && game.score > 0 ? "NEW BEST" : "RUN COMPLETE";
  crashTitle.classList.toggle("win", result.isBest && game.score > 0);

  hide(hud);
  hide(hint);
  hide(metroBar);
  show(crash);
}

function startRun(autoStart = false): void {
  sound.ensure();

  tierId = selectedTier;
  best = bestFor(tierId);
  sound.setMetronomeVolume(volume);
  sound.setMetronomeStyle(metroStyle);
  sound.setAccent(accentOn);
  game = new Game({ tier: tierById(tierId), seed, sound, startBpm: tempo });
  game.setSubdivision(subdivision);
  game.onEnd = onEnd;

  setLastTier(tierId);
  updateUrl();
  refreshSeed();

  hide(menu);
  hide(crash);
  hide(pause);
  show(hud);
  show(metroBar);
  show(hint);
  hint.textContent = "PRESS TO START";
  updateHud();
  if (autoStart) {
    hide(hint);
    game.start();
  }
}

function toMenu(): void {
  game = null;
  hide(hud);
  hide(hint);
  hide(crash);
  hide(pause);
  hide(metroBar);
  show(menu);
  renderTiers();
}

function retry(): void {
  startRun(true);
}

function togglePause(): void {
  if (!game) return;
  if (game.phase === "running") {
    game.pause();
    hide(metroBar);
    show(pause);
  } else if (game.phase === "paused") {
    game.resume();
    hide(pause);
    show(metroBar);
  }
}

function handlePress(): void {
  if (!game) {
    startRun();
    return;
  }
  if (game.phase === "ready") {
    hide(hint);
    game.start();
    return;
  }
  if (game.phase === "running") {
    game.press();
    return;
  }
  if (game.phase === "paused") {
    game.resume();
    hide(pause);
    show(metroBar);
    return;
  }
  if (game.phase === "crashed") {
    retry();
  }
}

function handleRelease(): void {
  if (game?.phase === "running") game.release();
}

function moveSelection(delta: number): void {
  selectedTier = Math.min(9, Math.max(1, selectedTier + delta));
  renderTiers();
}

window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    if (event.repeat) return;
    if (!game) {
      startRun();
      return;
    }
    handlePress();
    return;
  }

  if (event.key === "p" || event.key === "P") {
    event.preventDefault();
    togglePause();
    return;
  }

  if (event.key === "Escape") {
    if (game) toMenu();
    return;
  }

  if (event.key === "r" || event.key === "R") {
    if (game?.phase === "crashed") {
      seed = randomSeed();
      refreshSeed();
      startRun(true);
    }
    return;
  }

  if (!game) {
    const digit = Number(event.key);
    if (digit >= 1 && digit <= 9) {
      selectedTier = digit;
      startRun();
      return;
    }
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      moveSelection(1);
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      moveSelection(-1);
    }
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code !== "Space") return;
  event.preventDefault();
  handleRelease();
});

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  handlePress();
});

window.addEventListener("pointerup", () => handleRelease());
window.addEventListener("pointercancel", () => handleRelease());

crash.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  retry();
});

resumeButton.addEventListener("click", (event) => {
  event.preventDefault();
  togglePause();
});

function changeTempo(value: string): void {
  tempo = Number(value);
  tempoTouched = true;
  syncTempo();
  persistSettings();
  if (game) game.setBpm(tempo);
}

function changeVolume(value: string): void {
  volume = Number(value) / 100;
  syncVolume();
  sound.setMetronomeVolume(volume);
  persistSettings();
}

playTempo.addEventListener("input", () => changeTempo(playTempo.value));
pauseTempo.addEventListener("input", () => changeTempo(pauseTempo.value));
playVolume.addEventListener("input", () => changeVolume(playVolume.value));
pauseVolume.addEventListener("input", () => changeVolume(pauseVolume.value));

countToggle.addEventListener("change", () => {
  countOn = countToggle.checked;
  persistSettings();
});

metroSound.addEventListener("change", () => {
  metroStyle = metroSound.value as MetronomeStyle;
  sound.setMetronomeStyle(metroStyle);
  persistSettings();
});

accentToggle.addEventListener("change", () => {
  accentOn = accentToggle.checked;
  sound.setAccent(accentOn);
  persistSettings();
});

subdivisionMode.addEventListener("change", () => {
  subdivision = subdivisionMode.value as SubdivisionMode;
  game?.setSubdivision(subdivision);
  persistSettings();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && game?.phase === "running") {
    game.pause();
    hide(metroBar);
    show(pause);
  }
});

let last = performance.now();
let clock = 0;

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  clock += dt;

  game?.update(dt);
  render(canvas, game, clock, countOn);
  if (game) updateHud();

  requestAnimationFrame(frame);
}

renderTiers();
refreshSeed();
updateUrl();
syncTempo();
syncVolume();
countToggle.checked = countOn;
metroSound.value = metroStyle;
accentToggle.checked = accentOn;
subdivisionMode.value = subdivision;
sound.setMetronomeStyle(metroStyle);
sound.setAccent(accentOn);
sound.setMetronomeVolume(volume);
await loadMusicFont();

// A shared link (?share=1) drops straight into that course, but still waits for a tap.
if (params.get("share") === "1" && sharedSeed && sharedTier >= 1 && sharedTier <= 9) {
  selectedTier = sharedTier;
  startRun(false);
}

requestAnimationFrame(frame);

// Dev-only inspection hook. Removed from production builds by the import.meta.env guard.
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__rhythm = {
    get game() {
      return game;
    },
    get tier() {
      return tierId;
    },
    get selected() {
      return selectedTier;
    },
    get seed() {
      return seed;
    },
  };
}

