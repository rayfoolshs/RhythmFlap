# Rhythm Flap

A one-button sight-reading rhythm trainer. A bird flies along a scrolling stave —
tap in time, hold sustained values, and release before rests. Timing is graded to
the millisecond, and the notation *is* the level.

**Play it:** https://rayfoolshs.github.io/RhythmFlap/

## What it does

- **Sight-reading, not memorising.** Every course is generated from a seed, so a
  level is always new but always reproducible.
- **Millisecond feedback.** Each hit is graded `PERFECT` / `GOOD` / `OK` / `MISS`
  with an early/late direction, and the run summary reports average drift in ms
  ("Rushing", "Dragging" or "Steady Pulse").
- **Mistakes are data, not failure.** Missing a note costs score and combo; it
  does not end the run.
- **Curriculum, not a wall.** Twelve graded tiers from quarters and halves up to
  sixteenths, triplets and syncopated mixes.

## Quick start

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production bundle in dist/
npm run lint     # tsc --noEmit
```

Requires Node 20.19+ or 22.12+ (Vite 8).

## Controls

| Input | Action |
|---|---|
| `Space` / tap / click | Hit a note, or begin and hold a sustained note |
| Release | End a hold at the written value |
| `Escape` | Pause |
| Web MIDI | Any note-on acts as a hit |

## How it plays

- A run is **8 bars**; a bar drill is **4 bars** of a single problem bar.
- **Arcade** mode raises tempo by 5 BPM every 8 hits, up to 184 BPM.
  **Practice** holds a steady tempo.
- Timing windows: `PERFECT` ±80 ms, `GOOD` ±150 ms, `OK` ±280 ms, otherwise `MISS`.
- Points: 100 / 50 / 20, multiplied by combo — 1× rising 0.5× every 5 hits, capped at 3×.
- Sustained notes held too briefly score `TOO SHORT`; held past the note score `TOO LONG`.
- Latency calibration measures your input offset and applies it to grading.

## Curriculum

| # | Tier | Start |
|---|---|---|
| 1 | Quarter & Half Pulse | 72 BPM |
| 2 | Eighths & Rests | 74 BPM |
| 3 | Eighths & Ties | 78 BPM |
| 4 | Eighths, Rests & Ties | 82 BPM |
| 5 | Quarters, Eighths & Halves | 86 BPM |
| 6 | Syncopated Mix | 88 BPM |
| 7 | Dotted Quarters | 92 BPM |
| 8 | Dotted Notes & Ties | 96 BPM |
| 9 | Dotted Rests | 98 BPM |
| 10 | Sixteenth Subdivisions | 72 BPM |
| 11 | Triplet Grooves | 80 BPM |
| 12 | Master Sight-Reading | 104 BPM |

## Meters and staves

- **Meters:** 4/4, 3/4, 2/4, 6/8 — each with its own beat grouping and click interval.
- **Staff modes:** *Treble Staff* (pitched, with a pitch per note) or
  *1-Line Rhythm* (a single rhythm line for pure duration reading).

## Share links

"Share Course" copies a URL that reproduces the exact exercise:

```
?tier=3&meter=3%2F4&staff=treble&practice=0&seed=zh6t-15um&share=1
```

`seed`, `tier`, `meter`, `staff` and `practice` are all honoured on load, so a
link is a complete lesson plan.

## Notation and audio

- VexFlow 5 rendering per bar into cached canvases, pinned to the beat grid.
- Bundled Bravura font (OFL), loaded via `FontFace` before first paint.
- Rests, dots, beams, ties, bar lines and numbers; off-beat notes are split at
  beats and tied.
- Hits play the note's pitch; holds sustain until release.
- Metronome with four styles (Click, Beep, Wood, Digital), downbeat accent,
  subdivisions off/8ths/triplets/16ths, and an independent volume bus.

## Data

Everything is local. No account, no network calls at runtime.

| Key | Contents |
|---|---|
| `rhythmFlap.v3` | Best score per `tier:meter` |
| `rhythmFlap.settings.v2` | Tempo, volumes, count row, click style, accent, subdivision, latency |

## Project structure

```
src/
  App.tsx          UI shell: menu, play HUD, pause, results
  main.tsx         React entry
  index.css        Tailwind entry
  fonts.ts         Bravura loading
  game/
    engine.ts      Run loop, timing, scoring, tempo ramp, holds
    scoring.ts     Windows, grades, combo multiplier
    rhythm.ts      Rhythmic value helpers
    notation.ts    VexFlow score construction
    layout.ts      Bar layout and hit-line geometry
    render.ts      Canvas painting
    world.ts       Bird, perches, animation state
    audio.ts       Web Audio synth: hits, holds, metronome
    storage.ts     localStorage bests and settings
    tiers.ts       Meters and the 12-tier curriculum
    rng.ts         Seeded PRNG
    types.ts       Shared types
```

## Deployment

Published to GitHub Pages on every push to `main`. See
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Documentation

- [CHANGELOG.md](CHANGELOG.md) — version history
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Pages pipeline and troubleshooting

## Known limitations

- Client-side only; no server, so no leaderboards or cross-device sync.
- VexFlow pushes the bundle past 1 MB (Vite chunk-size warning).
- No automated tests in this repository yet.
- Best scores are per browser, not per user.

## Credits

Built with Google AI Studio (Gemini), VexFlow and Bravura (SIL OFL).
