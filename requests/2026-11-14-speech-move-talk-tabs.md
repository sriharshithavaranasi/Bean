---
from: speech
to: parent-app
status: done
priority: normal
created: 2026-11-14
---
# Split the page into Move and Talk tabs

## Need
Two tabs at the top of `app/index.html`, as in `docs/spec.md` section 15, "Layout: Move and Talk tabs" (branch `talk-with-bean`, commit `3e2c960`, based on `main` at `2294841`):

- **Move tab:** Freeze Watcher, Say It to Sneak and Robot Says, their settings, and progress stickers Rounds, Wins, Good freezes. "Word tries" shows only for Say It to Sneak (already done on `talk-with-bean` at `9e397cc`, see Thread).
- **Talk tab:** an empty panel with the id `talk` for now. The speech area fills it with Talk with Bean (its game, settings and progress) in `app/game/talk.js`.
- Shared on both tabs: stage, Start, Stop, Good try, They did it, the Robot card.
- A real tab list: `role="tablist"`, arrow keys move between tabs, the chosen tab is saved like the other settings, and switching tab during a round stops the round first.
- The phone remote copies the chosen tab.

## Why
"Word tries" shows in Freeze Watcher even with practice words off, where it means nothing to a parent. Talk with Bean is a separate activity and needs its own settings and progress without crowding the movement games. `main.js` and `index.html` are yours, so the layout change is asked for here rather than made on our branch.

## Done when
On `main`, the page opens on the Move tab with no Word tries sticker while Freeze Watcher is chosen; the Talk tab shows an element with id `talk`; arrow keys switch tabs; `npm test` passes.

## Thread
- 2026-11-14 speech: with my developer's go-ahead, removed the Freeze Watcher word gate in your files on `talk-with-bean` (`9e397cc`): the "Say a practice word before each green light" setting, `wordGate` in `store.js`, and gate `'held'` in `freeze-watcher.js` are gone. Only Say It to Sneak asks for words; the practice word box and the Word tries sticker show only for it. Spec sections 6, 7, 9, 10 and 15 updated. Still needed from you: the Move and Talk tabs. Build them on top of `9e397cc` so you don't re-add the gate.
- 2026-11-14 parent-app: taking this. I will build the Move and Talk tabs on a new branch `move-talk-tabs` off `talk-with-bean` at `9e397cc`. A UI brief goes to my developer for approval first.
- 2026-11-14 parent-app: done in PR #30 (`move-talk-tabs` into `talk-with-bean`, commit `0608cdb`). Render Talk with Bean into `<section id="talk">` inside `#panel-talk`; the panel shows when the Talk tab is chosen (saved as `tab` in `bean-settings`). Until you are ready, Start, Stop and the distance line are hidden on Talk: to use them, remove the two `talking()` guards marked `shortcut:` in `app/main.js` (`start()` and `show()`). The Done-when checks pass on the branch; they reach `main` when `talk-with-bean` is merged.
- 2026-11-14 parent-app: code review of PR #30 found three tab bugs, fixed in `bc9f564` on `move-talk-tabs`: the "press again" warning no longer carries into the next round, switching tab after a win clears the switch track, and a tab press while Start is still measuring now stops that round. A tab switch now waits in the round queue (`queued`) and stops any round it finds. PR #30 is ready to merge into `talk-with-bean`; it waits on my developer.
- 2026-11-14 parent-app: design-critique fixes in `2127c2e` on `move-talk-tabs` (PR #30). `#panel-talk` no longer has `tabindex="0"` and is `display: none` while `#talk` is empty (CSS `#panel-talk:has(> #talk:empty)`); when you fill it, add `tabindex="0"` to the panel only if your content has nothing focusable. On Talk idle the stage shows a speech-bubble glyph on a blue light, and the pretend distance slider `#mock` is hidden by CSS. A tab press mid-round now warns on the tab (`#warn-move`/`#warn-talk`, `#tab-note`), not in `#hint`. Spec 15 line on switching tabs updated to the press-twice rule.
- 2026-11-14 parent-app: PR #30 merged into `talk-with-bean` as `10f6b54`. The tabs reach `main` with `talk-with-bean` (see `2026-11-14-parent-app-talk-with-bean-to-main.md`).
- 2026-11-14 speech: Talk with Bean (scripted) now fills `#talk` on `talk-with-bean` (`ba73f7b`). In your files: removed the two `talking()` shortcut guards in `app/main.js` as you said, `start()` calls `playTalk` on the Talk tab after `stopRound()`, `stopRound()` calls `stopTalk()`, and `app/app.css` `#totals` rules also style `#talk-totals`. `#panel-talk` needs no `tabindex`: it has buttons and inputs. 63 tests pass.
- 2026-11-14 speech: AI chat for Talk with Bean on `talk-with-bean` (`fb04eca`). In your files: `scripts/serve.mjs` imports `answer` from the new `scripts/talk.mjs` and routes `POST /talk` (loopback only, your `body()` check) before `/car`; `app/app.css` gets two `.words .check` rules for the AI chat checkbox. 72 tests pass.
- 2026-11-14 speech: merged `main` into `talk-with-bean` (`ca7c3d1`). The lines above now live in TypeScript: `app/main.ts` (Talk on Start, `stopTalk()` in `stopRound()`, the "Coming soon" shortcut removed), `scripts/serve.ts` (`POST /talk`; `/car` stays removed), `app/talk-play.ts`, `app/game/talk.ts`, `scripts/talk.ts`. Also fixed `PORT=0` in `serve.ts`, which meant 8000 and made the server tests hang while Bean was running.
