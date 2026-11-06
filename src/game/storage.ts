const KEY = "rhythmFlap.v2";

interface Saved {
  bests: Record<string, number>;
  lastTier: number;
}

function empty(): Saved {
  return { bests: {}, lastTier: 1 };
}

function read(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<Saved>;
    return {
      bests: parsed.bests && typeof parsed.bests === "object" ? parsed.bests : {},
      lastTier: typeof parsed.lastTier === "number" ? parsed.lastTier : 1,
    };
  } catch {
    return empty();
  }
}

function write(data: Saved): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage can be unavailable (private mode, quota). The run still counts.
  }
}

import type { MetronomeStyle } from "./audio";
import type { SubdivisionMode } from "./engine";

export interface Settings {
  tempo: number | null;
  volume: number;
  count: boolean;
  style: MetronomeStyle;
  accent: boolean;
  subdivision: SubdivisionMode;
}

const SETTINGS_KEY = "rhythmFlap.settings.v1";

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return {
        tempo: null,
        volume: 0.6,
        count: false,
        style: "click",
        accent: true,
        subdivision: "off",
      };
    }
    const parsed = JSON.parse(raw) as Partial<Settings>;
    const style: MetronomeStyle =
      parsed.style === "beep" || parsed.style === "wood" || parsed.style === "digital"
        ? parsed.style
        : "click";
    const rawSubdivision = parsed.subdivision as unknown;
    const subdivision: SubdivisionMode =
      rawSubdivision === "8" || rawSubdivision === "3" || rawSubdivision === "16"
        ? rawSubdivision
        : rawSubdivision === true
          ? "8"
          : "off";
    return {
      tempo: typeof parsed.tempo === "number" ? parsed.tempo : null,
      volume: typeof parsed.volume === "number" ? parsed.volume : 0.6,
      count: parsed.count === true,
      style,
      accent: parsed.accent !== false,
      subdivision,
    };
  } catch {
    return {
      tempo: null,
      volume: 0.6,
      count: false,
      style: "click",
      accent: true,
      subdivision: "off",
    };
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable; settings just won't persist.
  }
}

export function bestFor(tierId: number): number {
  return read().bests[String(tierId)] ?? 0;
}

export function recordScore(tierId: number, score: number): { best: number; isBest: boolean } {
  const data = read();
  const key = String(tierId);
  const previous = data.bests[key] ?? 0;
  if (score <= previous) return { best: previous, isBest: false };
  data.bests[key] = score;
  write(data);
  return { best: score, isBest: true };
}

export function lastTier(): number {
  return read().lastTier;
}

export function setLastTier(tierId: number): void {
  const data = read();
  data.lastTier = tierId;
  write(data);
}
