import { useCallback, useEffect, useRef, useState } from "react";
import { loadMusicFont } from "./fonts";
import { Sound } from "./game/audio";
import { Game } from "./game/engine";
import { render } from "./game/render";
import { randomSeed } from "./game/rng";
import { comboMultiplier } from "./game/scoring";
import {
  bestFor,
  lastTier,
  loadSettings,
  recordScore,
  saveSettings,
  setLastTier,
} from "./game/storage";
import { METER_LIST, tierById, TIERS } from "./game/tiers";
import type {
  MeterId,
  MetronomeStyle,
  Phase,
  RunSummary,
  StaffMode,
  SubdivisionMode,
} from "./game/types";

interface MidiAccessLike {
  inputs: Map<string, { onmidimessage: ((event: { data: Uint8Array }) => void) | null }>;
  onstatechange: (() => void) | null;
}

function sanitizeSeed(value: string | null): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 24);
}

function parseInitialParams() {
  const params = new URLSearchParams(window.location.search);
  const sharedSeed = sanitizeSeed(params.get("seed"));
  const sharedTier = Number(params.get("tier"));
  const sharedMeter = params.get("meter");
  const sharedStaff = params.get("staff");
  const sharedPractice = params.get("practice");
  const share = params.get("share") === "1";

  return {
    seed: sharedSeed || randomSeed(),
    tier: sharedTier >= 1 && sharedTier <= TIERS.length ? sharedTier : null,
    meter:
      sharedMeter === "4/4" ||
      sharedMeter === "3/4" ||
      sharedMeter === "2/4" ||
      sharedMeter === "6/8"
        ? (sharedMeter as MeterId)
        : null,
    staff:
      sharedStaff === "treble" || sharedStaff === "rhythm"
        ? (sharedStaff as StaffMode)
        : null,
    practice: sharedPractice === "1" ? true : sharedPractice === "0" ? false : null,
    share,
    hasSharedSeed: Boolean(sharedSeed),
  };
}

interface HudState {
  phase: Phase;
  score: number;
  combo: number;
  misses: number;
  bpm: number;
  barNumber: number;
  barCount: number;
  focusBar: number | null;
}

export default function App() {
  const initialRef = useRef(parseInitialParams());
  const savedRef = useRef(loadSettings());

  const [selectedTier, setSelectedTier] = useState<number>(() => {
    const t = initialRef.current.tier ?? lastTier();
    return Math.min(TIERS.length, Math.max(1, t));
  });
  const [seed, setSeed] = useState<string>(() => initialRef.current.seed);
  const [meterId, setMeterId] = useState<MeterId>(
    () => initialRef.current.meter ?? savedRef.current.meter,
  );
  const [staffMode, setStaffMode] = useState<StaffMode>(
    () => initialRef.current.staff ?? savedRef.current.staffMode,
  );
  const [practiceMode, setPracticeMode] = useState<boolean>(
    () => initialRef.current.practice ?? savedRef.current.practiceMode,
  );

  const [tempo, setTempo] = useState<number>(
    () =>
      savedRef.current.tempo ??
      tierById(initialRef.current.tier ?? lastTier()).startBpm,
  );
  const [tempoTouched, setTempoTouched] = useState<boolean>(
    () => savedRef.current.tempo !== null,
  );
  const [volume, setVolume] = useState<number>(() => savedRef.current.volume);
  const [noteVolume, setNoteVolume] = useState<number>(() => savedRef.current.noteVolume);
  const [countOn, setCountOn] = useState<boolean>(() => savedRef.current.count);
  const [metroStyle, setMetroStyle] = useState<MetronomeStyle>(
    () => savedRef.current.style,
  );
  const [accentOn, setAccentOn] = useState<boolean>(() => savedRef.current.accent);
  const [subdivision, setSubdivision] = useState<SubdivisionMode>(
    () => savedRef.current.subdivision,
  );
  const [latencyMs, setLatencyMs] = useState<number>(() => savedRef.current.latencyMs);

  const [screen, setScreen] = useState<"menu" | "play" | "paused" | "result">("menu");
  const [best, setBest] = useState<number>(() =>
    bestFor(
      initialRef.current.tier ?? lastTier(),
      initialRef.current.meter ?? savedRef.current.meter,
    ),
  );
  const [isNewBest, setIsNewBest] = useState(false);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [midiDeviceCount, setMidiDeviceCount] = useState(0);
  const [calibrating, setCalibrating] = useState(false);
  const [calibTaps, setCalibTaps] = useState<number[]>([]);
  const [hud, setHud] = useState<HudState>({
    phase: "ready",
    score: 0,
    combo: 0,
    misses: 0,
    bpm: tempo,
    barNumber: 0,
    barCount: 8,
    focusBar: null,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const soundRef = useRef<Sound | null>(null);
  if (!soundRef.current) soundRef.current = new Sound();
  const gameRef = useRef<Game | null>(null);
  const resultLockUntilRef = useRef<number>(0);
  const activeKeysRef = useRef<Set<string>>(new Set());

  // Mutable settings refs for animation loop without restarting RAF
  const countRef = useRef(countOn);
  countRef.current = countOn;
  const meterRef = useRef(meterId);
  meterRef.current = meterId;
  const staffRef = useRef(staffMode);
  staffRef.current = staffMode;

  useEffect(() => {
    saveSettings({
      tempo: tempoTouched ? tempo : null,
      volume,
      noteVolume,
      count: countOn,
      style: metroStyle,
      accent: accentOn,
      subdivision,
      meter: meterId,
      staffMode,
      practiceMode,
      latencyMs,
    });
  }, [
    tempo,
    tempoTouched,
    volume,
    noteVolume,
    countOn,
    metroStyle,
    accentOn,
    subdivision,
    meterId,
    staffMode,
    practiceMode,
    latencyMs,
  ]);

  useEffect(() => {
    const sound = soundRef.current!;
    sound.setMetronomeVolume(volume);
    sound.setNoteVolume(noteVolume);
    sound.setMetronomeStyle(metroStyle);
    sound.setAccent(accentOn);
  }, [volume, noteVolume, metroStyle, accentOn]);

  const buildShareUrl = useCallback(
    (includeShare = true) => {
      const url = new URL(window.location.href);
      url.search = "";
      url.searchParams.set("tier", String(selectedTier));
      url.searchParams.set("meter", meterId);
      url.searchParams.set("staff", staffMode);
      url.searchParams.set("practice", practiceMode ? "1" : "0");
      url.searchParams.set("seed", seed);
      if (includeShare) url.searchParams.set("share", "1");
      return url.toString();
    },
    [selectedTier, meterId, staffMode, practiceMode, seed],
  );

  const syncBrowserUrl = useCallback(
    (tId: number, s: string, m: MeterId, st: StaffMode, pm: boolean) => {
      const next = `${window.location.pathname}?tier=${tId}&meter=${encodeURIComponent(
        m,
      )}&staff=${st}&practice=${pm ? "1" : "0"}&seed=${s}`;
      window.history.replaceState(null, "", next);
    },
    [],
  );

  const startRun = useCallback(
    (options?: {
      tierId?: number;
      courseSeed?: string;
      autoStart?: boolean;
      focusBar?: number | null;
      overridePractice?: boolean;
      overrideTempo?: number;
    }) => {
      const sound = soundRef.current!;
      sound.ensure();
      const targetTierId = options?.tierId ?? selectedTier;
      const targetSeed = options?.courseSeed ?? seed;
      const targetFocus = options?.focusBar ?? null;
      const targetPractice = options?.overridePractice ?? practiceMode;
      const tier = tierById(targetTierId);
      const startBpm =
        options?.overrideTempo ?? (tempoTouched ? tempo : tier.startBpm);

      setSelectedTier(targetTierId);
      setSeed(targetSeed);
      if (!tempoTouched && options?.overrideTempo === undefined) {
        setTempo(tier.startBpm);
      }

      const currentBest = bestFor(targetTierId, meterId);
      setBest(currentBest);
      setIsNewBest(false);
      setSummary(null);
      setLastTier(targetTierId);
      syncBrowserUrl(targetTierId, targetSeed, meterId, staffMode, targetPractice);

      const game = new Game({
        tier,
        seed: targetSeed,
        sound,
        meterId,
        staffMode,
        startBpm,
        practiceMode: targetPractice,
        latencyMs,
        focusBar: targetFocus,
      });
      game.setSubdivision(subdivision);
      game.onEnd = (runSummary) => {
        // Only record high scores on full 8-bar runs
        if (runSummary.focusBar === null) {
          const rec = recordScore(targetTierId, meterId, runSummary.score);
          setBest(rec.best);
          setIsNewBest(rec.isBest && runSummary.score > 0);
        } else {
          setIsNewBest(false);
        }
        resultLockUntilRef.current = performance.now() + 650;
        setSummary(runSummary);
        setScreen("result");
      };

      gameRef.current = game;
      setHud({
        phase: options?.autoStart ? "running" : "ready",
        score: 0,
        combo: 0,
        misses: 0,
        bpm: game.bpm,
        barNumber: 0,
        barCount: game.barCount,
        focusBar: targetFocus,
      });
      setScreen("play");

      if (options?.autoStart) {
        game.start();
      }
    },
    [
      selectedTier,
      seed,
      practiceMode,
      tempoTouched,
      tempo,
      meterId,
      staffMode,
      latencyMs,
      subdivision,
      syncBrowserUrl,
    ],
  );

  const toMenu = useCallback(() => {
    gameRef.current?.pause();
    soundRef.current?.stopNote();
    gameRef.current = null;
    setScreen("menu");
  }, []);

  const togglePause = useCallback(() => {
    const game = gameRef.current;
    if (!game) return;
    if (game.phase === "running") {
      game.pause();
      setScreen("paused");
    } else if (game.phase === "paused") {
      game.resume();
      setScreen("play");
    }
  }, []);

  const handlePress = useCallback(() => {
    const game = gameRef.current;
    if (!game) return;
    if (game.phase === "ready") {
      game.start();
      return;
    }
    if (game.phase === "running") {
      game.press();
    }
  }, []);

  const handleRelease = useCallback(() => {
    const game = gameRef.current;
    if (game?.phase === "running") {
      game.release();
    }
  }, []);

  // Load Bravura font and optionally jump straight into a shared link
  useEffect(() => {
    let mounted = true;
    void loadMusicFont().then(() => {
      if (!mounted) return;
      const init = initialRef.current;
      if (init.share && init.hasSharedSeed && init.tier) {
        startRun({ tierId: init.tier, courseSeed: init.seed, autoStart: false });
      }
    });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Main animation loop
  useEffect(() => {
    let rafId = 0;
    let last = performance.now();
    let clock = 0;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      clock += dt;

      const game = gameRef.current;
      if (game) {
        game.update(dt);
        setHud((prev) => {
          const barNumber = game.currentBarNumber;
          if (
            prev.phase === game.phase &&
            prev.score === game.score &&
            prev.combo === game.combo &&
            prev.misses === game.misses &&
            prev.bpm === game.bpm &&
            prev.barNumber === barNumber
          ) {
            return prev;
          }
          return {
            phase: game.phase,
            score: game.score,
            combo: game.combo,
            misses: game.misses,
            bpm: game.bpm,
            barNumber,
            barCount: game.barCount,
            focusBar: game.focusBar,
          };
        });
      }

      const canvas = canvasRef.current;
      if (canvas) {
        render(canvas, game, clock, countRef.current, meterRef.current, staffRef.current);
      }
      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Auto-pause on tab hide
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && gameRef.current?.phase === "running") {
        gameRef.current.pause();
        setScreen("paused");
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Web MIDI support for keyboards & drum pads
  useEffect(() => {
    const nav = navigator as unknown as {
      requestMIDIAccess?: () => Promise<MidiAccessLike>;
    };
    if (!nav.requestMIDIAccess) return;
    let cancelled = false;
    let midiAccess: MidiAccessLike | null = null;

    const bindInputs = (access: MidiAccessLike) => {
      setMidiDeviceCount(access.inputs.size);
      for (const input of access.inputs.values()) {
        input.onmidimessage = (msg) => {
          const [status, , velocity] = msg.data;
          const cmd = status & 0xf0;
          if (cmd === 0x90 && velocity > 0) {
            handlePress();
          } else if (cmd === 0x80 || (cmd === 0x90 && velocity === 0)) {
            handleRelease();
          }
        };
      }
    };

    nav
      .requestMIDIAccess()
      .then((access) => {
        if (cancelled) return;
        midiAccess = access;
        bindInputs(access);
        access.onstatechange = () => bindInputs(access);
      })
      .catch(() => {
        // User denied or browser unsupported
      });

    return () => {
      cancelled = true;
      if (midiAccess) midiAccess.onstatechange = null;
    };
  }, [handlePress, handleRelease]);

  // Latency calibration loop
  const calibBeatTimesRef = useRef<number[]>([]);
  useEffect(() => {
    if (!calibrating) return;
    const sound = soundRef.current!;
    sound.ensure();
    calibBeatTimesRef.current = [];
    setCalibTaps([]);

    const intervalMs = 666.667; // 90 BPM
    const tick = () => {
      const ctxTime = sound.now();
      sound.click(calibBeatTimesRef.current.length % 4 === 0, ctxTime);
      calibBeatTimesRef.current.push(performance.now());
      if (calibBeatTimesRef.current.length > 16) {
        calibBeatTimesRef.current.shift();
      }
    };
    tick();
    const id = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(id);
  }, [calibrating]);

  const recordCalibrationTap = useCallback(() => {
    const now = performance.now();
    const beats = calibBeatTimesRef.current;
    if (beats.length === 0) return;
    // Compare tap against nearest scheduled click (including next predicted beat)
    const intervalMs = 666.667;
    const candidates = [...beats, beats[beats.length - 1] + intervalMs];
    let bestOffset = 0;
    let bestAbs = Infinity;
    for (const b of candidates) {
      const diff = now - b;
      if (Math.abs(diff) < bestAbs) {
        bestAbs = Math.abs(diff);
        bestOffset = diff;
      }
    }
    if (bestAbs > 260) return;
    setCalibTaps((prev) => {
      const next = [...prev.slice(-7), Math.round(bestOffset)];
      if (next.length >= 4) {
        const sorted = [...next].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        setLatencyMs(Math.max(-150, Math.min(150, median)));
      }
      return next;
    });
  }, []);

  // Keyboard controls (Space, F, J, Enter, P, Esc, R, 1-9)
  useEffect(() => {
    const isTapKey = (code: string) =>
      code === "Space" || code === "KeyF" || code === "KeyJ" || code === "Enter";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
        if (event.code === "Escape") (event.target as HTMLElement).blur();
        else return;
      }

      if (calibrating) {
        if (isTapKey(event.code)) {
          event.preventDefault();
          if (!event.repeat) recordCalibrationTap();
        } else if (event.code === "Escape") {
          setCalibrating(false);
        }
        return;
      }

      if (isTapKey(event.code)) {
        event.preventDefault();
        if (event.repeat) return;

        if (screen === "menu") {
          startRun({ autoStart: false });
          return;
        }
        if (screen === "paused") {
          togglePause();
          return;
        }
        if (screen === "result") {
          if (performance.now() >= resultLockUntilRef.current) {
            startRun({ autoStart: true, focusBar: summary?.focusBar ?? null });
          }
          return;
        }
        if (screen === "play") {
          activeKeysRef.current.add(event.code);
          if (activeKeysRef.current.size === 1 || gameRef.current?.phase === "ready") {
            handlePress();
          } else {
            // Alternating finger tap (e.g. F then J while F slightly overlapping): allow crisp onset
            handlePress();
          }
        }
        return;
      }

      if (event.key === "p" || event.key === "P") {
        if (screen === "play" || screen === "paused") {
          event.preventDefault();
          togglePause();
        }
        return;
      }

      if (event.key === "Escape") {
        if (screen !== "menu") {
          toMenu();
        }
        return;
      }

      if ((event.key === "r" || event.key === "R") && screen === "result") {
        if (performance.now() >= resultLockUntilRef.current) {
          const fresh = randomSeed();
          startRun({ courseSeed: fresh, autoStart: true, focusBar: null });
        }
        return;
      }

      if (screen === "menu") {
        const digit = Number(event.key);
        if (digit >= 1 && digit <= 9) {
          startRun({ tierId: digit, autoStart: false });
        }
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (!isTapKey(event.code)) return;
      activeKeysRef.current.delete(event.code);
      if (activeKeysRef.current.size === 0) {
        handleRelease();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [
    calibrating,
    screen,
    summary,
    startRun,
    togglePause,
    toMenu,
    handlePress,
    handleRelease,
    recordCalibrationTap,
  ]);

  const handleTempoChange = (val: number) => {
    setTempo(val);
    setTempoTouched(true);
    if (gameRef.current) gameRef.current.setBpm(val);
  };

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(buildShareUrl(true));
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 1800);
    } catch {
      // Clipboard blocked in some embedded contexts; URL bar still updated
      syncBrowserUrl(selectedTier, seed, meterId, staffMode, practiceMode);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 1800);
    }
  };

  const multiplier = comboMultiplier(hud.combo);
  const multiplierText = `x${multiplier % 1 === 0 ? multiplier.toFixed(0) : multiplier.toFixed(1)}`;
  const activeTier = tierById(selectedTier);

  return (
    <main className="relative w-full h-full overflow-hidden bg-[#f5f6fa]">
      <canvas
        ref={canvasRef}
        onPointerDown={(e) => {
          e.preventDefault();
          if (screen === "play") handlePress();
        }}
        onPointerUp={() => {
          if (screen === "play") handleRelease();
        }}
        onPointerCancel={() => {
          if (screen === "play") handleRelease();
        }}
        className="block w-full h-full cursor-pointer"
      />

      {/* Top HUD during active exercise */}
      {(screen === "play" || screen === "paused") && (
        <header className="absolute top-3 left-1/2 -translate-x-1/2 w-[min(936px,calc(100%-24px))] flex items-center justify-between gap-4 px-4 py-2.5 bg-white/95 border border-[#e2e5ee] rounded-xl shadow-sm z-10">
          <div className="flex items-center gap-4 min-w-0">
            <span className="font-extrabold tracking-tight text-sm text-[#161226] whitespace-nowrap shrink-0">
              RHYTHM<span className="text-[#0a8440]">FLAP</span>
            </span>
            <span className="hidden sm:inline text-xs text-[#6b6f80] truncate">
              Lvl {activeTier.id}: {activeTier.name} · {meterId}
              {hud.focusBar !== null ? ` · Practice Bar ${hud.focusBar + 1}` : ""}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs sm:text-sm tabular-nums whitespace-nowrap shrink-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6b6f80]">
                Score
              </span>
              <span className="font-mono-num font-extrabold text-[#161226]">{hud.score}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-mono-num font-extrabold text-[#202b64]">
                {multiplierText}
              </span>
            </div>
            <div className="hidden sm:flex items-baseline gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6b6f80]">
                Bar
              </span>
              <span className="font-mono-num font-bold text-[#161226]">
                {hud.barNumber}/{hud.barCount}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6b6f80]">
                Miss
              </span>
              <span className="font-mono-num font-bold text-[#c23b52]">{hud.misses}</span>
            </div>
            <div className="hidden md:flex items-baseline gap-1.5">
              <span className="font-mono-num font-bold text-[#161226]">{hud.bpm}</span>
              <span className="text-[10px] font-bold uppercase text-[#6b6f80]">BPM</span>
            </div>
            <div className="hidden md:flex items-baseline gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6b6f80]">
                Best
              </span>
              <span className="font-mono-num font-bold text-[#161226]">{best}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={togglePause}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-[#f5f6fa] border border-[#e2e5ee] text-[#161226] hover:border-[#202b64] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {screen === "paused" ? "Resume" : "Pause"}
            </button>
            <button
              type="button"
              onClick={toMenu}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-[#f5f6fa] border border-[#e2e5ee] text-[#4e5366] hover:border-[#202b64] hover:text-[#161226] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Tiers
            </button>
          </div>
        </header>
      )}

      {/* Ready prompt */}
      {screen === "play" && hud.phase === "ready" && (
        <div className="pointer-events-none fixed left-1/2 -translate-x-1/2 bottom-[22%] z-10 text-center">
          <p className="animate-hint text-xs sm:text-sm font-extrabold tracking-widest uppercase text-[#202b64]">
            Tap stage or press Space / F / J to start
          </p>
          <p className="mt-1 text-xs text-[#6b6f80]">
            Hold notes longer than an eighth · release before rests
            {midiDeviceCount > 0 ? ` · ${midiDeviceCount} MIDI input ready` : ""}
          </p>
        </div>
      )}

      {/* Live Exercise Metronome & Mixing Bar */}
      {(screen === "play" || screen === "paused") && (
        <footer className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[min(936px,calc(100%-24px))] flex flex-wrap items-center justify-center sm:justify-between gap-x-4 gap-y-2 px-4 py-2.5 bg-white/95 border border-[#e2e5ee] rounded-xl shadow-sm z-10 text-xs text-[#4e5366]">
          <div className="flex items-center flex-wrap gap-3">
            <label className="flex items-center gap-1.5 font-semibold whitespace-nowrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6b6f80]">
                Click
              </span>
              <select
                value={metroStyle}
                onChange={(e) => setMetroStyle(e.target.value as MetronomeStyle)}
                className="px-2 py-1 rounded-md bg-[#f5f6fa] border border-[#e2e5ee] text-[#161226] font-semibold cursor-pointer"
              >
                <option value="wood">Wood</option>
                <option value="click">Click</option>
                <option value="beep">Beep</option>
                <option value="digital">Digital</option>
              </select>
            </label>

            <label className="flex items-center gap-1.5 font-semibold cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={accentOn}
                onChange={(e) => setAccentOn(e.target.checked)}
                className="accent-[#202b64] w-3.5 h-3.5 cursor-pointer"
              />
              Accent
            </label>

            <label className="flex items-center gap-1.5 font-semibold whitespace-nowrap">
              <select
                aria-label="Metronome subdivision"
                value={subdivision}
                onChange={(e) => {
                  const next = e.target.value as SubdivisionMode;
                  setSubdivision(next);
                  gameRef.current?.setSubdivision(next);
                }}
                className="px-2 py-1 rounded-md bg-[#f5f6fa] border border-[#e2e5ee] text-[#161226] font-semibold cursor-pointer"
              >
                <option value="off">Subdiv: Off</option>
                <option value="8">Subdiv: 8ths</option>
                <option value="3">Subdiv: Triplets</option>
                <option value="16">Subdiv: 16ths</option>
              </select>
            </label>

            <label className="flex items-center gap-1.5 font-semibold cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={countOn}
                onChange={(e) => setCountOn(e.target.checked)}
                className="accent-[#202b64] w-3.5 h-3.5 cursor-pointer"
              />
              Count
            </label>
          </div>

          <div className="flex items-center flex-wrap gap-4">
            <label className="flex items-center gap-2 font-semibold whitespace-nowrap">
              <span className="font-mono-num font-bold text-[#161226] w-14 text-right">
                {hud.bpm} BPM
              </span>
              <input
                type="range"
                min={45}
                max={184}
                step={1}
                value={hud.bpm}
                onChange={(e) => handleTempoChange(Number(e.target.value))}
                className="w-24 cursor-pointer"
              />
            </label>

            <label className="flex items-center gap-2 font-semibold whitespace-nowrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6b6f80]">
                Metro
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(volume * 100)}
                onChange={(e) => setVolume(Number(e.target.value) / 100)}
                className="w-16 cursor-pointer"
              />
            </label>

            <label className="flex items-center gap-2 font-semibold whitespace-nowrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6b6f80]">
                Notes
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(noteVolume * 100)}
                onChange={(e) => setNoteVolume(Number(e.target.value) / 100)}
                className="w-16 cursor-pointer"
              />
            </label>
          </div>
        </footer>
      )}

      {/* Tier & Curriculum Menu Overlay */}
      {screen === "menu" && (
        <section className="fixed inset-0 z-20 flex items-center justify-center p-4 sm:p-6 bg-[#161226]/40 backdrop-blur-[3px]">
          <div className="w-full max-w-[840px] max-h-full overflow-y-auto bg-white border border-[#e2e5ee] rounded-2xl shadow-2xl p-5 sm:p-7">
            <header className="pb-4 border-b-4 border-[#c1d52d] flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-none text-[#161226]">
                  RHYTHM<span className="text-[#0a8440]">FLAP</span>
                </h1>
                <p className="mt-1.5 text-sm text-[#4e5366]">
                  Sight-read each bar as it crosses the line. Hold sustained values and release before rests.
                </p>
                <p className="mt-2 text-xs text-[#6b6f80]">
                  Created by{" "}
                  <a
                    href="https://www.rayfooproductions.com"
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-[#202b64] underline decoration-[#c1d52d] decoration-2 underline-offset-2 hover:text-[#0a8440]"
                  >
                    Ray Foo
                  </a>
                  {" · "}
                  <a
                    href="https://www.rayfooproductions.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#202b64] underline decoration-[#c1d52d] decoration-2 underline-offset-2 hover:text-[#0a8440]"
                  >
                    www.rayfooproductions.com
                  </a>
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#6b6f80]">
                <span>Seed</span>
                <code className="font-mono-num px-1.5 py-0.5 bg-[#f5f6fa] border border-[#e2e5ee] rounded text-[#161226]">
                  {seed}
                </code>
                <button
                  type="button"
                  onClick={() => setSeed(randomSeed())}
                  className="px-2.5 py-1.5 font-semibold text-[#202b64] bg-[#f5f6fa] border border-[#e2e5ee] rounded-lg hover:border-[#202b64] transition-colors cursor-pointer whitespace-nowrap"
                >
                  New Seed
                </button>
                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  className="px-2.5 py-1.5 font-semibold text-[#202b64] bg-[#f5f6fa] border border-[#e2e5ee] rounded-lg hover:border-[#202b64] transition-colors cursor-pointer whitespace-nowrap"
                >
                  {copiedLink ? "Link Copied" : "Share Course"}
                </button>
              </div>
            </header>

            {/* Curriculum & Mode Controls */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#e2e5ee]">
              <div className="flex items-center gap-1 p-1 bg-[#f5f6fa] border border-[#e2e5ee] rounded-lg">
                {METER_LIST.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setMeterId(m.id);
                      setBest(bestFor(selectedTier, m.id));
                    }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      meterId === m.id
                        ? "bg-[#202b64] text-white"
                        : "text-[#4e5366] hover:text-[#161226]"
                    }`}
                  >
                    {m.id}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 p-1 bg-[#f5f6fa] border border-[#e2e5ee] rounded-lg">
                <button
                  type="button"
                  onClick={() => setStaffMode("treble")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    staffMode === "treble"
                      ? "bg-white text-[#161226] shadow-xs border border-[#e2e5ee]"
                      : "text-[#4e5366] hover:text-[#161226]"
                  }`}
                >
                  Treble Staff
                </button>
                <button
                  type="button"
                  onClick={() => setStaffMode("rhythm")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    staffMode === "rhythm"
                      ? "bg-white text-[#161226] shadow-xs border border-[#e2e5ee]"
                      : "text-[#4e5366] hover:text-[#161226]"
                  }`}
                >
                  1-Line Rhythm
                </button>
              </div>

              <div className="flex items-center gap-1 p-1 bg-[#f5f6fa] border border-[#e2e5ee] rounded-lg">
                <button
                  type="button"
                  onClick={() => setPracticeMode(false)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    !practiceMode
                      ? "bg-white text-[#161226] shadow-xs border border-[#e2e5ee]"
                      : "text-[#4e5366] hover:text-[#161226]"
                  }`}
                >
                  Arcade (+BPM)
                </button>
                <button
                  type="button"
                  onClick={() => setPracticeMode(true)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    practiceMode
                      ? "bg-white text-[#161226] shadow-xs border border-[#e2e5ee]"
                      : "text-[#4e5366] hover:text-[#161226]"
                  }`}
                >
                  Practice (Steady)
                </button>
              </div>

              <button
                type="button"
                onClick={() => setCalibrating(true)}
                className="px-3 py-2 text-xs font-bold text-[#202b64] bg-[#f5f6fa] border border-[#e2e5ee] rounded-lg hover:border-[#202b64] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Latency: {latencyMs > 0 ? `+${latencyMs}` : latencyMs} ms
              </button>
            </div>

            {/* 12 Progressive Curriculum Tiers */}
            <div
              className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5"
              role="listbox"
              aria-label="Rhythm tiers"
            >
              {TIERS.map((tier) => {
                const isSelected = tier.id === selectedTier;
                const tierBest = bestFor(tier.id, meterId);
                return (
                  <button
                    key={tier.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => startRun({ tierId: tier.id, autoStart: false })}
                    className={`flex flex-col justify-between text-left px-3.5 py-3 rounded-xl border-2 transition-all cursor-pointer ${
                      isSelected
                        ? "border-[#202b64] bg-[#eef2fb]"
                        : "border-[#e2e5ee] bg-white hover:border-[#202b64]/60 hover:-translate-y-0.5"
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2 w-full">
                      <span className="text-sm font-bold text-[#161226]">{tier.name}</span>
                      <span className="text-[10px] font-extrabold tracking-wider text-[#6b6f80] shrink-0">
                        LVL {tier.id}
                      </span>
                    </div>
                    <span className="mt-0.5 text-xs text-[#6b6f80]">{tier.subtitle}</span>
                    <div className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-[#4e5366] tabular-nums">
                      <span>{tier.startBpm} BPM</span>
                      <span aria-hidden="true">·</span>
                      <span>Best {tierBest}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <footer className="mt-5 pt-3 border-t border-[#e2e5ee] flex flex-wrap items-center justify-between gap-3 text-xs text-[#6b6f80]">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <span>
                  <kbd className="font-mono-num px-1.5 py-0.5 bg-[#f5f6fa] border border-[#e2e5ee] rounded text-[11px] text-[#161226]">
                    Space
                  </kbd>{" "}
                  /{" "}
                  <kbd className="font-mono-num px-1.5 py-0.5 bg-[#f5f6fa] border border-[#e2e5ee] rounded text-[11px] text-[#161226]">
                    F
                  </kbd>{" "}
                  <kbd className="font-mono-num px-1.5 py-0.5 bg-[#f5f6fa] border border-[#e2e5ee] rounded text-[11px] text-[#161226]">
                    J
                  </kbd>{" "}
                  tap &amp; hold
                </span>
                <span>
                  <kbd className="font-mono-num px-1.5 py-0.5 bg-[#f5f6fa] border border-[#e2e5ee] rounded text-[11px] text-[#161226]">
                    P
                  </kbd>{" "}
                  pause
                </span>
                <span>
                  <kbd className="font-mono-num px-1.5 py-0.5 bg-[#f5f6fa] border border-[#e2e5ee] rounded text-[11px] text-[#161226]">
                    1–9
                  </kbd>{" "}
                  quick-pick tier
                </span>
                {midiDeviceCount > 0 && (
                  <span className="font-semibold text-[#15915b]">
                    MIDI Input Active ({midiDeviceCount})
                  </span>
                )}
              </div>
              <span>
                Based on{" "}
                <a
                  href="https://github.com/rayfoolshs/rhythm-flap"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#202b64] hover:underline font-semibold"
                >
                  rayfoolshs/rhythm-flap
                </a>
              </span>
            </footer>
          </div>
        </section>
      )}

      {/* Pause Overlay */}
      {screen === "paused" && (
        <section className="fixed inset-0 z-20 flex items-center justify-center p-4 bg-[#161226]/40 backdrop-blur-[3px]">
          <div className="w-full max-w-md bg-white border border-[#e2e5ee] rounded-2xl shadow-2xl p-6 text-center">
            <h2 className="text-2xl font-extrabold tracking-tight text-[#161226]">
              PAUSED
            </h2>
            <p className="mt-1 text-xs text-[#6b6f80]">
              Lvl {activeTier.id}: {activeTier.name} · {meterId}
            </p>

            <div className="mt-5 space-y-4 text-left">
              <label className="block text-xs font-bold text-[#4e5366]">
                <div className="flex justify-between mb-1">
                  <span>Tempo</span>
                  <span className="font-mono-num text-[#161226]">{hud.bpm} BPM</span>
                </div>
                <input
                  type="range"
                  min={45}
                  max={184}
                  value={hud.bpm}
                  onChange={(e) => handleTempoChange(Number(e.target.value))}
                  className="w-full cursor-pointer"
                />
              </label>

              <label className="block text-xs font-bold text-[#4e5366]">
                <div className="flex justify-between mb-1">
                  <span>Audio / Input Latency Offset</span>
                  <span className="font-mono-num text-[#161226]">
                    {latencyMs > 0 ? `+${latencyMs}` : latencyMs} ms
                  </span>
                </div>
                <input
                  type="range"
                  min={-150}
                  max={150}
                  step={5}
                  value={latencyMs}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setLatencyMs(next);
                    gameRef.current?.setLatencyMs(next);
                  }}
                  className="w-full cursor-pointer"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={togglePause}
                className="px-5 py-2.5 text-sm font-bold rounded-xl bg-[#202b64] text-white hover:bg-[#3d4a94] transition-colors cursor-pointer whitespace-nowrap"
              >
                Resume (P)
              </button>
              <button
                type="button"
                onClick={() => startRun({ autoStart: true, focusBar: hud.focusBar })}
                className="px-4 py-2.5 text-sm font-bold rounded-xl bg-[#f5f6fa] border border-[#e2e5ee] text-[#161226] hover:border-[#202b64] transition-colors cursor-pointer whitespace-nowrap"
              >
                Restart
              </button>
              <button
                type="button"
                onClick={toMenu}
                className="px-4 py-2.5 text-sm font-bold rounded-xl bg-[#f5f6fa] border border-[#e2e5ee] text-[#4e5366] hover:border-[#202b64] transition-colors cursor-pointer whitespace-nowrap"
              >
                All Tiers
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Result & Diagnostics Screen */}
      {screen === "result" && summary && (
        <section className="fixed inset-0 z-20 flex items-center justify-center p-4 bg-[#161226]/45 backdrop-blur-[3px]">
          <div className="w-full max-w-[640px] max-h-full overflow-y-auto bg-white border border-[#e2e5ee] rounded-2xl shadow-2xl p-6 text-center">
            <div className="pb-3 border-b-4 border-[#c1d52d]">
              <h2
                className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                  isNewBest ? "text-[#0a8440]" : "text-[#161226]"
                }`}
              >
                {summary.focusBar !== null
                  ? `BAR ${summary.focusBar + 1} DRILL COMPLETE`
                  : isNewBest
                    ? "NEW BEST"
                    : "RUN COMPLETE"}
              </h2>
              <p className="mt-1 text-xs text-[#6b6f80]">
                Lvl {activeTier.id}: {activeTier.name} · {meterId} ·{" "}
                {staffMode === "rhythm" ? "1-Line Rhythm" : "Treble Staff"}
              </p>
            </div>

            <div className="mt-4 font-mono-num text-5xl sm:text-6xl font-extrabold tracking-tight text-[#161226]">
              {summary.score}
            </div>
            {summary.focusBar === null && (
              <p className="mt-1 text-xs font-semibold text-[#6b6f80] tabular-nums">
                Tier Best: <span className="text-[#161226] font-bold">{best}</span>
              </p>
            )}

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-[#f5f6fa] rounded-xl p-3">
                <div className="font-mono-num text-xl font-extrabold text-[#161226]">
                  {summary.accuracy}%
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#6b6f80]">
                  Accuracy
                </div>
              </div>
              <div className="bg-[#f5f6fa] rounded-xl p-3">
                <div className="font-mono-num text-xl font-extrabold text-[#161226]">
                  {summary.hits}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#6b6f80]">
                  Notes Hit
                </div>
              </div>
              <div className="bg-[#f5f6fa] rounded-xl p-3">
                <div className="font-mono-num text-xl font-extrabold text-[#161226]">
                  {summary.bestCombo}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#6b6f80]">
                  Best Combo
                </div>
              </div>
              <div className="bg-[#f5f6fa] rounded-xl p-3">
                <div className="font-mono-num text-xl font-extrabold text-[#161226]">
                  {summary.topBpm}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#6b6f80]">
                  Top BPM
                </div>
              </div>
            </div>

            {/* Timing Tendency Diagnostic */}
            <div className="mt-4 p-3.5 bg-[#f5f6fa] border border-[#e2e5ee] rounded-xl text-left">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold text-[#161226]">Timing Tendency</span>
                <span className="font-mono-num font-bold text-[#202b64]">
                  {summary.avgDeltaMs === null
                    ? "No hits recorded"
                    : summary.avgDeltaMs < -18
                      ? `Avg ${summary.avgDeltaMs} ms · Rushing (Early)`
                      : summary.avgDeltaMs > 18
                        ? `Avg +${summary.avgDeltaMs} ms · Dragging (Late)`
                        : `Avg ${summary.avgDeltaMs > 0 ? `+${summary.avgDeltaMs}` : summary.avgDeltaMs} ms · Steady Pulse`}
                </span>
              </div>
              {summary.earlyCount + summary.onTimeCount + summary.lateCount > 0 && (
                <>
                  <div className="mt-2 h-2.5 w-full rounded-full overflow-hidden flex bg-[#e2e5ee]">
                    <div
                      style={{
                        width: `${
                          (summary.earlyCount /
                            (summary.earlyCount + summary.onTimeCount + summary.lateCount)) *
                          100
                        }%`,
                      }}
                      className="bg-[#3d4a94]"
                      title="Early"
                    />
                    <div
                      style={{
                        width: `${
                          (summary.onTimeCount /
                            (summary.earlyCount + summary.onTimeCount + summary.lateCount)) *
                          100
                        }%`,
                      }}
                      className="bg-[#15915b]"
                      title="On Time"
                    />
                    <div
                      style={{
                        width: `${
                          (summary.lateCount /
                            (summary.earlyCount + summary.onTimeCount + summary.lateCount)) *
                          100
                        }%`,
                      }}
                      className="bg-[#c97a08]"
                      title="Late"
                    />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[11px] font-semibold text-[#4e5366] tabular-nums">
                    <span>Early: {summary.earlyCount}</span>
                    <span className="text-[#15915b]">On Time (±35ms): {summary.onTimeCount}</span>
                    <span>Late: {summary.lateCount}</span>
                  </div>
                </>
              )}
            </div>

            {/* Bar-by-Bar Accuracy Breakdown */}
            <div className="mt-4 text-left">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-[#161226]">
                  Measure Breakdown{" "}
                  <span className="font-normal text-[#6b6f80]">
                    (click a bar to drill it 4×)
                  </span>
                </span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                {summary.bars.map((bar) => {
                  const perfectBar = bar.misses === 0;
                  const lowBar = bar.accuracy < 75;
                  return (
                    <button
                      key={bar.barIndex}
                      type="button"
                      disabled={summary.focusBar !== null}
                      onClick={() =>
                        startRun({
                          autoStart: true,
                          focusBar: bar.barIndex,
                          overridePractice: true,
                        })
                      }
                      className={`p-2 rounded-lg border text-center transition-colors tabular-nums ${
                        summary.focusBar === null ? "cursor-pointer hover:border-[#202b64]" : ""
                      } ${
                        perfectBar
                          ? "bg-[#15915b]/10 border-[#15915b]/30 text-[#15915b]"
                          : lowBar
                            ? "bg-[#c23b52]/10 border-[#c23b52]/30 text-[#c23b52]"
                            : "bg-[#c97a08]/10 border-[#c97a08]/30 text-[#c97a08]"
                      }`}
                    >
                      <div className="text-[10px] font-bold uppercase text-[#4e5366]">
                        {summary.focusBar !== null ? `Rep ${bar.barIndex + 1}` : `Bar ${bar.barIndex + 1}`}
                      </div>
                      <div className="font-mono-num text-sm font-extrabold">
                        {bar.accuracy}%
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Explicit Actions (never accidental tap-through) */}
            <div className="mt-5 pt-4 border-t border-[#e2e5ee] flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() =>
                  startRun({ autoStart: true, focusBar: summary.focusBar })
                }
                className="px-4 py-2.5 text-sm font-bold rounded-xl bg-[#202b64] text-white hover:bg-[#3d4a94] transition-colors cursor-pointer whitespace-nowrap"
              >
                {summary.focusBar !== null ? "Drill Bar Again" : "Retry Course (Space)"}
              </button>
              {summary.focusBar !== null && (
                <button
                  type="button"
                  onClick={() => startRun({ autoStart: true, focusBar: null })}
                  className="px-4 py-2.5 text-sm font-bold rounded-xl bg-[#0a8440] text-white hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap"
                >
                  Full 8 Bars
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const fresh = randomSeed();
                  startRun({ courseSeed: fresh, autoStart: true, focusBar: null });
                }}
                className="px-4 py-2.5 text-sm font-bold rounded-xl bg-[#f5f6fa] border border-[#e2e5ee] text-[#161226] hover:border-[#202b64] transition-colors cursor-pointer whitespace-nowrap"
              >
                New Course (R)
              </button>
              <button
                type="button"
                onClick={handleCopyShareLink}
                className="px-4 py-2.5 text-sm font-bold rounded-xl bg-[#f5f6fa] border border-[#e2e5ee] text-[#202b64] hover:border-[#202b64] transition-colors cursor-pointer whitespace-nowrap"
              >
                {copiedLink ? "Link Copied" : "Share Link"}
              </button>
              <button
                type="button"
                onClick={toMenu}
                className="px-4 py-2.5 text-sm font-bold rounded-xl bg-[#f5f6fa] border border-[#e2e5ee] text-[#4e5366] hover:border-[#202b64] transition-colors cursor-pointer whitespace-nowrap"
              >
                All Tiers (Esc)
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Latency Calibrator Modal */}
      {calibrating && (
        <section className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#161226]/50 backdrop-blur-[3px]">
          <div className="w-full max-w-md bg-white border border-[#e2e5ee] rounded-2xl shadow-2xl p-6 text-center">
            <h2 className="text-xl font-extrabold text-[#161226]">
              Audio Latency Calibration
            </h2>
            <p className="mt-1 text-xs text-[#4e5366]">
              Tap the button or press Space on the steady 90 BPM click (at least 4 times) to compensate for Bluetooth or speaker delay.
            </p>

            <div className="mt-4 font-mono-num text-3xl font-extrabold text-[#202b64]">
              {latencyMs > 0 ? `+${latencyMs}` : latencyMs} ms
            </div>
            <p className="mt-1 text-[11px] text-[#6b6f80] tabular-nums">
              Recorded taps: {calibTaps.length}/8
            </p>

            <div className="mt-4">
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  recordCalibrationTap();
                }}
                className="w-full py-3.5 text-sm font-extrabold rounded-xl bg-[#202b64] text-white active:scale-[0.99] transition-transform cursor-pointer"
              >
                Tap on Beat (or Space)
              </button>
            </div>

            <label className="mt-4 block text-left text-xs font-bold text-[#4e5366]">
              <div className="flex justify-between mb-1">
                <span>Manual Fine-Tune</span>
                <span className="font-mono-num text-[#161226]">{latencyMs} ms</span>
              </div>
              <input
                type="range"
                min={-150}
                max={150}
                step={5}
                value={latencyMs}
                onChange={(e) => setLatencyMs(Number(e.target.value))}
                className="w-full cursor-pointer"
              />
            </label>

            <div className="mt-5 flex justify-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setLatencyMs(0);
                  setCalibTaps([]);
                }}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-[#f5f6fa] border border-[#e2e5ee] text-[#4e5366] hover:border-[#202b64] cursor-pointer"
              >
                Reset 0 ms
              </button>
              <button
                type="button"
                onClick={() => setCalibrating(false)}
                className="px-5 py-2 text-xs font-bold rounded-lg bg-[#0a8440] text-white hover:opacity-90 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
