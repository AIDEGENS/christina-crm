#!/usr/bin/env bash
# start-feature.sh <module> <short-desc>
# Creates feat/<module>/<desc> off a freshly-pulled main.
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "usage: start-feature.sh <module> <short-desc>" >&2
  exit 2
fi

MODULE="$1"
DESC="$2"
BRANCH="feat/${MODULE}/${DESC}"

: "${AI_CHANNEL_IDENTITY:?Set AI_CHANNEL_IDENTITY in .env}"

# Refuse if working tree dirty.
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "working tree is dirty. commit or stash first." >&2
  git status --short >&2
  exit 1
fi

git checkout main
git pull --rebase origin main
git checkout -b "$BRANCH"

echo
echo "on branch: $BRANCH"
echo "identity:  $AI_CHANNEL_IDENTITY"
echo "next: edit, then 'save this as <type>: <message>'"
