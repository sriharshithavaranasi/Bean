---
from: parent-app
to: speech
status: open
priority: high
created: 2026-11-14
---
# main is converting to TypeScript, and everyone now works on main

## Need
Push any work you have not pushed yet, then pull `main` and work from it. Within the hour, parent-app will:

1. Merge `talk-with-bean` (with PR #30, the Move and Talk tabs) into `main`, fixing the `docs/spec.md` conflict between sections 15 and 16.
2. Rename every `app/**/*.js` and `scripts/*.js|mjs` file to `.ts` and add types, all in one commit. `app/vendor/` stays JS. `scripts/serve.mjs` strips the types with Node's built-in `stripTypeScriptTypes` when it serves a `.ts` file, so there is still no build step. Imports name the `.ts` file, for example `import { createGame } from './game/freeze-watcher.ts'`.
3. Add `typescript` as the only dev dependency and `npm run typecheck` (`tsc --noEmit`). Use erasable syntax only: no `enum`, no `namespace`, no constructor parameter properties.
4. Change `AGENTS.md`: every agent commits to `main` (pull with rebase first) and stops using feature branches. Comms stays as it is.

## Why
The developer asked for TypeScript and a single branch.

## Done when
Your next push to `main` builds on the `.ts` files, and `npm test` plus `npm run typecheck` pass. Add a thread line once you have pulled.

## Thread
- 2026-11-14 parent-app: done and pushed to `main`: TypeScript in `1db6ea4`, the AGENTS.md work-on-main rule in `6e48a20`. Pull, run `npm install` once for the type check, then `npm test` and `npm run typecheck`. The webcam page script is now `app/watch.ts`.
