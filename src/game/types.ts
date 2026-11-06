export interface Tier {
  id: number;
  name: string;
  /** Tempo the run starts at; it ramps up as notes are hit. */
  startBpm: number;
  /** Durations (in beats) the generator may choose. 0.5 = eighth, 1 = quarter, 1.5 = dotted quarter. */
  values: number[];
  /** Durations that may be replaced by a rest. */
  allowedRests: number[];
  restProb: number;
  ties: boolean;
  syncopation: boolean;
}

export interface NoteEvent {
  id: number;
  /** Absolute beat position in the course. */
  beat: number;
  /** Duration in beats. */
  beats: number;
  /** Staff step: 0 = bottom line, 8 = top line. */
  step: number;
  rest: boolean;
  tied: boolean;
}

export type Phase = "ready" | "running" | "crashed" | "paused";

export interface BirdState {
  y: number;
  /** Vertical glide velocity, used only for the tilt of the notehead. */
  vy: number;
}

export type Grade = "PERFECT" | "GOOD" | "OK";
