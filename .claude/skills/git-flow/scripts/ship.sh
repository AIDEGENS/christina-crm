#!/usr/bin/env bash
# ship.sh [next-hint]
# Pushes, opens PR via gh, appends signed handoff to _ai-channel/chat.md.
set -euo pipefail

: "${AI_CHANNEL_IDENTITY:?Set AI_CHANNEL_IDENTITY in .env}"

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" = "main" ]; then
  echo "on main — nothing to ship." >&2
  exit 1
fi

NEXT="${1:-hand off to the other Claude}"

git push -u origin "$BRANCH"

# Create PR if none exists; otherwise reuse.
PR_URL=$(gh pr view --json url -q .url 2>/dev/null || true)
if [ -z "$PR_URL" ]; then
  gh pr create --fill --base main >/dev/null
  PR_URL=$(gh pr view --json url -q .url)
fi
PR_TITLE=$(gh pr view --json title -q .title)

# Repo root for channel path.
ROOT=$(git rev-parse --show-toplevel)
CHAN="$ROOT/BrightPath_Vault/_ai-channel/chat.md"

if [ ! -f "$CHAN" ]; then
  echo "warning: $CHAN not found — skipping channel handoff." >&2
else
  TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  {
    echo
    echo "## $TS — $AI_CHANNEL_IDENTITY"
    echo "shipped: $PR_TITLE ($PR_URL)"
    echo "next: $NEXT"
    echo "---"
  } >> "$CHAN"

  git add -- "$CHAN"
  if ! git diff --cached --quiet; then
    git commit -m "docs: ai-channel handoff ($AI_CHANNEL_IDENTITY)"
    git push
  fi
fi

echo
echo "shipped: $PR_URL"
echo "handoff posted to _ai-channel/chat.md as $AI_CHANNEL_IDENTITY"
