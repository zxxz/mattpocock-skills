#!/usr/bin/env bash
# Prepare a review branch in a fresh checkout with fetched origin/upstream refs.
# Never push, reset, or rewrite an existing branch. Publication follows validation.
set -euo pipefail

branch=codex/sync-upstream
if [[ -n "$(git status --porcelain)" ]]; then
  echo 'Upstream sync requires a clean checkout; preserve local changes first.' >&2
  exit 1
fi

start=origin/main
if git show-ref --verify --quiet "refs/remotes/origin/$branch"; then
  start="origin/$branch"
fi
git switch --create "$branch" "$start"

merge_ref() {
  if ! git merge "$@"; then
    git merge --abort
    echo "Resolve the merge conflict on $branch, push that branch, then rerun Sync upstream. Fork main was not changed." >&2
    exit 1
  fi
}

merge_ref --no-edit origin/main
merge_ref --no-ff --no-edit upstream/main
