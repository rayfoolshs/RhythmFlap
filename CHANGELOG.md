# Changelog

Version history for Rhythm Flap. Entries follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
dates are the commit dates of each release point.

## Unreleased

_Nothing yet._

## 1.0.1 — 2026-11-14

### Fixed

- Restored the **"Created by Ray Foo"** credit under the menu tagline, with
  links to [rayfooproductions.com](https://www.rayfooproductions.com). The React
  port had dropped the line that existed in the 0.1.x vanilla build.

## 1.0.0 — 2026-11-14

First public release, published to GitHub Pages at
<https://rayfoolshs.github.io/RhythmFlap/>. The vanilla TypeScript app was ported
to React and the curriculum widened beyond 4/4.

### Added

- **Meters:** 4/4, 3/4, 2/4 and 6/8, each with its own beat grouping, click
  interval and bar spacing.
- **Staff modes:** *Treble Staff* (pitched) and *1-Line Rhythm* (duration only).
- **Practice mode** holding a steady tempo, alongside the ramping **Arcade** mode.
- **Latency calibration** that measures input offset and applies it to grading.
- **Early/late diagnostics** in the run summary — average drift in ms, labelled
  *Rushing (Early)*, *Dragging (Late)* or *Steady Pulse*.
- **Bar drills:** 4-bar focused runs on a single problem bar, reported as
  `BAR n DRILL COMPLETE`.
- Curriculum expanded from 9 to **12 tiers**, adding dotted rests, sixteenth
  subdivisions, triplet grooves and a master tier.
- Shareable course URLs carrying `tier`, `meter`, `staff`, `practice`, `seed`
  and `share=1`.
- Web MIDI note-on as a hit input.
- GitHub Pages deployment pipeline.

### Changed

- Rewritten as a React 19 app (`App.tsx`) with Tailwind CSS 4, replacing the
  hand-rolled DOM shell in `main.ts` / `styles.css`.
- Best scores are now keyed per `tier:meter` rather than per tier.
- Storage schema bumped to `rhythmFlap.v3` and `rhythmFlap.settings.v2`.

### Fixed

- Pages served a blank page when deployed from the repository root: the
  `index.html` entry pointed at raw `/src/main.tsx`, which browsers cannot
  execute, and assets used absolute `/assets/` paths that 404 under a project
  subpath. The build now runs through Vite with an explicit base path.

### Infrastructure

- `vite.config.ts` honours `PAGES_BASE` so assets resolve under `/RhythmFlap/`.
- `deploy.yml` runs install → type check → build → deploy on every push to `main`.
- `esbuild` bumped to `^0.28` to satisfy Vite 8's peer range.
- `package-lock.json` committed for reproducible `npm ci`.

## 0.1.1 — 2026-11-10

### Game

- The bird now flies in a **band above the staff** and hops from note to note,
  landing on each note's perch exactly on its beat instead of gliding to the next
  pitch. The band clears the top line, so the bird never covers the notation; the
  card is taller to give it room, judgment text sits under the stave, and the hit
  ring flashes on the notehead that was struck.

### Notation

- Stems point down on and above the B line and up below it; beamed groups take
  the direction of their note farthest from the middle line.

### Theme

- The app wears the Lakeland palette from *Rhythm Quiz*: ink `#161226` notation
  and text, navy `#202b64` for the hit line, bar numbers and primary UI, lime
  `#c1d52d` 4 px rule on the panel and the playfield card, `#c9c6dd` staff lines,
  and `good`/`teal`/`bad` feedback colours.
- Page, card, borders, scrim, shadows and the combo accent follow the same
  palette; no web fonts were added.

## 0.1.0 — 2026-11-07

First playable release, built in vanilla TypeScript.

### Game

- Eight-bar exercises over a scrolling staff with a bird that glides to each
  note's pitch.
- Tap timing with PERFECT/GOOD/OK windows and combo scoring.
- Sustained notes: hold for the written value, release at the end; `TOO SHORT`
  and `TOO LONG` penalties.
- Mistakes no longer end a run; the result screen reports accuracy, notes hit,
  best combo and top BPM.
- Nine starting tiers and a tempo ramp every eight hits.
- Seeded, reproducible courses (`?tier=&seed=&share=1`).
- Per-tier best scores in `localStorage`.

### Notation

- VexFlow 5 + bundled Bravura, rendered per bar into cached canvases and pinned
  to the beat grid.
- Treble clef and 4/4, bar lines and numbers, rests, dots, beams, ties.
- Off-beat notes split at beats and tied; rests split; half-bar beaming in 4/4.
- Optional count row under the stave (`1 + 2 + 3 + 4 +`).

### Audio

- Hits play the note's pitch; holds sustain until release.
- Metronome with four styles (Click, Beep, Wood, Digital), downbeat accent,
  Off/8ths/Triplets/16ths subdivisions, independent volume bus.
- Miss and end-of-run feedback tones.

### App

- In-exercise metronome bar, pause panel, tier menu, result screen.
- Settings persistence (tempo, volume, count, style, accent, subdivision).
- Bundled font, Vite `es2022` target for top-level await.
- 53 Vitest tests across six files.
- Docs: README, build plan, architecture, testing, decisions, changelog.

### Known issues

- VexFlow pushes the production bundle to ~1.15 MB (Vite chunk-size warning).
- 4/4 and treble clef only.
- No end-to-end or visual regression tests.

## Repository history

Rhythm Flap was developed in `rayfoolshs/rhythm-flap` (0.1.0 → 0.1.1), which
also held the original vanilla implementation, the 53-test Vitest suite, and the
design documents (`ARCHITECTURE.md`, `BUILD_PLAN.md`, `DECISIONS.md`,
`TESTING.md`).

That repository and its Pages site were **retired on 2026-11-14** in favour of
this one. Its full history — both commits, the vanilla implementation, the
53-test Vitest suite and the design documents — was archived to a git bundle
before deletion, recoverable with:

```bash
git clone rhythm-flap-backup.bundle rhythm-flap
```
