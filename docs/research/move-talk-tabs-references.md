# Move and Talk tabs: references

Decision record for the tab list asked for in comms request `2026-11-14-speech-move-talk-tabs.md` and spec section 15.

## Tab switch (the control)
Queried: Mobbin `search_screens` ios "kids learning app with two top tabs or segmented control switching activities"; Mobbin `search_screens` web "dashboard with large segmented control tabs at the top switching between two modes"; registries: none checked in depth, the app is plain HTML/CSS/JS with no shadcn or component library.
Model: Speak, course screen (https://mobbin.com/screens/9ed82b20-9d9d-40ba-8a9b-285b7c94866a): two activity modes, "Course" and "Practice", as two words at the very top; the chosen one is dark, the other muted. Deel, home (https://mobbin.com/screens/971efcdf-df46-4ad3-bfeb-562b227b95e2): pill segments, the chosen one white and raised with an icon.
Rejected: GoHenry learn (https://mobbin.com/screens/9bcd500f-f446-492e-8af1-1a50702b6db5): thin underline tabs read as navigation chrome, too quiet for the sticker style. Navan dashboard (https://mobbin.com/screens/4813b589-17e2-4fa7-803f-50a4dca5be3a): tabs inside a card switch one list, not the whole activity.
Registry: shadcn Tabs: not taken (no React, no component system in `app/`); its ARIA pattern (tablist, roving tabindex, arrow keys, Home/End) is adapted by hand.
Taken: one full-width two-segment sticker bar at the top of the page, ink outline like the buttons, chosen tab filled with `--accent` and an icon, the other white.

## Tab switch (motion)
Queried: none: the swap is instant.
Taken: no animation. Only the fill and the panel change, so reduced motion needs nothing extra.
