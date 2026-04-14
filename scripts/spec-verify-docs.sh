#!/bin/bash
# spec-verify-docs.sh — spec.json과 문서 일치 검증
# 사용법: ./scripts/spec-verify-docs.sh <spec.json-path>
#
# 검증 항목:
#   1. 문서 파일 존재 여부 (design.md, requirements.md, tasks.md)
#   2. spec.json의 모든 Decision ID가 design.md에 포함되어 있는지
#   3. spec.json의 모든 Requirement ID가 requirements.md에 포함되어 있는지
#   4. spec.json의 모든 Task ID가 tasks.md에 포함되어 있는지
#
# 종료 코드:
#   0 = 전체 통과
#   1 = 검증 실패 항목 있음

set -euo pipefail

SPEC_PATH="${1:-}"

if [ -z "$SPEC_PATH" ]; then
  echo "Usage: spec-verify-docs.sh <spec.json-path>"
  echo "Example: spec-verify-docs.sh .hoyeon/specs/my-feature/spec.json"
  exit 1
fi

if [ ! -f "$SPEC_PATH" ]; then
  echo "❌ spec.json not found: $SPEC_PATH"
  exit 1
fi

SPEC_DIR="$(dirname "$SPEC_PATH")"
PASS=true
CHECKS=0
FAILS=0

echo "============================================"
echo "  spec-verify-docs"
echo "  spec: $SPEC_PATH"
echo "============================================"
echo ""

# --- 1. 문서 파일 존재 확인 ---
echo "--- [1] 문서 파일 존재 ---"

check_file() {
  local file="$1"
  local label="$2"
  CHECKS=$((CHECKS + 1))
  if [ -f "$SPEC_DIR/$file" ]; then
    echo "  ✅ $label ($file)"
  else
    echo "  ❌ $label ($file) — 없음"
    PASS=false
    FAILS=$((FAILS + 1))
  fi
}

check_file "design.md" "design.md"
check_file "requirements.md" "requirements.md"
# tasks.md는 L4 완료 후에만 존재
if grep -q '"tasks"' "$SPEC_PATH" 2>/dev/null; then
  TASK_COUNT=$(node -e "const s=JSON.parse(require('fs').readFileSync('$SPEC_PATH','utf8')); console.log((s.tasks||[]).length)" 2>/dev/null || echo "0")
  if [ "$TASK_COUNT" -gt "0" ]; then
    check_file "tasks.md" "tasks.md"
  else
    echo "  ⏭ tasks.md — tasks 없음 (L4 미진행), 스킵"
  fi
else
  echo "  ⏭ tasks.md — tasks 없음 (L4 미진행), 스킵"
fi
echo ""

# --- 2. Decision ID 검증 ---
echo "--- [2] Decision ID 검증 (spec.json → design.md) ---"

if [ -f "$SPEC_DIR/design.md" ]; then
  DECISION_IDS=$(node -e "
    const s = JSON.parse(require('fs').readFileSync('$SPEC_PATH', 'utf8'));
    const decisions = (s.context && s.context.decisions) || [];
    decisions.forEach(d => console.log(d.id));
  " 2>/dev/null || true)

  if [ -n "$DECISION_IDS" ]; then
    while IFS= read -r did; do
      CHECKS=$((CHECKS + 1))
      if grep -q "$did" "$SPEC_DIR/design.md" 2>/dev/null; then
        echo "  ✅ $did"
      else
        echo "  ❌ $did — design.md에 없음"
        PASS=false
        FAILS=$((FAILS + 1))
      fi
    done <<< "$DECISION_IDS"
  else
    echo "  ⏭ decisions 없음, 스킵"
  fi
else
  echo "  ⏭ design.md 없음, 스킵"
fi
echo ""

# --- 3. Requirement ID 검증 ---
echo "--- [3] Requirement ID 검증 (spec.json → requirements.md) ---"

if [ -f "$SPEC_DIR/requirements.md" ]; then
  REQ_IDS=$(node -e "
    const s = JSON.parse(require('fs').readFileSync('$SPEC_PATH', 'utf8'));
    const reqs = s.requirements || [];
    reqs.forEach(r => {
      console.log(r.id);
      (r.sub || []).forEach(sub => console.log(sub.id));
    });
  " 2>/dev/null || true)

  if [ -n "$REQ_IDS" ]; then
    while IFS= read -r rid; do
      CHECKS=$((CHECKS + 1))
      if grep -q "$rid" "$SPEC_DIR/requirements.md" 2>/dev/null; then
        echo "  ✅ $rid"
      else
        echo "  ❌ $rid — requirements.md에 없음"
        PASS=false
        FAILS=$((FAILS + 1))
      fi
    done <<< "$REQ_IDS"
  else
    echo "  ⏭ requirements 없음, 스킵"
  fi
else
  echo "  ⏭ requirements.md 없음, 스킵"
fi
echo ""

# --- 4. Task ID 검증 ---
echo "--- [4] Task ID 검증 (spec.json → tasks.md) ---"

if [ -f "$SPEC_DIR/tasks.md" ]; then
  TASK_IDS=$(node -e "
    const s = JSON.parse(require('fs').readFileSync('$SPEC_PATH', 'utf8'));
    const tasks = s.tasks || [];
    tasks.forEach(t => console.log(t.id));
  " 2>/dev/null || true)

  if [ -n "$TASK_IDS" ]; then
    while IFS= read -r tid; do
      CHECKS=$((CHECKS + 1))
      if grep -q "$tid" "$SPEC_DIR/tasks.md" 2>/dev/null; then
        echo "  ✅ $tid"
      else
        echo "  ❌ $tid — tasks.md에 없음"
        PASS=false
        FAILS=$((FAILS + 1))
      fi
    done <<< "$TASK_IDS"
  else
    echo "  ⏭ tasks 없음, 스킵"
  fi
else
  echo "  ⏭ tasks.md 없음, 스킵"
fi
echo ""

# --- 결과 ---
echo "============================================"
if [ "$PASS" = true ]; then
  echo "  ✅ 전체 통과 ($CHECKS checks, 0 fails)"
  exit 0
else
  echo "  ❌ 검증 실패 ($CHECKS checks, $FAILS fails)"
  echo "  문서를 재렌더링하거나 누락된 ID를 추가하세요."
  exit 1
fi
