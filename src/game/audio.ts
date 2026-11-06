import type { Grade } from "./types";

type OscillatorType = "sine" | "square" | "sawtooth" | "triangle";

/** Treble-staff steps 0–8 (E4 … F5). */
const NOTE_FREQUENCIES = [
  329.63, 349.23, 392.0, 440.0, 493.88, 523.25, 587.33, 659.25, 698.46,
];

export function frequencyForStep(step: number): number {
  return NOTE_FREQUENCIES[Math.max(0, Math.min(NOTE_FREQUENCIES.length - 1, step))];
}

/**
 * The whole soundtrack is oscillators, like the original: a metronome that sets
 * the scroll clock, a two-note hit for a clean gate, and a low saw for a crash.
 */
export type MetronomeStyle = "click" | "beep" | "wood" | "digital";

const METRONOME_STYLES: Record<
  MetronomeStyle,
  { accent: [number, number]; beat: [number, number]; type: OscillatorType; duration: number }
> = {
  click: { accent: [1200, 0.35], beat: [800, 0.12], type: "square", duration: 0.05 },
  beep: { accent: [1000, 0.3], beat: [780, 0.1], type: "sine", duration: 0.09 },
  wood: { accent: [1500, 0.3], beat: [1100, 0.12], type: "triangle", duration: 0.035 },
  digital: { accent: [1800, 0.28], beat: [1200, 0.1], type: "square", duration: 0.03 },
};

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private metronomeBus: GainNode | null = null;
  private noteOsc: OscillatorNode | null = null;
  private noteGain: GainNode | null = null;
  private volume = 0.6;
  private style: MetronomeStyle = "click";
  private accent = true;
  enabled = true;

  ensure(): AudioContext | null {
    if (!this.enabled) return null;

    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;

      this.ctx = new Ctor({ latencyHint: "interactive" });
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.4;
      this.master.connect(this.ctx.destination);

      this.metronomeBus = this.ctx.createGain();
      this.metronomeBus.gain.value = this.volume;
      this.metronomeBus.connect(this.master);
    }

    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /** 0..1. Only affects the metronome, not hit or crash feedback. */
  setMetronomeVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.metronomeBus) this.metronomeBus.gain.value = this.volume;
  }

  setMetronomeStyle(style: MetronomeStyle): void {
    this.style = style;
  }

  setAccent(enabled: boolean): void {
    this.accent = enabled;
  }

  now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  private tone(
    frequency: number,
    type: OscillatorType,
    duration: number,
    gain: number,
    when?: number,
    bus: GainNode | null = null,
  ): void {
    const ctx = this.ensure();
    if (!ctx || !this.master || ctx.state === "closed") return;

    const start = when ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    const envelope = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(gain, start + 0.01);
    envelope.gain.exponentialRampToValueAtTime(0.001, start + duration);

    osc.connect(envelope);
    envelope.connect(bus ?? this.master);
    osc.start(start);
    osc.stop(start + duration + 0.1);
  }

  /** A short pitched note for taps and short values. */
  playNote(frequency: number, seconds: number, gain = 0.17): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;

    const now = ctx.currentTime;
    const duration = Math.max(0.1, seconds);
    const osc = ctx.createOscillator();
    const envelope = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(frequency, now);
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.linearRampToValueAtTime(gain, now + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(envelope);
    envelope.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  /** Start a sustained pitch for a held note. */
  startNote(frequency: number, gain = 0.17): void {
    this.stopNote();
    const ctx = this.ensure();
    if (!ctx || !this.master) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const envelope = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(frequency, now);
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.linearRampToValueAtTime(gain, now + 0.015);
    envelope.gain.setTargetAtTime(gain * 0.82, now + 0.03, 0.25);

    osc.connect(envelope);
    envelope.connect(this.master);
    osc.start(now);

    this.noteOsc = osc;
    this.noteGain = envelope;
  }

  stopNote(): void {
    if (!this.noteOsc || !this.noteGain || !this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.noteOsc;
    const envelope = this.noteGain;

    envelope.gain.cancelScheduledValues(now);
    envelope.gain.setValueAtTime(Math.max(0.0001, envelope.gain.value), now);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    osc.stop(now + 0.1);

    this.noteOsc = null;
    this.noteGain = null;
  }

  /** Beat 1 of the bar is higher and louder when the accent is enabled. */
  click(strong: boolean, when?: number): void {
    this.ensure();
    const config = METRONOME_STYLES[this.style];
    const [frequency, gain] = strong && this.accent ? config.accent : config.beat;
    this.tone(frequency, config.type, config.duration, gain, when, this.metronomeBus);
  }

  /** Quiet offbeat click used when subdivision is enabled. */
  subdivision(when?: number): void {
    this.ensure();
    this.tone(600, "sine", 0.03, 0.06, when, this.metronomeBus);
  }

  flap(): void {
    this.tone(520, "sine", 0.05, 0.05);
  }

  hit(grade: Grade): void {
    if (grade === "PERFECT") {
      this.tone(880, "sine", 0.1, 0.1);
      this.tone(1100, "sine", 0.2, 0.05, this.now() + 0.05);
      return;
    }
    if (grade === "GOOD") {
      this.tone(660, "sine", 0.09, 0.08);
      return;
    }
    this.tone(440, "sine", 0.07, 0.06);
  }

  crash(): void {
    this.tone(150, "sawtooth", 0.25, 0.15);
    this.tone(90, "sawtooth", 0.3, 0.12, this.now() + 0.06);
  }

  miss(): void {
    this.tone(180, "square", 0.12, 0.08);
  }

  stop(): void {
    if (this.ctx && this.ctx.state === "running") void this.ctx.suspend();
  }
}
