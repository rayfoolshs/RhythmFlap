# Architecture

## Stack

| Layer | Choice |
| --- | --- |
| Build | Vite 6, TypeScript 5.7 (`build.target: es2022` for top-level await) |
| Tests | Vitest 2 |
| UI | Vanilla TypeScript + DOM overlays; no React |
| Playfield | One 2D canvas at a virtual 960×540, letterboxed and DPR-aware |
| Notation | VexFlow 5 with Bravura, one cached canvas per bar |
| Audio | Web Audio oscillators only, no samples |
| Storage | `localStorage` (settings and per-tier bests) |

## Coordinate system and camera

- The world is **960×540**; `render()` scales it with `min(cssW/960, cssH/540)`
  and centers it, so the layout is identical on every screen.
- One beat is **67 px**; a 4/4 bar is 268 px.
- The bird (and hit line) sits at **x = 180**. About **three measures** are
  visible from the hit line to the right edge.
- `beatsElapsed` is the master clock; every x is `birdX + (beat - beatsElapsed) × 67`.
- The staff is five lines, 18 px apart, from y=250 (top) to y=322 (bottom).

## Rhythm pipeline

```
generateCourse(tier, seed)
      │  NoteEvent[]  (onset beat, duration, step, rest)
      ▼
engrave(notes)
      │  EngravedNote[]  (segments split at beat boundaries, tie flags)
      ▼
beamGroups(engraved)          score.ts builds one VexFlow bar per 4 beats
      │
      ▼
drawScore() → cached bar canvases blitted at the bar's screen x
drawTies()  → custom arcs for split segments
drawNotation() also draws the clef, 4/4, bar lines and optional count labels
```

### Generation

`generateBar` fills four beats from the tier's allowed durations, applies the
rest probability, restricts unsyncopated tiers to eighths off the beat, and
merges adjacent notes into ties (probability 0.3, total ≤ 2 beats). A course is
240 bars, seeded by `mulberry32`, so a seed reproduces the same music.

### Engraving rules

`engrave()` is display-only; the engine still scores one hit per original note.

- A note that starts **off the beat** and crosses a beat boundary is split there
  and the pieces are tied (e.g. an off-beat quarter becomes two tied eighths).
- Notes that start **on** a beat keep their written value, so a dotted quarter
  may cross a beat, as in standard notation.
- Rests split the same way but are never tied.
- `beamGroups()` beams adjacent eighths within a **half-bar** (up to four per
  beam) and breaks at rests, longer values, ties and bar lines.
- `stemDirection()` points stems down on and above the middle line (B4) and up
  below it. A beam is one stroke, so `groupStemDirection()` gives the whole group
  the direction of its note farthest from the middle line.

## Score renderer (`score.ts`)

- Each bar is rendered once into an offscreen canvas of
  `barWidth + 2 × 70 px` by `WORLD.height`, at **1:1 world pixels**.
- VexFlow's stave is created off-screen, measured with `getYForLine(0)`, and
  shifted so its top line lands exactly on `staffY(8)` (250).
- `ctx.resize(width, height, 1)` prevents VexFlow from applying the device pixel
  ratio (the main canvas already handles DPR).
- Notes are formatted with a `Voice` so modifier contexts exist, then each
  note's **tick context x is overridden** so its absolute x equals
  `PAD + beatOffset × 67 + 9`. This is what keeps engraving and timing aligned.
- Beams are drawn with VexFlow `Beam`; ties are drawn as quadratic arcs on the
  main canvas from the same beat positions.
- Bar canvases are cached per `Game` instance and evicted two bars behind the
  playhead.

The clef and 4/4 are drawn with Bravura text (not VexFlow) at fixed positions;
the bar lines, numbers and count labels are drawn on the main canvas. Notes and
bar canvases are clipped at x=134 so they disappear behind the clef.

## Bird and input

- The bird hops between perches: it holds the pitch of the note it last played,
  leaps, and touches down on the next note's perch exactly on that note's beat.
  Hang time is 60 % of the gap, clamped to 0.35–1 beat, and the arc peaks 22 px
  above the higher perch.
- Perches live in a **flight band above the staff** (`birdPerchY(step)`): the
  lowest perch clears the top line by 8 px and the band climbs 32 px for the top
  note, so the bird never covers the notation. `bird.y` is the feet.
- The hit ring flashes on the notehead just struck (`lastStep`), not on the bird.
- Key/pointer down calls `Game.press()`; up calls `Game.release()`.
- Timing windows: **PERFECT ≤ 80 ms**, **GOOD ≤ 150 ms**, **OK ≤ 280 ms**;
  outside that is a miss. Bad taps are misses.
- A note longer than an eighth starts a **hold**; releasing more than 150 ms
  before its end is `TOO SHORT`. Holding through a rest is `TOO LONG`.
- Score: 100/50/20 × combo multiplier (1× → 3× every five hits), +25 for a clean
  hold release. Combo resets on any miss.

## Run model

- A run is **eight bars** (`RUN_BARS`); playback stops one beat after the last
  bar so the final note can resolve.
- Mistakes never end the run. `accuracy = hits / (hits + misses)` and is shown
  with notes hit, best combo and top BPM on the result screen.
- Best score per tier is persisted; the result title is `NEW BEST` or
  `RUN COMPLETE`.

## Audio (`audio.ts`)

- One `AudioContext`, a master gain, and a **metronome bus** with its own gain so
  the click volume is independent of note/miss/crash feedback.
- Metronome styles: Click, Beep, Wood, Digital; optional downbeat accent and an
  optional quiet offbeat click for eighth-note subdivision.
- Hits play the note's pitch (E4–F5, triangle) for its written duration; holds
  start a sustained tone that stops on release.
- Metronome clicks are scheduled with a 150 ms lookahead against the audio clock.

## Theme

The palette is the Lakeland one from *Rhythm Quiz* (navy / green / lime), documented
with hex values in `README.md`. It lives in two places:

- The `:root` block of `src/styles.css` — every HTML surface reads these tokens.
- Canvas constants in `src/game/render.ts`, with notation ink in `notation.ts` and
  `score.ts` — a 2D context cannot read CSS variables, so those hexes are repeated
  and must be changed together.

## Settings and storage

- `rhythmFlap.v2` — best score per tier and last tier.
- `rhythmFlap.settings.v1` — tempo override, metronome volume, count toggle,
  metronome style, accent and subdivision flags.

## File map

```
src/
  main.ts          DOM wiring, input, loop, overlays, settings
  fonts.ts         loads bundled Bravura and points VexFlow at it
  styles.css       paper/ink/orange theme, HUD, menus, metronome bar
  game/
    types.ts       Tier, NoteEvent, Phase, BirdState, Grade
    rng.ts         mulberry32 + seed hashing
    tiers.ts       the nine starting tiers
    layout.ts      4/4 bar generator, course, staff geometry, PX_PER_BEAT
    world.ts       playfield constants (960×540, birdX)
    rhythm.ts      engrave() and beamGroups()
    score.ts       VexFlow per-bar engraving, caching, ties
    notation.ts    clef/4-4, count labels, drawNotation entry point
    scoring.ts     timing windows, combo, timingScore
    engine.ts      run state, tap/hold judging, misses, tempo ramp, finish
    audio.ts       Web Audio buses, metronome styles, note playback
    render.ts      letterboxed canvas renderer (card, staff, bird, popups)
    storage.ts     bests, last tier, settings
tests/             Vitest suites for the pure layers
docs/              this documentation
```
