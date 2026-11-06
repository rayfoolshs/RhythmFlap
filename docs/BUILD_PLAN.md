# Rhythm Flap — Build Plan

## Vision

A one-button rhythm game for sight-reading practice. The staff is the playfield,
notes scroll into a fixed hit line, and the player taps (and holds) in time. It
started as a study of RhythmShed's sight-reading trainer and became a
Flappy-bird-shaped arcade exercise: a bird pecks each note as it crosses the line.

The design goal is **timing accuracy over survival**. Mistakes do not end a run;
the result screen reports accuracy at the end of a fixed eight-bar exercise.

## Scope

**In scope**

- 4/4 rhythm reading with eighths, quarters, dotted quarters and halves.
- Nine starting tiers that widen the duration vocabulary and raise the tempo.
- VexFlow/Bravura engraving pinned to a beat grid, with correct beaming, ties,
  rests, splits at beat boundaries, a treble clef and a 4/4 signature.
- Tap and hold input, timing grades, combo scoring, accuracy reporting.
- Metronome with tempo, volume, sound style, downbeat accent and eighth-note
  subdivision; an optional rhythm-count row under the stave.
- Seeded courses, local best scores and persisted settings.
- Audio feedback that plays each note's pitch, sustaining held notes.

**Out of scope (for now)**

- Accounts, cloud sync, multiplayer, teacher dashboards.
- Meters other than 4/4; clefs other than treble.
- MIDI input/output, recording, notation editing.
- Backing tracks or sampled instruments.

## Milestones

| # | Milestone | Status |
| --- | --- | --- |
| M0 | Vite + TypeScript scaffold, seeded RNG, tier table, 4/4 bar generator, staff geometry | Done |
| M1 | Canvas playfield, bird, scrolling camera, first playable loop | Done |
| M2 | Timing engine: tap windows, combo, misses, tempo ramp, pause | Done |
| M3 | VexFlow/Bravura score, per-beat x pinning, clef/4/4, bar lines, ties | Done |
| M4 | Rhythmic engraving rules: off-beat splits, ties, half-bar beaming | Done |
| M5 | Sustained notes (hold/release, too short/too long), pitch playback | Done |
| M6 | Eight-bar run model, accuracy result, metronome settings, count row, docs | Done |

## Current state

- `npm run dev` serves the game at `http://localhost:5173` (the session uses 5199).
- `npm test` runs 53 unit tests across six files.
- `npm run build` type-checks and produces `dist/`; the VexFlow bundle triggers a
  chunk-size warning (~1.15 MB) but builds cleanly.

## Next steps

1. **Code-split VexFlow** with a dynamic import so the menu paints before the
   engraving engine loads; drop the chunk warning.
2. **More meters** (3/4, 6/8) and a meter selector; the engraving already works
   from beat positions, so the generator and count labels are the main work.
3. **Practice mode** without the bird: loop a single bar slowly, then return to
   the run.
4. **Teacher report**: printable run summary (accuracy, missed bars, tempo).
5. **PWA/offline**: manifest, service worker, installable on iPad.
6. **MIDI in** for pad/pedal practice.

## Risks

- VexFlow's formatter does not guarantee beat-proportional spacing; the project
  repositions tick contexts after formatting, which must be rechecked on VexFlow
  upgrades.
- Canvas letterboxing plus device-pixel-ratio handling has bitten before (bar
  canvases must render at 1:1).
- The bundle is large because of VexFlow; mobile cold starts may need the split.
