export type MeterId = "4/4" | "3/4" | "2/4" | "6/8";

export type StaffMode = "treble" | "rhythm";

export type SubdivisionMode = "off" | "8" | "3" | "16";

export type MetronomeStyle = "click" | "beep" | "wood" | "digital";

export interface MeterConfig {
  id: MeterId;
  label: string;
  /** Quarter-note units per bar (4 in 4/4, 3 in 3/4, 2 in 2/4, 3 in 6/8). */
  quartersPerBar: number;
  /** VexFlow time signature numerator and denominator. */
  numBeats: number;
  beatValue: number;
  /** Quarter-note units per metronome click (1.0 in simple time, 1.5 in 6/8). */
  clickIntervalQuarters: number;
  /** Clicks per bar (4, 3, 2, or 2 in 6/8). */
  pulsesPerBar: number;
  /** Horizontal pixels per quarter-note unit. */
  pxPerQuarter: number;
  /** Pre-roll beats in quarter-note units before bar 1 beat 1. */
  preRollQuarters: number;
}

export interface Tier {
  id: number;
  name: string;
  subtitle: string;
  startBpm: number;
  /** Allowed durations in quarter-note units (0.25=16th, 0.5=8th, 1=quarter, 1.5=dotted quarter, 2=half, 3=dotted half). */
  values: number[];
  allowedRests: number[];
  restProb: number;
  ties: boolean;
  syncopation: boolean;
  /** Probability (0..1) of generating a 1-beat triplet (three 1/3-beat eighths) when 1 beat remains on the beat. */
  tripletProb?: number;
  /** Default meter badge if user selects "Tier Default" or recommended meter. */
  recommendedMeter?: MeterId;
}

export interface NoteEvent {
  id: number;
  /** Absolute onset in quarter-note units from run start (bar 1 starts at preRollQuarters). */
  beat: number;
  /** Duration in quarter-note units. */
  beats: number;
  /** 0..8 where 0 = E4, 4 = B4, 8 = F5. */
  step: number;
  rest: boolean;
  tied: boolean;
  /** Optional triplet group ID when part of an eighth-note triplet (three 1/3-quarter notes). */
  tupletGroup?: number;
}

export type Phase = "ready" | "running" | "paused" | "finished";

export interface BirdState {
  y: number;
  vy: number;
}

export type Grade = "PERFECT" | "GOOD" | "OK";

export type TimingDirection = "ON_TIME" | "EARLY" | "LATE";

export interface NoteOutcome {
  grade: Grade | "MISS" | "TOO SHORT" | "TOO LONG";
  /** Signed timing error in ms (negative = early, positive = late). Undefined for unpressed misses. */
  deltaMs?: number;
  direction?: TimingDirection;
  heldComplete?: boolean;
}

export interface BarSummary {
  barIndex: number; // 0..7
  hits: number;
  misses: number;
  totalNotes: number;
  accuracy: number;
  avgDeltaMs: number | null;
}

export interface RunSummary {
  score: number;
  accuracy: number;
  hits: number;
  misses: number;
  bestCombo: number;
  topBpm: number;
  avgDeltaMs: number | null;
  earlyCount: number;
  onTimeCount: number;
  lateCount: number;
  bars: BarSummary[];
  focusBar: number | null;
}
