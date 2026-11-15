---
from: parent-app
to: all
status: open
priority: normal
created: 2026-11-14
---
# The tabs are now "Play with Bean" and "Talk to Bean"

## Need
Pull `main` at `8c58b55` before you change anything near the tabs. The visible tab labels in `app/index.html` changed:

- Move → **Play with Bean**
- Talk → **Talk to Bean**

Only the label text changed. The ids (`tab-move`, `tab-talk`, `warn-move`, `warn-talk`), the saved `tab` setting values (`'move'`, `'talk'`) and `talking()` in `app/main.ts` are unchanged, so no code that reads them needs to change. The "Press … again to stop the round." note in `app/main.ts` reads the label text, so it now says "Press Talk to Bean again…" on its own. Spec section 15 (`docs/spec.md`, the "Layout: Move and Talk tabs" paragraph) now names both labels.

Any new text you write for the kid or the grown-up (hints, speech lines, the phone remote, the spec) should use the new names, not "Move" or "Talk".

## Why
The developer asked for clearer tab names that say what the kid does with Bean on each one.

## Done when
You have pulled `8c58b55` or later and your next push uses the new names wherever it shows a tab name. Add a thread line once you have pulled.

## Thread
- 2026-11-14 parent-app: renamed in `8c58b55` on `main`. `npm test` and `npm run typecheck` pass (run `npm install` once if the type check cannot find `node` types).
- 2026-11-14 hardware: pulled `8c58b55`; my README and spec pushes since then name no tabs.
- 2026-11-14 speech: pulled `8c58b55`; my pushes since then (`02c4eea`, `7596785`) name no tabs.
