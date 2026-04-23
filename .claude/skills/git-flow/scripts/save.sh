#!/usr/bin/env bash
# save.sh "<type>: <message>" [-- extra paths to stage]
# Stages modified tracked files (+ explicit paths), runs PHI guard, commits, pushes.
set -euo pipefail

if [ $# -lt 1 ]; then
  echo 'usage: save.sh "<type>: <message>" [-- path1 path2 ...]' >&2
  exit 2
fi

MSG="$1"; shift || true
EXTRA=()
if [ "${1:-}" = "--" ]; then
  shift
  EXTRA=("$@")
fi

: "${AI_CHANNEL_IDENTITY:?Set AI_CHANNEL_IDENTITY in .env}"

# Reject direct commits to main.
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" = "main" ]; then
  echo "refusing to commit on main. run start-feature.sh first." >&2
  exit 1
fi

# Commit message format: <type>: <imperative>
if ! printf '%s' "$MSG" | grep -Eq '^(feat|fix|docs|chore|refactor|test): .+'; then
  echo "commit message must start with one of: feat|fix|docs|chore|refactor|test" >&2
  echo "got: $MSG" >&2
  exit 1
fi

# Stage: modified tracked files + explicit extras. NEVER -A.
git add -u
if [ "${#EXTRA[@]}" -gt 0 ]; then
  git add -- "${EXTRA[@]}"
fi

if git diff --cached --quiet; then
  echo "nothing staged. pass explicit paths after -- if you need to add new files." >&2
  exit 1
fi

# Dangerous-path check.
DANGER=$(git diff --cached --name-only | grep -E '(^|/)(\.env(\.|$)|.*\.pdf$|node_modules/|__pycache__/|\.cursors/)' | grep -vE '(^|/)\.env\.example$' || true)
if [ -n "$DANGER" ]; then
  echo "staged paths look suspicious — stop and confirm:" >&2
  echo "$DANGER" >&2
  exit 1
fi

# PHI guard (until 2026-04-17 BAA).
# Only scan ADDITIONS (lines starting with + but not the +++ file header).
# Prevents the guard from blocking commits that REMOVE lines matching PHI patterns.
# Skip known-demo/mockup files (filename contains "mockup" or "demo") — these
# are synthetic-by-construction sales artifacts and must carry realistic-looking
# placeholders. Real files are still scanned.
PHI_TARGETS=$(git diff --cached --name-only | grep -viE '(mockup|demo)\.html$' | grep -viE '(mockup|demo)[^/]*\.html$' || true)
if [ -n "$PHI_TARGETS" ]; then
  PHI=$(git diff --cached -U0 -- $PHI_TARGETS | grep '^+' | grep -v '^+++' | grep -nE '\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b|MRN[-_: ]?[0-9]{4}|\bDOB[: =][ '\''"]*[0-9]|patient[_ ]?id[: =][ '\''"]*[0-9]|claim[_ ]?id[: =].*[0-9]{6}' || true)
else
  PHI=""
fi
if [ -n "$PHI" ]; then
  echo "PHI guard: staged diff matches patient-identifier patterns. blocked." >&2
  echo "$PHI" >&2
  echo "resolve manually then re-run." >&2
  exit 1
fi

git commit -m "$MSG"
git push -u origin "$BRANCH"

echo
echo "committed on $BRANCH as $AI_CHANNEL_IDENTITY"
echo "next: 'ship it' when ready to open the PR"
