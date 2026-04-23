#!/usr/bin/env bash
# scripts/save.sh — PHI-guarded git commit + push
# Usage: ./scripts/save.sh "type: message"
#
# PHI guard spec: SSN/DOB block; MRN-ish long digits warn (or block if PHI_STRICT=1)
# Identity: AI_CHANNEL_IDENTITY must be set to stone|ikeem|landon

set -euo pipefail

# ---------------------------------------------------------------------------
# 1. Argument validation
# ---------------------------------------------------------------------------
if [[ $# -ne 1 ]]; then
  echo "Usage: $0 \"<type>: <message>\""
  echo "  type must be one of: feat fix chore docs refactor test perf build ci style"
  exit 1
fi

COMMIT_MSG="$1"

# Validate conventional commit type
VALID_TYPES="feat|fix|chore|docs|refactor|test|perf|build|ci|style"
if ! echo "$COMMIT_MSG" | grep -qP "^($VALID_TYPES)(\(.+\))?: .+"; then
  echo "ERROR: commit message must start with a valid type followed by ': <desc>'"
  echo "  Valid types: feat fix chore docs refactor test perf build ci style"
  echo "  Example: \"feat: add referral form\""
  exit 1
fi

# ---------------------------------------------------------------------------
# 2. Identity check
# ---------------------------------------------------------------------------
# Load .env if it exists.
#
# We use `set -a; source .env; set +a` rather than `export $(... | xargs)`.
# The xargs form re-interprets every value through the shell, so any .env
# containing backticks, $(...) substitutions, or quoted whitespace would
# execute code at source time. `source` reads the file as shell assignments
# (VALUE still follows shell quoting rules, which is fine for a dotenv), and
# `set -a` marks subsequent assignments for export.
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [[ -z "${AI_CHANNEL_IDENTITY:-}" ]]; then
  echo "ERROR: AI_CHANNEL_IDENTITY missing — set it in .env"
  echo "  Valid values: stone | ikeem | landon"
  exit 1
fi

IDENTITY="$AI_CHANNEL_IDENTITY"
VALID_IDENTITIES="stone ikeem landon"
IDENTITY_VALID=false
for v in $VALID_IDENTITIES; do
  if [[ "$IDENTITY" == "$v" ]]; then
    IDENTITY_VALID=true
    break
  fi
done

if [[ "$IDENTITY_VALID" == "false" ]]; then
  echo "ERROR: AI_CHANNEL_IDENTITY='$IDENTITY' is not valid. Must be one of: $VALID_IDENTITIES"
  exit 1
fi

# ---------------------------------------------------------------------------
# 3. Branch safety — never push directly to main/master
# ---------------------------------------------------------------------------
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT_BRANCH" == "main" || "$CURRENT_BRANCH" == "master" ]]; then
  echo "ERROR: You are on '$CURRENT_BRANCH'. Never commit directly to main."
  echo "  Run: ./scripts/start-feature.sh <area> <desc>"
  exit 1
fi

# ---------------------------------------------------------------------------
# 4. Stage tracked files only (NOT -A — per CLAUDE.md)
# ---------------------------------------------------------------------------
git add -u

# Check there's something to commit
if git diff --cached --quiet; then
  echo "Nothing staged — no tracked file changes detected."
  echo "  (Hint: use 'git add <file>' to stage new untracked files, then rerun)"
  exit 1
fi

# ---------------------------------------------------------------------------
# 5. PHI guard on staged diff
# ---------------------------------------------------------------------------
DIFF=$(git diff --cached)
PHI_FAIL=false
PHI_WARN=false

# --- Block: SSN ---
SSN_MATCHES=$(echo "$DIFF" | grep -nP '\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b' || true)
if [[ -n "$SSN_MATCHES" ]]; then
  echo "PHI_GUARD BLOCKED: potential SSN pattern detected"
  echo "$SSN_MATCHES"
  PHI_FAIL=true
fi

# --- Block: DOB ---
DOB_MATCHES=$(echo "$DIFF" | grep -nP '\b(0[1-9]|1[0-2])/(0[1-9]|[12][0-9]|3[01])/(19|20)[0-9]{2}\b' || true)
if [[ -n "$DOB_MATCHES" ]]; then
  echo "PHI_GUARD BLOCKED: potential DOB pattern detected"
  echo "$DOB_MATCHES"
  PHI_FAIL=true
fi

if [[ "$PHI_FAIL" == "true" ]]; then
  echo ""
  echo "Commit aborted. Remove PHI before committing."
  git reset HEAD
  exit 1
fi

# --- Warn: MRN-ish long digit runs (block if PHI_STRICT=1) ---
MRN_MATCHES=$(echo "$DIFF" | grep -nP '\b[0-9]{9,}\b' | grep -v 'node_modules' || true)
if [[ -n "$MRN_MATCHES" ]]; then
  echo "PHI_GUARD WARN: long digit run (9+ digits) found — verify it is not an MRN/member ID:"
  echo "$MRN_MATCHES"
  if [[ "${PHI_STRICT:-0}" == "1" ]]; then
    echo "PHI_STRICT=1 — aborting on warn"
    git reset HEAD
    exit 1
  fi
  PHI_WARN=true
fi

# --- Warn: member_id = 'ALPHANUM' pattern ---
MEMBER_MATCHES=$(echo "$DIFF" | grep -nP "member_id\s*=\s*['\"][A-Z0-9]{6,}['\"]" || true)
if [[ -n "$MEMBER_MATCHES" ]]; then
  echo "PHI_GUARD WARN: possible hardcoded member_id value:"
  echo "$MEMBER_MATCHES"
  if [[ "${PHI_STRICT:-0}" == "1" ]]; then
    echo "PHI_STRICT=1 — aborting on warn"
    git reset HEAD
    exit 1
  fi
  PHI_WARN=true
fi

# --- Warn: patient + capitalized two-word name on same line ---
PATIENT_NAME_MATCHES=$(echo "$DIFF" | grep -niP 'patient.*[A-Z][a-z]+\s+[A-Z][a-z]+' || true)
if [[ -n "$PATIENT_NAME_MATCHES" ]]; then
  echo "PHI_GUARD WARN: line contains 'patient' and a capitalized name — verify no PHI:"
  echo "$PATIENT_NAME_MATCHES"
  if [[ "${PHI_STRICT:-0}" == "1" ]]; then
    echo "PHI_STRICT=1 — aborting on warn"
    git reset HEAD
    exit 1
  fi
  PHI_WARN=true
fi

if [[ "$PHI_WARN" == "true" ]]; then
  echo ""
  echo "PHI warnings above — review carefully. Set PHI_STRICT=1 to block on warnings."
  echo "Proceeding with commit in 3 seconds... (Ctrl-C to abort)"
  sleep 3
fi

# ---------------------------------------------------------------------------
# 6. Commit with identity signature
# ---------------------------------------------------------------------------
TRAILER="Co-Authored-By: ${IDENTITY}-claude <${IDENTITY}@aidegens.ai>"
git commit -m "$COMMIT_MSG" -m "$TRAILER"

# ---------------------------------------------------------------------------
# 7. Push — set upstream if needed
# ---------------------------------------------------------------------------
UPSTREAM=$(git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>/dev/null || echo "")
if [[ -z "$UPSTREAM" ]]; then
  echo "No upstream set — pushing with -u origin HEAD"
  git push -u origin HEAD
else
  git push
fi

echo ""
echo "Committed and pushed: $COMMIT_MSG"
echo "Branch: $CURRENT_BRANCH  Identity: $IDENTITY"
