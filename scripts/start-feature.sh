#!/usr/bin/env bash
# scripts/start-feature.sh — branch off fresh main
# Usage: ./scripts/start-feature.sh <area> <desc>
#
# area must be one of the allowed values below.
# desc is slugified to kebab-case, max 50 chars.

set -euo pipefail

# ---------------------------------------------------------------------------
# 1. Argument validation
# ---------------------------------------------------------------------------
if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <area> <desc>"
  echo ""
  echo "  area  — one of: frontend backend infra db auth verification docs security qa growth"
  echo "  desc  — short description (will be slugified, max 50 chars)"
  echo ""
  echo "  Example: $0 backend initial-hono-server"
  exit 1
fi

AREA="$1"
DESC="$2"

VALID_AREAS="frontend backend infra db auth verification docs security qa growth"
AREA_VALID=false
for v in $VALID_AREAS; do
  if [[ "$AREA" == "$v" ]]; then
    AREA_VALID=true
    break
  fi
done

if [[ "$AREA_VALID" == "false" ]]; then
  echo "ERROR: area '$AREA' is not valid."
  echo "  Valid areas: $VALID_AREAS"
  exit 1
fi

# ---------------------------------------------------------------------------
# 2. Slug the description: lowercase, non-alphanumeric → dash, max 50 chars
# ---------------------------------------------------------------------------
SLUG=$(echo "$DESC" | tr '[:upper:]' '[:lower:]' | tr -cs '[:alnum:]' '-' | tr -s '-' | sed 's/^-//;s/-$//')
SLUG="${SLUG:0:50}"

BRANCH_NAME="${AREA}/${SLUG}"

# ---------------------------------------------------------------------------
# 3. Sync main and create branch
# ---------------------------------------------------------------------------
echo "Syncing main..."
git checkout main
git pull --ff-only origin main

echo "Creating branch: $BRANCH_NAME"
git checkout -b "$BRANCH_NAME"

# ---------------------------------------------------------------------------
# 4. Next steps
# ---------------------------------------------------------------------------
echo ""
echo "Branch '$BRANCH_NAME' created and ready."
echo ""
echo "Next steps:"
echo "  1. Make your changes"
echo "  2. git add <new-files>  (for untracked files only)"
echo "  3. ./scripts/save.sh \"<type>: <desc>\"  (stages tracked changes, PHI-checks, commits, pushes)"
echo ""
echo "Commit types: feat fix chore docs refactor test perf build ci style"
