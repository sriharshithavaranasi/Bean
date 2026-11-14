#!/bin/sh
# Checks out the comms branch at .comms/. Creates the branch the first time
# anyone runs it. Safe to re-run. Needs git 2.42 or newer.
set -e
cd "$(git rev-parse --show-toplevel)"

if [ -e .comms/.git ]; then
  git -C .comms pull --rebase --quiet
elif git ls-remote --exit-code --heads origin comms >/dev/null 2>&1; then
  git fetch --quiet origin comms:refs/remotes/origin/comms
  git worktree add --quiet -B comms .comms origin/comms
else
  git worktree add --quiet --orphan -b comms .comms
  cp -R docs/comms-seed/. .comms/
  git -C .comms add -A
  git -C .comms commit --quiet -m "Start communication branch"
  git -C .comms push --quiet -u origin comms
fi
echo ".comms is ready"
