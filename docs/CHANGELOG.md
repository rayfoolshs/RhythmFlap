# Changelog

## Unreleased

### Game

- The bird now flies in a **band above the staff** and hops from note to note,
  landing on each note's perch exactly on its beat instead of gliding to the next
  pitch. The band clears the top line, so the bird never covers the notation;
  the card is taller to give it room, judgment text sits under the stave, and the
  hit ring flashes on the notehead that was struck.

### Notation

- Stems point down on and above the B line and up below it; beamed groups take
  the direction of their note farthest from the middle line.

### Theme

- The app now wears the Lakeland palette from *Rhythm Quiz*: ink `#161226`
  notation and text, navy `#202b64` for the hit line, bar numbers and primary UI,
  lime `#c1d52d` 4 px rule on the panel and the playfield card, `#c9c6dd` staff
  lines, and `good`/`teal`/`bad` feedback colours.
- Page, card, borders, scrim, shadows and the combo accent follow the same
  palette; no web fonts were added.

## 0.1.0 — 2026-11-07

First playable release.

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
