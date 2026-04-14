#!/bin/bash
# build-release.sh — develop → release 변환
# hoyeon 내부 네이밍을 sr-harness 네이밍으로 변환하여 release 브랜치 생성
#
# 사용법: ./build-release.sh [version]
# 예시:   ./build-release.sh v1.5.4-sr.1
#
# 동작:
#   1. develop 브랜치 기반으로 release/{version} 브랜치 생성
#   2. .hoyeon → .sr-harness 디렉토리/참조 변환
#   3. hoyeon-cli → sr-cli CLI 바이너리명 변환
#   4. @team-attention/hoyeon-cli → @syscon-robotics/sr-cli npm scope 변환
#   5. plugin name hoyeon → sr-harness 변환
#   6. 잔여 참조 검사 리포트

set -euo pipefail

VERSION="${1:-dev}"
RELEASE_BRANCH="release/${VERSION}"

echo "============================================"
echo "  SR Harness Build Release"
echo "  Version: ${VERSION}"
echo "============================================"
echo ""

# 0. develop 브랜치 확인
CURRENT=$(git branch --show-current)
if [ "$CURRENT" != "develop" ]; then
  echo "⚠  현재 브랜치: ${CURRENT}"
  echo "   develop 브랜치로 전환합니다..."
  git checkout develop
fi

# 작업 디렉토리 clean 확인
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ develop에 uncommitted 변경이 있습니다. 커밋 후 다시 실행하세요."
  git status --short
  exit 1
fi

# 1. release 브랜치 생성 (기존 있으면 삭제 후 재생성)
if git show-ref --verify --quiet "refs/heads/${RELEASE_BRANCH}"; then
  echo "기존 ${RELEASE_BRANCH} 브랜치 삭제 후 재생성..."
  git branch -D "${RELEASE_BRANCH}"
fi
git checkout -b "${RELEASE_BRANCH}"
echo "✅ 브랜치 생성: ${RELEASE_BRANCH}"
echo ""

# 2. 디렉토리명 변환: .hoyeon → .sr-harness
echo "--- [1/5] .hoyeon → .sr-harness ---"
# 실제 디렉토리 이동 (있으면)
find . -type d -name ".hoyeon" -not -path "./.git/*" | while read dir; do
  target="$(dirname "$dir")/.sr-harness"
  echo "  mv $dir → $target"
  mv "$dir" "$target"
done
# 파일 내 참조 변환
find . -type f \( -name "*.md" -o -name "*.sh" -o -name "*.json" -o -name "*.js" -o -name "*.ts" \) \
  -not -path "./.git/*" -not -name "build-release.sh" \
  -exec sed -i '' 's/\.hoyeon/\.sr-harness/g' {} +
echo "✅ .hoyeon → .sr-harness 완료"
echo ""

# 3. CLI 바이너리명 변환: hoyeon-cli → sr-cli
echo "--- [2/5] hoyeon-cli → sr-cli ---"
find . -type f \( -name "*.md" -o -name "*.sh" -o -name "*.json" -o -name "*.js" -o -name "*.ts" \) \
  -not -path "./.git/*" -not -name "build-release.sh" \
  -exec sed -i '' 's/hoyeon-cli/sr-cli/g' {} +
echo "✅ hoyeon-cli → sr-cli 완료"
echo ""

# 4. npm 패키지 scope 변환: @team-attention → @syscon-robotics
echo "--- [3/5] @team-attention → @syscon-robotics ---"
find . -type f \( -name "*.md" -o -name "*.sh" -o -name "*.json" -o -name "*.js" -o -name "*.ts" \) \
  -not -path "./.git/*" -not -name "build-release.sh" \
  -exec sed -i '' 's/@team-attention/@syscon-robotics/g' {} +
echo "✅ @team-attention → @syscon-robotics 완료"
echo ""

# 5. Plugin name 변환
echo "--- [4/5] plugin name: hoyeon → sr-harness ---"
PLUGIN_JSON=".claude-plugin/plugin.json"
if [ -f "$PLUGIN_JSON" ]; then
  sed -i '' 's/"name": "hoyeon"/"name": "sr-harness"/g' "$PLUGIN_JSON"
  # author도 변환
  sed -i '' 's/"name": "team-attention"/"name": "syscon-robotics"/g' "$PLUGIN_JSON"
  echo "  $PLUGIN_JSON 업데이트됨"
fi
echo "✅ plugin name 변환 완료"
echo ""

# 6. 버전 업데이트 (plugin.json)
echo "--- [5/5] 버전 업데이트 ---"
if [ -f "$PLUGIN_JSON" ] && [ "$VERSION" != "dev" ]; then
  # v1.5.4-sr.1 형식에서 semver 추출은 하지 않고 전체를 버전으로 사용
  SR_VERSION=$(echo "$VERSION" | sed 's/^v//')
  sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"${SR_VERSION}\"/g" "$PLUGIN_JSON"
  echo "  버전: ${SR_VERSION}"
fi
echo "✅ 버전 업데이트 완료"
echo ""

# 7. 잔여 참조 검사
echo "============================================"
echo "  잔여 참조 검사"
echo "============================================"
echo ""

PASS=true

# 7-1. "hoyeon-cli" 잔여 (build-release.sh 제외)
echo "--- hoyeon-cli 잔여 ---"
REMAINING_CLI=$(grep -r "hoyeon-cli" --include="*.md" --include="*.sh" --include="*.json" \
  --include="*.js" --include="*.ts" . \
  | grep -v ".git/" | grep -v "build-release.sh" | grep -v "CHANGELOG" || true)
if [ -n "$REMAINING_CLI" ]; then
  echo "⚠ 잔여 발견:"
  echo "$REMAINING_CLI"
  PASS=false
else
  echo "✅ 없음"
fi
echo ""

# 7-2. ".hoyeon" 잔여
echo "--- .hoyeon 잔여 ---"
REMAINING_DIR=$(grep -r "\.hoyeon" --include="*.md" --include="*.sh" --include="*.json" \
  --include="*.js" --include="*.ts" . \
  | grep -v ".git/" | grep -v "build-release.sh" | grep -v "CHANGELOG" || true)
if [ -n "$REMAINING_DIR" ]; then
  echo "⚠ 잔여 발견:"
  echo "$REMAINING_DIR"
  PASS=false
else
  echo "✅ 없음"
fi
echo ""

# 7-3. "@team-attention" 잔여
echo "--- @team-attention 잔여 ---"
REMAINING_SCOPE=$(grep -r "@team-attention" --include="*.md" --include="*.sh" --include="*.json" \
  --include="*.js" --include="*.ts" . \
  | grep -v ".git/" | grep -v "build-release.sh" | grep -v "CHANGELOG" || true)
if [ -n "$REMAINING_SCOPE" ]; then
  echo "⚠ 잔여 발견:"
  echo "$REMAINING_SCOPE"
  PASS=false
else
  echo "✅ 없음"
fi
echo ""

# 7-4. plugin.json 확인
echo "--- plugin.json 확인 ---"
if [ -f "$PLUGIN_JSON" ]; then
  cat "$PLUGIN_JSON"
fi
echo ""

# 8. 커밋
echo "============================================"
if [ "$PASS" = true ]; then
  echo "  ✅ 전체 검사 통과"
else
  echo "  ⚠ 잔여 참조 있음 (위 목록 확인)"
  echo "  의도적 참조일 수 있으므로 검토 후 진행"
fi
echo "============================================"
echo ""

git add -A
git commit -m "build: transform naming hoyeon → sr-harness (${VERSION})"

echo ""
echo "=== 빌드 완료: ${RELEASE_BRANCH} ==="
echo ""
echo "다음 단계:"
echo "  1. 잔여 참조 검토 (의도적 참조 확인)"
echo "  2. push: git push origin ${RELEASE_BRANCH}"
echo "  3. develop으로 복귀: git checkout develop"
