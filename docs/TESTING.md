# Testing

## Commands

```bash
npm test          # Vitest, single run
npm run test:watch
npm run build     # tsc --noEmit + Vite production build
```

## Automated coverage

57 tests across six files:

| File | Covers |
| --- | --- |
| `tests/rng.test.ts` | seed hashing, determinism, range, slug-safe seeds, pick/randInt |
| `tests/layout.test.ts` | 4-beat bars, allowed durations/rests, tie rules, reproducibility, pitch bounds, staff mapping, ordering |
| `tests/rhythm.test.ts` | off-beat splitting, tie flags, rest splitting, on-beat values kept, half-bar beaming, rest/long-note breaks, stem direction, beamed-group stems |
| `tests/notation.test.ts` | duration → note value, filled/hollow, dotted, stemmed |
| `tests/scoring.test.ts` | timing windows, early/late symmetry, combo multiplier, points |
| `tests/engine.test.ts` | start, custom tempo, deterministic courses, hit windows, no double hits, misses, rests, holds (clean/early), rest-hold penalty, tempo ramp, hop landing, hop arc, pause, accuracy, eight-bar finish |

The engine tests use a `Sound` stub; audio output itself is not unit-tested.

## Manual QA

Run `npm run dev` and check:

1. **Tempo** — start a run and drag the BPM slider; the notes and metronome
   change speed immediately. Pause and use the pause tempo slider; resume.
2. **Volume** — the metronome slider silences only clicks; hits, misses and the
   end sound stay audible. It also works from the pause panel.
3. **Sound styles** — Click, Beep, Wood and Digital are distinct; Accent changes
   beat 1; Off/8ths/Triplets/16ths add the right number of quiet clicks.
4. **Count** — the row under the stave shows beat numbers and `+` at the right
   positions; toggling it off hides the row.
5. **Holds** — a quarter/dotted/half note must be held; early release shows
   `TOO SHORT`; holding through a rest shows `TOO LONG`; a clean release shows
   `HELD`.
6. **Run end** — after eight bars the result appears with accuracy; mistakes do
   not end the run.
7. **Retry / new course** — `Space` retries the same seed, `R` rolls a new one,
   `Esc` returns to the tier menu.
8. **Seeded link** — `?tier=8&seed=…&share=1` starts that course.
9. **Touch** — pointer down/up holds work on a touch device; sliders are usable.
10. **Visibility** — switching tabs pauses the run and shows the pause panel.
11. **Bird** — it flies in the band above the staff, never over the notation;
    each hop lands on the next note's perch as that note crosses the line; the
    hit ring flashes on the notehead.
12. **Stems** — notes on and above the B line stem down, below it stem up, and a
    beamed group follows its note farthest from the middle line.
13. **Theme** — menu, HUD, metronome bar, playfield card and notation use the
    Lakeland palette (lime rules, navy accents, `#C9C6DD` staff lines).

## Gaps

- No end-to-end/visual regression tests; the score has been checked with
  screenshots at 2× device scale.
- VexFlow layout is validated by eye and by unit-testing the pre-engraving
  rhythm rules, not by asserting rendered x positions.
- Audio scheduling is not asserted; metronome/subdivision correctness is manual.
