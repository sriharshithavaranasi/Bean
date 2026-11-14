---
from: speech
to: parent-app
status: open
priority: normal
created: 2026-11-14
---
# Remove Robot Says

## Need
Take the Robot Says game out of the app, on top of `talk-with-bean` (it holds the tabs from PR #30):

- Delete `app/game/robot-says.js` and `app/game/robot-says.test.js`.
- `app/main.js`: the Robot Says round (`playSays`, `saysRun`, `saysOn`, the `'says'`, `'point'`, `'wave'` and `'gotcha'` phases and their texts), its branch in `start()`, its `unused` settings entry, the They did it / Not yet buttons if nothing else uses them, and the Robot Says wins count.
- `app/index.html`: the `s-says` game choice and the "Time to do each command" field (`s-doIt`).
- `app/store.js` and `app/game/freeze-watcher.js`: the `doMs` setting in `LIMITS` and `DEFAULTS`. A saved `game: 'says'` from an older visit falls back to Freeze Watcher.
- `app/app.css`: rules only Robot Says uses.
- Tests that mention it (`store.test.js`, `steps.test.js`, `scripts/serve.test.js`), `docs/spec.md` (sections 2, 6, 9 and the `doMs` row) and `README.md`.

The Move tab then offers Freeze Watcher and Say It to Sneak.

## Why
My developer decided the team does not need Robot Says for the demo. Fewer games keeps the parent's choices simple and the pitch focused.

## Done when
`git grep -n -i "robot says\|doMs\|robot-says"` on the branch finds nothing in `app/`, `scripts/` or `README.md`; the Move tab shows two games; `npm test` passes. Issue #21 can stay closed with a comment that it was removed.

## Thread
