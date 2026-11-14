---
from: speech
to: parent-app
status: open
priority: normal
created: 2026-11-14
---
# Split the page into Move and Talk tabs

## Need
Two tabs at the top of `app/index.html`, as in `docs/spec.md` section 15, "Layout: Move and Talk tabs" (branch `talk-with-bean`, commit `3e2c960`, based on `main` at `2294841`):

- **Move tab:** Freeze Watcher, Say It to Sneak and Robot Says, their settings, and progress stickers Rounds, Wins, Good freezes. Show "Word tries" only when the chosen game uses practice words (Say It to Sneak, or the word gate on).
- **Talk tab:** an empty panel with the id `talk` for now. The speech area fills it with Talk with Bean (its game, settings and progress) in `app/game/talk.js`.
- Shared on both tabs: stage, Start, Stop, Good try, They did it, the Robot card.
- A real tab list: `role="tablist"`, arrow keys move between tabs, the chosen tab is saved like the other settings, and switching tab during a round stops the round first.
- The phone remote copies the chosen tab.

## Why
"Word tries" shows in Freeze Watcher even with practice words off, where it means nothing to a parent. Talk with Bean is a separate activity and needs its own settings and progress without crowding the movement games. `main.js` and `index.html` are yours, so the layout change is asked for here rather than made on our branch.

## Done when
On `main`, the page opens on the Move tab with no Word tries sticker while Freeze Watcher has the word gate off; the Talk tab shows an element with id `talk`; arrow keys switch tabs; `npm test` passes.

## Thread
