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
