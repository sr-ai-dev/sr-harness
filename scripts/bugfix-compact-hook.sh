#!/bin/bash
# bugfix-compact-hook.sh - SessionStart[compact] hook
#
# Purpose: After compaction, re-inject bugfix context so the orchestrator
#          knows the current debug state and attempt count without relying on memory.
# Activation: SessionStart with matcher "compact"
#
# Reads: ~/.hoyeon/{session_id}/state.json (written by skill-session-init.sh + orchestrator)
# Reads: {debug_state_path} (debug-state.md — written by bugfix orchestrator)
#
# Output (stdout → injected into Claude's context):
#   - Debug state file path
#   - Current attempt count (from state.json or debug-state.md)
#   - Stagnation pattern (from debug-state.md)
#   - Bug description

set -euo pipefail

# Read hook input from stdin
HOOK_INPUT=$(cat)
SESSION_ID=$(echo "$HOOK_INPUT" | jq -r '.session_id')

# ── Read session state ──

STATE_FILE="$HOME/.hoyeon/$SESSION_ID/state.json"
[[ ! -f "$STATE_FILE" ]] && exit 0

SKILL=$(jq -r '.skill // empty' "$STATE_FILE")
DEBUG_STATE=$(jq -r '.debug // empty' "$STATE_FILE")

# Only activate for bugfix sessions
[[ "$SKILL" != "bugfix" ]] && exit 0
[[ -z "$DEBUG_STATE" ]] && exit 0
[[ ! -f "$DEBUG_STATE" ]] && exit 0

# ── Parse debug-state.md ──

DEBUG_CONTENT=$(cat "$DEBUG_STATE")

# Extract bug description from first heading line: "# Debug: {description}"
BUG_DESC=$(echo "$DEBUG_CONTENT" | grep -m1 '^# Debug:' | sed 's/^# Debug: *//' || true)
[[ -z "$BUG_DESC" ]] && BUG_DESC="(unknown)"

# Extract status
STATUS=$(echo "$DEBUG_CONTENT" | grep -m1 '^status:' | sed 's/^status: *//' || true)
[[ -z "$STATUS" ]] && STATUS="(unknown)"

# Extract stagnation pattern
STAGNATION_PATTERN=$(echo "$DEBUG_CONTENT" | grep -m1 '^pattern:' | sed 's/^pattern: *//' || true)
[[ -z "$STAGNATION_PATTERN" ]] && STAGNATION_PATTERN="none"

# Extract stagnation hint (line after "hint:")
STAGNATION_HINT=$(echo "$DEBUG_CONTENT" | grep -m1 '^hint:' | sed 's/^hint: *//' || true)

# ── Read attempt count from state.json ──

ATTEMPT=$(jq -r '.attempt // 0' "$STATE_FILE")

# ── Output context for Claude (stdout is injected into conversation) ──

cat <<EOF

[bugfix recovery] Compaction detected — restoring bugfix orchestrator context.

debug_state: $DEBUG_STATE
bug: $BUG_DESC
status: $STATUS
attempt: $ATTEMPT
stagnation_pattern: $STAGNATION_PATTERN
EOF

if [[ -n "$STAGNATION_HINT" && "$STAGNATION_HINT" != "none" ]]; then
  echo "stagnation_hint: $STAGNATION_HINT"
fi

cat <<EOF

Resume from where you left off. Read $DEBUG_STATE for full context (symptoms, evidence, eliminated approaches).
If status is "investigating", continue Phase 2 FIX loop at attempt $ATTEMPT.
If status is "escalated", present the circuit breaker options to the user.
If status is "resolved", the fix is complete — report summary to the user.
EOF

exit 0
