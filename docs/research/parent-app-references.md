# Parent app references (issue #25)

Brief: a phone-first web page a parent holds while their kid plays Red Light, Green Light with Bean. The screen's one job is to show the light state so it reads at a glance, with Start and Stop always in reach. Plain HTML, CSS and JS modules, no build step, no dependencies, WCAG 2.2 AA, works at 360 px.

Queried on 2026-11-13. Mobbin results are cited by app and screen type; the screens themselves were not saved to a collection.

## Light state on the stage
Queried: Mobbin `search_screens` "workout timer circular state" (Ahead, Runna, WHOOP, Hevy, Gymshark); 60fps.design not queried (static phase, motion comes in Phase 3); registries not queried.
Model: Ahead timer and Runna run screen: one large shape or full-bleed colour carries the state, one line of big text names it, everything else is small.
Rejected: Hevy and Gymshark workout screens: dense number tables, a parent watching a kid cannot read them at arm's length.
Registry: not taken (plain HTML, no build step, no `components.json`).
Taken: one large light plus a status heading and a single hint line; colour is never the only signal (glyph and words change too).

## Start and Stop
Queried: Mobbin `search_screens` "device control" (Google TV remote, Tesla, Google Home, Alexa, Hue); registries not queried.
Model: Google TV remote and Tesla controls: the one primary action is the largest target, the stop action sits beside it and is always enabled.
Rejected: Hue scene grid: equal-weight tiles hide which button stops the robot.
Registry: not taken (plain HTML, no build step).
Taken: Start is two thirds of the row, Stop one third, both at least 48 px tall; direction 2 pins them to the bottom of the phone screen.

## Parent buttons, progress and settings
Queried: Mobbin `search_screens` "kids app parent screen"; Google Home device tiles from the device-control query; ui-ux-pro-max `product`, `color`, `typography` (the `style` query returned no results).
Model: Google Home tiles: tonal tiles of equal size for secondary actions and small stats.
Rejected: parent-gate patterns (hold to unlock, maths question): the parent already holds the phone, a gate only slows Stop.
Registry: not taken (plain HTML, no build step).
Taken: a 2 by 2 grid of parent buttons under the controls, four totals with a two-press Reset, settings in a `<details>` that opens by default on wide screens.

## Five directions (Phase 1)
Queried: the three Mobbin queries above; ui-ux-pro-max palettes and font pairings.
Model: 1 Crossing Guard: the team example's palette. 2 Flood: Ahead, Runna. 3 Night Remote: WHOOP, Google TV, Tesla. 4 Signal Box: no app reference, wildcard drawn from a real traffic signal. 5 Bean's Face: Google Home tiles.
Rejected: glow shadows on the dark ring and signal lamps (flagged by the impeccable detector, removed).
Registry: not taken (plain HTML, no build step).
Taken: pending the user's choice at the Phase 1 checkpoint.

## Direction chosen (2026-11-13)
Taken: 1 Crossing Guard. The user asked for custom adjustment controls instead of the browser's small up and down arrows, and a less default look. Themes 2 to 5 were deleted.

## Number settings (Phase 2)
Queried: Mobbin `search_screens` ios "timer settings screen with plus and minus stepper for duration"; 60fps.design not queried (static phase); registries not queried.
Model: [Jomo](https://mobbin.com/screens/13c9a155-2090-4c9a-a157-fe5e3886eccb) and [Opal](https://mobbin.com/screens/bfc2eb17-8f57-4b70-b34b-c6ecd766ed30): round minus and plus buttons either side of a large value that carries its unit ("3 times", "5m"). [Brink](https://mobbin.com/screens/de0bc3ac-8c9e-4604-96d0-bf4d2a2fbe44): a ticked ruler under a large number.
Rejected: [Insight Timer](https://mobbin.com/screens/1bdf080b-2d81-4ce8-9cf9-a180fa90f65f) scroll wheels: three wheels per value is too much for six one-number settings. [Once](https://mobbin.com/screens/82cfa82f-cbe5-4194-a4a8-8b24cc9a66a1) radial dial: needs custom drag code and a keyboard path, against the no-new-code-without-need constraint.
Registry: not taken (plain HTML, no build step).
Taken: the native number box stays as the value (typing and arrow keys still work) with its spinner hidden; round 44 px minus and plus buttons call `stepDown()` and `stepUp()`; a ticked ruler is a styled native range input mirroring the same value. 1a shows the stepper, 1b the ruler, 1c both.

## Choice settings (Phase 2)
Queried: same Mobbin query ([Tripadvisor](https://mobbin.com/screens/66ff51d9-17bd-4cc1-8c7d-ebd492f572e9) segmented control, Once plan tiles).
Model: Tripadvisor: a filled pill marks the chosen option, the others stay outlined.
Rejected: native select: it hid the games that are coming and clipped its text.
Registry: not taken (plain HTML, no build step).
Taken: radio buttons drawn as chips; options not built yet are dashed, disabled and tagged "soon".

## Refinement chosen (2026-11-13)
Taken: 1c Lollipop (stepper and ruler together, yellow action colour, lilac side panels). 1a served as the plain twin for the yellow accent (same layout with an ink Start button); the user picked the yellow. Tokens moved into `app/app.css`, trial themes and the compare grid deleted, Fredoka and Nunito served from `app/fonts/`.

## Light state change (motion)
Queried: 60fps.design not queried and no storyboard made, so this section rests on the 60fps-motion laws only (transform only, reduced motion respected). Mobbin and registries not queried.
Model: none measured.
Registry: not taken (plain HTML, no build step).
Taken: the light scales from 0.85 to 1 over 280 ms with an ease-out curve (no overshoot) on every state change; background colour keeps its 150 ms fade. Nothing else moves. Off under `prefers-reduced-motion`.

## Direction carried to the rest of the page (2026-11-13)

The user approved the reworked game stage and asked for the same direction everywhere else, keeping the cream background and keeping both the stepper and the ruler in settings. No new references were queried; these follow the direction already chosen.

- Progress: each total is an ink-outlined sticker tinted with the colour of what it counts (rounds yellow, wins purple, good freezes green). Word tries is hidden until speech is built.
- Robot: a status dot beside the connection words (green only while the real car is connected), the pretend distance shown as a large number, a larger pretend light.
- Settings: name on its own line, then less, value box, more; the ruler sits beside them on wide screens and on its own line under 520 px. The Game and "How the kid moves" choices are hidden until a second option works.
- Anything that does not work yet is hidden, not shown disabled.
- Desktop: the game column stays in view while the settings column scrolls, and the light grows to 300 px.
