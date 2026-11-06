# Decisions

Short ADR-style records of choices that shape the code.

## 1. VexFlow engraving with beat-pinned positions

**Context.** The score must look like real notation, but a rhythm game needs every
onset to sit exactly at its beat.

**Decision.** Render each bar with VexFlow, then override each note's tick-context
x so `getAbsoluteX()` equals `PAD + beatOffset × 67 + 9`. Formatting still runs
first so modifier contexts (dots, beams, ties) exist.

**Consequences.** VexFlow quality with sample-accurate timing. VexFlow upgrades
must be retested because tick contexts are internal API.

## 2. One cached canvas per bar

**Context.** Re-formatting and redrawing notes every frame is wasteful and can
jitter positions.

**Decision.** Build each measure once into an offscreen canvas at 1:1 world pixels
and blit it at the bar's screen x. Cache per `Game` and evict bars behind the
playhead.

**Consequences.** Cheap scrolling and stable x positions. Bars are rebuilt if the
game changes (new run). Bar canvases must not apply device-pixel ratio, hence
`resize(width, height, 1)`.

## 3. Bundle Bravura and register it as "Bravura"

**Context.** VexFlow and OSMD expect the SMuFL family name "Bravura"; relying on a
system font breaks on other machines.

**Decision.** Ship `Bravura.otf` under the SIL OFL and load it with `FontFace`
under the name VexFlow uses; point VexFlow at it with `VexFlow.setFonts`.

**Consequences.** Portable engraving, larger bundle, font must load before the
first bar (top-level await in `main.ts`, `build.target: es2022`).

## 4. Fixed eight-bar run, no fail state

**Context.** A Flappy game normally ends on a collision, but mistakes should be
learning data, not a game over.

**Decision.** The run ends after eight bars; misses reset the combo and count
toward accuracy. Accuracy is `hits / (hits + misses)`.

**Consequences.** No lives/hearts; the result screen is the feedback loop. The
course generator still produces 240 bars in case longer runs are wanted later.

## 5. Holds for values longer than an eighth

**Context.** The trainer should teach duration, and the notation shows ties and
dotted values.

**Decision.** Notes with more than 0.5 beats are sustained: press at the onset,
hold until the written end. Releasing more than 150 ms early is `TOO SHORT`;
holding through a rest is `TOO LONG`; clean release adds +25.

**Consequences.** One key can still articulate consecutive notes by releasing and
pressing at the boundary. The engine tracks one active hold.

## 6. Split off-beat notes, beam by half-bar

**Context.** Generated rhythms can cross beats and look metrically ambiguous.

**Decision.** `engrave()` splits off-beat notes that cross a beat and ties the
pieces; on-beat dotted values stay intact. Eighths are beamed in half-bar groups
and breaks at rests, longer values, ties and bar lines.

**Consequences.** Correct-looking 4/4; the engine still scores one hit per
original note (the split is display-only).

## 7. Count row instead of a floating count card

**Context.** The sightreading-rhythm-assistant shows a live count card.

**Decision.** Draw the count under the notes on the stave: beat numbers on the
beat, `+` on the offbeat, behind a **Count** switch.

**Consequences.** The count stays tied to the actual rhythms; labels only appear
at events (no continuous grid).

## 8. Metronome options

**Context.** A single click is limiting for practice.

**Decision.** Offer four oscillator timbres (Click, Beep, Wood, Digital), an
optional downbeat accent, and Off/8ths/Triplets/16ths subdivisions. Tempo and
volume live in the same bar; volume has its own gain bus.

**Consequences.** The metronome is independent of note/miss/crash feedback. All
choices persist.

## 9. Local-only storage

**Context.** Classroom use should not require accounts.

**Decision.** Best scores and settings live in `localStorage`; there is no backend.

**Consequences.** Private by default, but no sync between devices and clearing
browser data loses scores.

## 10. Vanilla TypeScript + canvas

**Context.** The game is a single full-screen canvas plus a handful of overlays.

**Decision.** Use plain TypeScript modules and DOM overlays; no React or state
library.

**Consequences.** Small UI code and no framework overhead; screens are managed by
explicit show/hide helpers in `main.ts`.
