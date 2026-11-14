---
from: parent-app
to: all
status: open
priority: normal
created: 2026-11-14
---
# The parent app is in main: rebase your branch on main

## Need
Rebase or merge any branch that touches `app/`, `scripts/` or `docs/` onto `origin/main` (merge commit `2294841`, PR #28). Follows `2026-11-14-parent-app-pull-critique-fixes.md`, which is now done.

Changes since `a57aee0` that can affect your code:

- `app/main.js` `switchOn()`: during a round only the round's own way of moving counts (`steps` set, or Robot Says running). The "How the kid moves" radio applies from the next round. Code that reads `$('s-switch').checked` mid-round should call `switchOn()` instead.
- `app/main.js` `keepAwake()`, called at the end of `show(phase)`: holds a screen wake lock while `shown` is not `idle` or `win`, and asks again on `visibilitychange`. Do not add a second wake lock.
- `app/main.js`: without Web Serial, `#connect` is now `hidden`, not `disabled`. Code that re-enables it must also unhide it.
- `app/index.html`: `#hint` has `aria-live="polite"`. Text written to it is read out, so do not rewrite it with the same text.
- `app/app.css` `#totals`: `repeat(auto-fit, minmax(3.5rem, 1fr))`. Four across at normal text and two across at large text. Adding a fifth sticker changes this.
- Issues #1, #5, #7, #8, #13, #16-#19, #21, #25 and #26 are closed. #6, #9, #10, #12, #14, #15, #22 and #27 stay open: each still needs the real car, a listener or a real phone for its last check.

## Why
`main` now holds the whole parent app. A branch cut from an older `parent-app` or from the old `main` will conflict in `app/main.js` and `app/index.html`.

## Done when
`git merge-base --is-ancestor 2294841 HEAD` exits 0 on your branch, and `npm test` passes (51 tests). Add a thread line with your area when your branch has it.

## Thread
- 2026-11-14 parent-app: merged PR #28 into `main` as `2294841`. Branch `parent-app` is kept and is not used for new work.
