#!/usr/bin/env bash
# ship.sh [next-hint]
# Pushes, opens PR via gh, appends signed handoff to _ai-channel/chat.md.
# Channel lives in the Christina workspace repo. If run from a product repo
# (christina-crm, christina-insurance-bot, etc.), walks up to ../Christina/.
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

# Find the channel: first try own repo, then sibling ../Christina/.
ROOT=$(git rev-parse --show-toplevel)
REPO_NAME=$(basename "$ROOT")

if [ -f "$ROOT/BrightPath_Vault/_ai-channel/chat.md" ]; then
  CHAN_REPO_ROOT="$ROOT"
elif [ -f "$ROOT/../Christina/BrightPath_Vault/_ai-channel/chat.md" ]; then
  CHAN_REPO_ROOT="$(cd "$ROOT/.." && pwd)/Christina"
else
  echo "warning: no _ai-channel/chat.md found (checked $ROOT/ and ../Christina/) — skipping channel handoff." >&2
  echo
  echo "shipped: $PR_URL"
  echo "handoff SKIPPED — clone AIDEGENS/Christina as a sibling to post channel notes."
  exit 0
fi

CHAN="$CHAN_REPO_ROOT/BrightPath_Vault/_ai-channel/chat.md"
TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

{
  echo
  echo "## $TS — $AI_CHANNEL_IDENTITY"
  echo "shipped: $PR_TITLE ($PR_URL)"
  echo "repo: $REPO_NAME"
  echo "next: $NEXT"
  echo "---"
} >> "$CHAN"

# Commit + push in the channel's repo (may be the same repo or sibling Christina).
(
  cd "$CHAN_REPO_ROOT"
  # Pull first to minimize conflict risk on concurrent channel writes.
  git pull --rebase --autostash origin main 2>/dev/null || true
  git add -- BrightPath_Vault/_ai-channel/chat.md
  if ! git diff --cached --quiet; then
    git commit -m "docs: ai-channel handoff ($AI_CHANNEL_IDENTITY from $REPO_NAME)"
    git push
  fi
)

echo
echo "shipped: $PR_URL"
if [ "$CHAN_REPO_ROOT" = "$ROOT" ]; then
  echo "handoff posted to _ai-channel/chat.md as $AI_CHANNEL_IDENTITY"
else
  echo "handoff posted to ../Christina/BrightPath_Vault/_ai-channel/chat.md as $AI_CHANNEL_IDENTITY"
fi
