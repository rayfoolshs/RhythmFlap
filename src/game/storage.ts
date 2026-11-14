import type { MeterId, MetronomeStyle, StaffMode, SubdivisionMode } from "./types";

const KEY = "rhythmFlap.v3";
const SETTINGS_KEY = "rhythmFlap.settings.v2";

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
    // Unavailable in private mode
  }
}

export interface Settings {
  tempo: number | null;
  volume: number;
  noteVolume: number;
  count: boolean;
  style: MetronomeStyle;
  accent: boolean;
  subdivision: SubdivisionMode;
  meter: MeterId;
  staffMode: StaffMode;
  practiceMode: boolean;
  latencyMs: number;
}

const DEFAULT_SETTINGS: Settings = {
  tempo: null,
  volume: 0.65,
  noteVolume: 0.75,
  count: false,
  style: "wood",
  accent: true,
  subdivision: "off",
  meter: "4/4",
  staffMode: "treble",
  practiceMode: false,
  latencyMs: 0,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    const style: MetronomeStyle =
      parsed.style === "beep" ||
      parsed.style === "wood" ||
      parsed.style === "digital" ||
      parsed.style === "click"
        ? parsed.style
        : "wood";
    const subdivision: SubdivisionMode =
      parsed.subdivision === "8" || parsed.subdivision === "3" || parsed.subdivision === "16"
        ? parsed.subdivision
        : "off";
    const meter: MeterId =
      parsed.meter === "3/4" || parsed.meter === "2/4" || parsed.meter === "6/8"
        ? parsed.meter
        : "4/4";
    const staffMode: StaffMode = parsed.staffMode === "rhythm" ? "rhythm" : "treble";
    return {
      tempo: typeof parsed.tempo === "number" ? parsed.tempo : null,
      volume: typeof parsed.volume === "number" ? parsed.volume : 0.65,
      noteVolume: typeof parsed.noteVolume === "number" ? parsed.noteVolume : 0.75,
      count: parsed.count === true,
      style,
      accent: parsed.accent !== false,
      subdivision,
      meter,
      staffMode,
      practiceMode: parsed.practiceMode === true,
      latencyMs:
        typeof parsed.latencyMs === "number"
          ? Math.max(-150, Math.min(150, parsed.latencyMs))
          : 0,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}

export function bestFor(tierId: number, meter: MeterId = "4/4"): number {
  const data = read();
  return data.bests[`${tierId}:${meter}`] ?? data.bests[String(tierId)] ?? 0;
}

export function recordScore(
  tierId: number,
  meter: MeterId,
  score: number,
): { best: number; isBest: boolean } {
  const data = read();
  const key = `${tierId}:${meter}`;
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
