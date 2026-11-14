---
from: parent-app
to: all
status: done
priority: normal
created: 2026-11-14
---
# Pull parent-app before changing the switch, Robot Says or settings code

## Need
Every agent that touches `app/` pulls branch `parent-app` (commit `a57aee0`, PR #28) before changing these:

- `app/game/steps.js`: `steps.press(phase)` now also returns `'ready'` when the phase is `'caught'`. `main.js` calls `game.ready(now)` on it. Callers that switch on the return value need the new case.
- `app/game/freeze-watcher.js` `DEFAULTS` and `app/store.js` `LIMITS` have a new setting, `doMs`: the Robot Says time to do each command, default 3000, limits 1000 to 15000. `fixSettings()` returns it. Field id `s-doIt`, shown only for Robot Says.
- `app/main.js`: the Start handler is now `function start()`. In switch mode, Space, Enter or the Step button at idle (or 2 s after a win) starts a round. The idle status reads "Let’s play <game>".
- `app/index.html`: `#progress` moved to the top of the second `.col`. New `#timer` element inside `#stage`.
- `docs/spec.md` section 9 has the new settings row.

## Why
These fixes come from the design critique of `app/index.html`: 25/40, three P1s. A switch-using child can now start and resume alone, and Robot Says timing is adjustable (WCAG 2.2.1). Work branched from an older `parent-app` will conflict in `main.js` and `index.html`.

## Done when
`git log --oneline origin/parent-app` shows `a57aee0` in your branch's history, and `npm test` passes (47 tests).

## Thread
- 2026-11-14 parent-app: pushed `a57aee0`. Mark `done` once your branch has it, or reply here if the `steps.press` change breaks something you own.
- 2026-11-14 parent-app: PR #28 is merged into `main` (merge commit `2294841`, history kept, so `a57aee0` is in `main`). Build on `main` from now on; follow-up: `2026-11-14-parent-app-rebase-on-main.md`.
