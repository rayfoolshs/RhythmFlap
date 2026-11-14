import type { MetronomeStyle, StaffMode } from "./types";

type OscType = "sine" | "square" | "sawtooth" | "triangle";

/** Treble-staff steps 0–8 (E4 … F5). */
const NOTE_FREQUENCIES = [
  329.63, 349.23, 392.0, 440.0, 493.88, 523.25, 587.33, 659.25, 698.46,
];

export function frequencyForStep(step: number, staffMode: StaffMode = "treble"): number {
  if (staffMode === "rhythm") return 392.0; // Clean G4 percussion tone
  return NOTE_FREQUENCIES[Math.max(0, Math.min(NOTE_FREQUENCIES.length - 1, step))];
}

const METRONOME_STYLES: Record<
  MetronomeStyle,
  { accent: [number, number]; beat: [number, number]; type: OscType; duration: number }
> = {
  click: { accent: [1200, 0.35], beat: [800, 0.14], type: "square", duration: 0.045 },
  beep: { accent: [1000, 0.28], beat: [760, 0.11], type: "sine", duration: 0.085 },
  wood: { accent: [1520, 0.32], beat: [1060, 0.14], type: "triangle", duration: 0.032 },
  digital: { accent: [1800, 0.26], beat: [1200, 0.1], type: "square", duration: 0.028 },
};

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private metronomeBus: GainNode | null = null;
  private noteBus: GainNode | null = null;
  private activeOscs: OscillatorNode[] = [];
  private activeGain: GainNode | null = null;
  private metroVol = 0.65;
  private noteVol = 0.75;
  private style: MetronomeStyle = "wood";
  private accent = true;

  ensure(): AudioContext | null {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor({ latencyHint: "interactive" });
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.45;
      this.master.connect(this.ctx.destination);

      this.metronomeBus = this.ctx.createGain();
      this.metronomeBus.gain.value = this.metroVol;
      this.metronomeBus.connect(this.master);

      this.noteBus = this.ctx.createGain();
      this.noteBus.gain.value = this.noteVol;
      this.noteBus.connect(this.master);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  setMetronomeVolume(value: number): void {
    this.metroVol = Math.max(0, Math.min(1, value));
    if (this.metronomeBus) this.metronomeBus.gain.value = this.metroVol;
  }

  setNoteVolume(value: number): void {
    this.noteVol = Math.max(0, Math.min(1, value));
    if (this.noteBus) this.noteBus.gain.value = this.noteVol;
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

  isRunning(): boolean {
    return this.ctx?.state === "running";
  }

  private tone(
    frequency: number,
    type: OscType,
    duration: number,
    gain: number,
    when?: number,
    bus: GainNode | null = null,
  ): void {
    const ctx = this.ensure();
    if (!ctx || !this.master || ctx.state === "closed") return;
    const start = when ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    env.gain.setValueAtTime(0.0001, start);
    env.gain.linearRampToValueAtTime(gain, start + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(env);
    env.connect(bus ?? this.master);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  /** Warm marimba-like harmonic tone for short taps. */
  playNote(frequency: number, seconds: number, gain = 0.2): void {
    const ctx = this.ensure();
    if (!ctx || !this.noteBus) return;
    const now = ctx.currentTime;
    const duration = Math.max(0.12, seconds);

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const env = ctx.createGain();
    const harmonicGain = ctx.createGain();

    osc1.type = "triangle";
    osc1.frequency.setValueAtTime(frequency, now);

    osc2.type = "sine";
    osc2.frequency.setValueAtTime(frequency * 2, now);
    harmonicGain.gain.setValueAtTime(0.28, now);
    harmonicGain.gain.exponentialRampToValueAtTime(0.02, now + Math.min(0.14, duration));

    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(gain, now + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc1.connect(env);
    osc2.connect(harmonicGain);
    harmonicGain.connect(env);
    env.connect(this.noteBus);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration + 0.05);
    osc2.stop(now + duration + 0.05);
  }

  /** Start a sustained note with gentle harmonic bloom. */
  startNote(frequency: number, gain = 0.19): void {
    this.stopNote();
    const ctx = this.ensure();
    if (!ctx || !this.noteBus) return;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const env = ctx.createGain();
    const harmonicGain = ctx.createGain();

    osc1.type = "triangle";
    osc1.frequency.setValueAtTime(frequency, now);
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(frequency * 2, now);

    harmonicGain.gain.setValueAtTime(0.24, now);
    harmonicGain.gain.exponentialRampToValueAtTime(0.06, now + 0.25);

    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(gain, now + 0.012);
    env.gain.setTargetAtTime(gain * 0.72, now + 0.04, 0.22);

    osc1.connect(env);
    osc2.connect(harmonicGain);
    harmonicGain.connect(env);
    env.connect(this.noteBus);

    osc1.start(now);
    osc2.start(now);
    this.activeOscs = [osc1, osc2];
    this.activeGain = env;
  }

  stopNote(): void {
    if (this.activeOscs.length === 0 || !this.activeGain || !this.ctx) return;
    const now = this.ctx.currentTime;
    const oscs = this.activeOscs;
    const env = this.activeGain;
    env.gain.cancelScheduledValues(now);
    env.gain.setValueAtTime(Math.max(0.0001, env.gain.value), now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);
    for (const osc of oscs) {
      try {
        osc.stop(now + 0.08);
      } catch {
        // Ignore already stopped
      }
    }
    this.activeOscs = [];
    this.activeGain = null;
  }

  click(strong: boolean, when?: number): void {
    this.ensure();
    const config = METRONOME_STYLES[this.style];
    const [frequency, gain] = strong && this.accent ? config.accent : config.beat;
    this.tone(frequency, config.type, config.duration, gain, when, this.metronomeBus);
  }

  subdivision(when?: number): void {
    this.ensure();
    this.tone(620, "sine", 0.025, 0.055, when, this.metronomeBus);
  }

  miss(): void {
    this.tone(185, "triangle", 0.11, 0.09, undefined, this.noteBus);
  }
}
