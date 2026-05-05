#!/bin/bash
# skill-session-guard.sh — Unified PreToolUse[Edit|Write] guard
#
# Reads: ~/.hoyeon/{session_id}/state.json   (user home — session state namespace)
# Behavior per skill:
#   - specify: DENY writes outside spec_dir (allowed: .sr-harness/specs/, legacy .hoyeon/specs/)
#   - execute: WARN on writes outside spec_dir (allow but message)
#   - No session file: allow all

set -euo pipefail

INPUT=$(cat)

SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty')

# Read session state
STATE_FILE="$HOME/.hoyeon/$SESSION_ID/state.json"
[[ ! -f "$STATE_FILE" ]] && exit 0

SKILL=$(jq -r '.skill // empty' "$STATE_FILE")
[[ -z "$SKILL" ]] && exit 0

# spec_dir paths always allowed (v1.6.0: .sr-harness/specs/, legacy: .hoyeon/specs/)
[[ "$FILE_PATH" == *".sr-harness/"* ]] && exit 0
[[ "$FILE_PATH" == *".hoyeon/"* ]] && exit 0

# Skill-specific behavior for files outside spec_dir
case "$SKILL" in
  specify)
    cat << 'EOF'
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny"
  },
  "systemMessage": "PLAN MODE: Code modification not allowed. During specify phase, only spec_dir paths (.sr-harness/specs/) are writable. Implementation happens after plan approval."
}
EOF
    ;;
  execute)
    cat << 'EOF'
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow"
  },
  "systemMessage": "ORCHESTRATOR WARNING: Do not modify code directly. Delegate to worker agent using Agent(subagent_type=\"worker\")."
}
EOF
    ;;
esac

exit 0
