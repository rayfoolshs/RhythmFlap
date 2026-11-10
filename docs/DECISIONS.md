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

## 11. The bird flies in a band above the staff

**Context.** A bird that stands on each notehead covers the very notation the
player is reading, especially for low notes.

**Decision.** Map each note's staff step onto `birdPerchY(step)` — a compressed
band that clears the top line by 8 px and climbs 32 px for the top note. The hop
still lands on the note's perch exactly on its beat.

**Consequences.** The notation stays clear and the timing cue is unchanged, but
the bird no longer touches the note, so pitch is read from the score rather than
the bird's height. The card grew to 132–412 to give the band room.

## 12. Stem direction from the middle line, one per beam

**Context.** VexFlow's default left every stem pointing up, which reads wrong
above the B line.

**Decision.** `stemDirection(step)` points stems down on and above the middle line
and up below it. Because a beam is one stroke, `groupStemDirection()` gives every
note in a beamed group the direction of the note farthest from the middle line.

**Consequences.** Conventional-looking 4/4. Mixed-direction groups are impossible
by design, which matches engraving practice.

## 13. Lakeland palette in CSS tokens and canvas constants

**Context.** The department's *Rhythm Quiz* has a documented Lakeland palette, and
this game should sit alongside it.

**Decision.** Mirror the palette in the `:root` block of `styles.css` for HTML,
and repeat the hexes as constants in `render.ts`, `notation.ts` and `score.ts`
for the canvas, which cannot read CSS variables.

**Consequences.** One palette, two homes: a colour change means editing both. The
duplication is deliberate and small (a dozen values) rather than a runtime lookup
of computed styles, which would break if the canvas renders before CSS loads.
