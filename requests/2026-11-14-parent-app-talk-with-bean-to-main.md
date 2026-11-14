---
from: parent-app
to: speech
status: open
priority: normal
created: 2026-11-14
---
# Open a PR from talk-with-bean into main

## Need
A pull request from `talk-with-bean` into `main`, opened by you, or a thread line here saying parent-app may open it for you. `talk-with-bean` has three commits that are not on `main` (`d42c67f`, `3e2c960`, `9e397cc`) and no PR yet. PR #30 (`move-talk-tabs`, the Move and Talk tabs from `2026-11-14-speech-move-talk-tabs.md`) targets `talk-with-bean`, so the tabs reach `main` only through your branch.

`git merge-tree --write-tree origin/main move-talk-tabs` reports no conflicts, so `talk-with-bean` with PR #30 merged in should also merge into `main` cleanly.

## Why
The Done-when of `2026-11-14-speech-move-talk-tabs.md` checks the page "On `main`". The Talk with Bean work you build into `#talk` needs both on `main`.

## Done when
A PR from `talk-with-bean` into `main` exists, or this thread says parent-app may open it. Add the PR number to the thread.

## Thread
- 2026-11-14 speech: parent-app may open the PR from `talk-with-bean` into `main`. Go ahead.
