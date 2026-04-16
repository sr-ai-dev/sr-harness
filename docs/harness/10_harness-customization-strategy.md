# 하네스 커스터마이즈 및 전사 배포 전략

> 작성일: 2026-04-13
> 최종 수정: 2026-04-14
> 목적: hoyeon 기반 사내 표준 하네스 파이프라인 구축, 커스터마이즈, 배포 전략 수립

---

## 1. 현황 분석

### 1-1. hoyeon 플러그인 현황

| 항목 | 값 |
|------|-----|
| 최신 버전 | v1.5.4 (2026-04-06) |
| 첫 커밋 | 2026-01-22 |
| 총 커밋 | 657개 / 75일 |
| 릴리스 | 14회 (v1.0.0 ~ v1.5.4) |
| 스킬 | 29개 |
| 에이전트 | 23개 |
| Hook | 13개 |
| CLI | @team-attention/hoyeon-cli (npm) |

**업데이트 빈도와 질**: 단순 패치가 아닌 아키텍처 수준의 반복 재설계가 이루어지고 있음.

- 스키마 4세대 진화 (v4 → v5 → v6 → v1 리셋)
- 검증 파이프라인 5세대 진화 (per-task → auto-pass → final verify → 4-tier → CR 통합)
- 실사용 피드백 기반 수렴 (도입 → 실패 → 제거 → 재설계)

### 1-2. 현재 설치 구조

```
~/.claude/
├── settings.json                              ← enabledPlugins: hoyeon@team-attention-dev
├── plugins/
│   ├── installed_plugins.json                 ← 버전/커밋 SHA 추적
│   ├── marketplaces/team-attention-dev/       ← upstream git clone
│   │   └── skills/specify/SKILL.md            ← ⚠ 직접 수정됨 (uncommitted)
│   └── cache/team-attention-dev/hoyeon/1.5.4/ ← marketplace에서 복사
│       ├── .claude/skills/ (29개)
│       ├── .claude/agents/ (23개)
│       ├── scripts/ (13개 hook)
│       └── cli/ (hoyeon-cli 소스)
```

### 1-3. 현재 커스터마이즈 현황

**marketplace 클론에 직접 수정된 파일 (uncommitted):**

| 파일 | 변경 내용 |
|------|----------|
| `skills/specify/SKILL.md` | Document Rendering Protocol 추가 (9-section design.md 표준) |
| `skills/specify/references/L2-decisions.md` | 승인 게이트 한글화 + 문서 렌더링 연동 |
| `skills/specify/references/L3-requirements.md` | 문서 렌더링 연동 |
| `skills/specify/references/L4-tasks.md` | 문서 렌더링 연동 |

**위험**: 플러그인 업데이트 시 uncommitted 변경이 유실됨.

**프로젝트 레벨 커스텀 스킬 (sr-mngt-ws 전용):**

| 스킬 | 위치 | 용도 |
|------|------|------|
| doc-brainstorming | `.claude/skills/` | 문서 구조 설계 |
| doc-writing-plans | `.claude/skills/` | 문서 태스크 분해 |
| doc-verification | `.claude/skills/` | 문서 품질 검증 |

---

## 2. 핵심 전략: 듀얼 브랜치 + Build-time 변환

### 2-1. 3대 요구사항

| 우선순위 | 요구사항 | 설명 |
|---------|---------|------|
| 1 | 커스터마이즈 반영 | specify L0~L4, 사내 도메인 맞춤, 추가 스킬 |
| 2 | upstream 추적 + 머지 | hoyeon 업데이트를 지속적으로 수용, 커스터마이즈와 병합 |
| 3 | 외부 네이밍 변경 | 팀원에게 노출되는 모든 이름을 회사 표준으로 통일 |

### 2-2. 핵심 원리: 소스 ≠ 배포물

**내부 네이밍 변경 시점 = upstream 추적 포기 시점**이므로, 소스와 배포물을 분리한다.

```
┌─────────────────────────────────────────────────────────┐
│  upstream (hoyeon)                                      │
│    ↓ git merge                                          │
│  develop 브랜치 (hoyeon 네이밍 유지 + 커스터마이즈)         │
│    ↓ build-release.sh (네이밍 변환)                       │
│  release 브랜치 (sr-harness 네이밍) → 팀원 설치           │
└─────────────────────────────────────────────────────────┘
```

| 층위 | develop (소스) | release (배포물) |
|------|---------------|-----------------|
| 내부 디렉토리 | `.hoyeon/` | `.sr-harness/` |
| CLI 바이너리 | `hoyeon-cli` | `sr-harness-cli` |
| Plugin name | `hoyeon` (또는 fork 최소 변경) | `sr-harness` |
| 스킬 호출명 | `/specify`, `/execute` | `/specify`, `/execute` (동일) |
| 커스터마이즈 | ✅ 반영됨 | ✅ 반영됨 |
| upstream 머지 | ✅ 3-way merge 가능 | N/A (빌드 산출물) |

### 2-3. Build-time 변환 스크립트

```bash
#!/bin/bash
# build-release.sh — develop → release 변환
# 사용법: ./build-release.sh [upstream-version]

set -euo pipefail

VERSION="${1:-dev}"
RELEASE_BRANCH="release/${VERSION}"

echo "=== Build Release: ${RELEASE_BRANCH} ==="

# 1. release 브랜치 생성 (develop 기반)
git checkout develop
git checkout -B "${RELEASE_BRANCH}"

# 2. 디렉토리명 변환: .hoyeon → .sr-harness
find . -type d -name ".hoyeon" | while read dir; do
  mv "$dir" "$(dirname "$dir")/.sr-harness"
done
find . -type f \( -name "*.md" -o -name "*.sh" -o -name "*.json" -o -name "*.js" -o -name "*.ts" \) \
  -exec sed -i '' 's/\.hoyeon/\.sr-harness/g' {} +

# 3. CLI 바이너리명 변환: hoyeon-cli → sr-harness-cli
find . -type f \( -name "*.md" -o -name "*.sh" -o -name "*.json" -o -name "*.js" -o -name "*.ts" \) \
  -exec sed -i '' 's/hoyeon-cli/sr-harness-cli/g' {} +

# 4. npm 패키지 scope 변환
find . -type f -name "*.json" \
  -exec sed -i '' 's/@team-attention\/hoyeon-cli/@syscon-robotics\/sr-harness-cli/g' {} +

# 5. Plugin name 변환
find . -type f -name "*.json" \
  -exec sed -i '' 's/"name": "hoyeon"/"name": "sr-harness"/g' {} +

# 6. 검증: 잔여 hoyeon 참조 리포트
echo ""
echo "=== 잔여 참조 검사 ==="
REMAINING=$(grep -r "hoyeon" --include="*.md" --include="*.sh" --include="*.json" \
  --include="*.js" --include="*.ts" . \
  | grep -v "upstream" | grep -v "CHANGELOG" | grep -v ".git/" | grep -v "build-release.sh" || true)

if [ -n "$REMAINING" ]; then
  echo "⚠ 잔여 참조 발견:"
  echo "$REMAINING"
  echo ""
  echo "수동 확인 필요. 의도적 참조(upstream 언급 등)인지 확인하세요."
else
  echo "✅ 잔여 참조 없음"
fi

# 7. 커밋
git add -A
git commit -m "build: transform naming hoyeon → sr-harness (${VERSION})"

echo ""
echo "=== 완료: ${RELEASE_BRANCH} ==="
echo "검증 후 push: git push origin ${RELEASE_BRANCH}"
```

### 2-4. Upstream 병합 워크플로우

```
hoyeon upstream (예: v1.6.0 릴리스)
    ↓
git fetch upstream
git checkout develop
git merge upstream/main --no-ff -m "merge: upstream v1.6.0"
    ↓
충돌 해결 (커스텀 영역만 — 주로 specify L2~L4)
    ↓ 검증 후
./build-release.sh v1.6.0-sr.1
    ↓
release/v1.6.0-sr.1 → 팀원 배포
```

**충돌 예상 범위**: 커스터마이즈가 내용 변경(새 섹션 추가, 질문 한글화 등)이므로, upstream의 구조적 변경이 아닌 한 3-way merge로 자동 해결 가능.

---

## 3. Phase 1: Fork + Build Pipeline 구축

### 3-1. 목표

hoyeon을 회사 레포로 fork하고, build-time 변환 파이프라인을 구축하여, 커스터마이즈와 upstream 추적이 공존하는 기반을 만든다.

### 3-2. 레포 구성

```
github.com/sr-ai-dev/sr-harness           ← 회사 레포 (fork)   ✅ 생성 완료
  ├── remote upstream: team-attention/hoyeon
  ├── remote origin: sr-ai-dev/sr-harness
  ├── main: upstream 추적 (hoyeon main 미러)
  ├── develop: 커스터마이즈 통합 (hoyeon 네이밍 유지)
  └── release/*: 빌드 산출물 (sr-harness 네이밍)
```

### 3-3. 초기 작업

```bash
# 1. 레포 생성
git clone https://github.com/team-attention/hoyeon.git sr-harness
cd sr-harness
git remote rename origin upstream
git remote add origin https://github.com/sr-ai-dev/sr-harness.git

# 2. develop 브랜치 생성
git checkout -b develop

# 3. 현재 marketplace 클론의 uncommitted 변경을 커밋
#    (4개 파일: specify SKILL.md + L2/L3/L4 references)
git add skills/specify/
git commit -m "[custom] feat(specify): Document Rendering Protocol + 9-section design.md"

# 4. build script 추가
cp /path/to/build-release.sh ./build-release.sh
chmod +x build-release.sh
git add build-release.sh
git commit -m "[custom] build: add build-release.sh (naming transform pipeline)"

# 5. 첫 release 빌드
./build-release.sh v1.5.4-sr.1

# 6. push
git push -u origin main
git push -u origin develop
git push origin release/v1.5.4-sr.1
```

### 3-4. 로컬 설치 전환

```json
// ~/.claude/settings.json
{
  "extraKnownMarketplaces": [
    {
      "name": "syscon-robotics",
      "url": "https://github.com/sr-ai-dev/sr-harness",
      "type": "github",
      "branch": "release/v1.5.4-sr.1"
    }
  ],
  "enabledPlugins": {
    "sr-harness@syscon-robotics": true
  }
}
```

> hoyeon 플러그인은 비활성화. 동시 활성화 시 스킬 이름 충돌.

### 3-5. Phase 1 완료 기준

- [x] GitHub에 `sr-ai-dev/sr-harness` 레포 생성 (2026-04-14)
- [x] hoyeon v1.5.4 fork + upstream remote 설정 (657 커밋 full history)
- [x] uncommitted 커스터마이즈 4개 파일 커밋 (`develop`)
- [x] `build-release.sh` 작성 + 커밋
- [x] 첫 release 빌드 (`release/v1.5.4-sr.1`) 생성 — 78파일 변환, 잔여참조 0건
- [x] release 브랜치 네이밍 검증 (hoyeon-cli→sr-harness-cli, .hoyeon→.sr-harness, plugin name→sr-harness)
- [ ] `/specify` 실행하여 커스터마이즈(Document Rendering Protocol) 정상 동작 확인 — Phase 2에서 진행

---

## 4. Phase 2: Customize + Stabilize + Pilot

### 4-1. 목표

specify L0~L4를 시스콘 개발 프로세스에 맞게 커스터마이즈하고, 표준 샘플로 검증 후, 소수 팀원 파일럿을 진행한다.

### 4-2. 커스터마이즈 영역

| 영역 | 내용 | 우선순위 |
|------|------|---------|
| `/specify` Document Rendering | 9-section design.md, 한글 시나리오 질문 | 완료 |
| `/specify` L0~L4 단계 커스텀 | 시스콘 AMR 도메인 맞춤 (단계 추가/조정) | **최우선** |
| `/specify` L2 체크포인트 | AMR, 기구설계, 전장, FA제어 등 도메인별 체크포인트 | 높음 |
| `/execute` verify 기본값 | 사내 품질 기준에 맞는 기본 verify depth | 중간 |
| 사내 도구 연동 스킬 | Teams/Planner 연동, 사내 문서 표준 스킬 | 높음 |
| `.claude/rules/` | 코딩 컨벤션, 문서 표준, 커밋 메시지 규칙 | 중간 |
| Hook 커스텀 | 사내 CI/CD 연동, 알림 등 | 낮음 |

### 4-3. 표준 테스트 샘플

커스터마이즈 검증을 위한 표준 샘플 시나리오:

| 샘플 | 유형 | 검증 포인트 |
|------|------|-----------|
| AMR 신규 기능 추가 | 코드 프로젝트 | L0~L4 전체 파이프라인, 도메인 체크포인트 |
| 문서하네스 (Gate 심사 양식) | 문서 프로젝트 | Document Rendering Protocol, 문서 모드 |
| 기존 모듈 버그 수정 | 코드 프로젝트 | bugfix 스킬, verify depth |
| 멀티팀 협업 태스크 | 프로젝트 관리 | Teams/Planner 연동, R&R 배분 |

### 4-4. 파일럿 범위

```
1차 파일럿: PM팀 (2-3명)
  → /specify + /execute 기본 파이프라인
  → 문서하네스 워크플로우 (doc-brainstorming 등)

2차 파일럿: 개발팀 리드 (3-5명)
  → 코드 프로젝트에서 full pipeline (/specify → /execute)
  → verify depth 적정 수준 확인

전사 배포: Phase 3
```

### 4-5. 커스터마이즈 → 빌드 → 배포 사이클

```
develop에서 커스터마이즈 작업
    ↓ git commit -m "[custom] ..."
    ↓ 표준 샘플로 검증 (develop 브랜치에서)
    ↓ ./build-release.sh v1.5.4-sr.N
release 브랜치 → 파일럿 팀원 설치
    ↓ 피드백
develop에서 수정
    ↓ 반복
```

> **검증은 develop에서, 배포는 release에서.** develop에서도 기능은 동일하므로 (네이밍만 다름) 검증 결과가 release에서도 유효하다.

### 4-6. Phase 2 완료 기준

- [ ] specify L0~L4 커스터마이즈 완료 (시스콘 도메인)
- [ ] 표준 테스트 샘플 4종 검증 통과
- [ ] 1차 파일럿 (PM팀) 완료 + 피드백 반영
- [ ] 2차 파일럿 (개발팀 리드) 완료 + 피드백 반영
- [ ] 온보딩 문서 작성 완료

---

## 5. Phase 3: Full Deployment

### 5-1. 목표

전사 표준으로 선언하고, 자동화된 설치/업데이트 체계를 구축한다.

### 5-2. 온보딩 스크립트

```bash
#!/bin/bash
# setup-sr-harness.sh — 팀원 온보딩 스크립트

set -euo pipefail
echo "=== SR Harness 설치 ==="

# 1. Claude Code 설치 확인
if ! command -v claude &> /dev/null; then
  echo "❌ Claude Code가 설치되어 있지 않습니다."
  echo "https://claude.ai/download 에서 설치 후 다시 실행하세요."
  exit 1
fi

# 2. 기존 hoyeon 비활성화 (있으면)
# settings.json에서 hoyeon 플러그인 비활성화

# 3. sr-harness marketplace 등록 + 활성화
SETTINGS="$HOME/.claude/settings.json"
# jq를 사용하여 extraKnownMarketplaces, enabledPlugins 설정

# 4. 플러그인 설치 확인
echo "sr-harness 플러그인을 설치합니다..."

echo "=== 설치 완료 ==="
echo "새 터미널을 열고 Claude Code를 시작하세요."
echo "테스트: /specify 명령으로 동작을 확인하세요."
```

### 5-3. 전사 배포 흐름

```
GitHub repo (release 브랜치)
    ↓
setup-sr-harness.sh 스크립트
    ↓ 팀원 실행
자동 설정:
  ├── sr-harness 플러그인 설치
  ├── settings.json 구성
  ├── CLAUDE.md 템플릿 배포 (선택)
  └── .claude/rules/ 표준 규칙 배포 (선택)
```

### 5-4. 업데이트 배포 프로세스

```
hoyeon 새 버전 릴리스 (예: v1.7.0)
    ↓
관리자: develop에서 upstream merge + 충돌 해결
    ↓
관리자: ./build-release.sh v1.7.0-sr.1
    ↓
관리자: git push origin release/v1.7.0-sr.1
    ↓
팀원: Claude Code 재시작 시 자동 업데이트 (또는 수동 pull)
```

### 5-5. Phase 3 완료 기준

- [ ] 온보딩 스크립트 완성 + 테스트
- [ ] 전사 배포 완료 (전 팀원 설치 확인)
- [ ] 업데이트 배포 프로세스 1회 이상 검증
- [ ] 팀원 가이드 문서 배포

---

## 6. 설계 원칙

### 6-1. 커스텀 변경 격리 규칙

upstream 머지 비용을 최소화하기 위해, 변경 방식에 따라 충돌 위험을 관리한다.

```
✅ 안전 (머지 충돌 거의 없음):
  - 새 섹션/블록 추가 (Document Rendering Protocol처럼)
  - 새 스킬 생성 (doc-brainstorming처럼)
  - 새 에이전트 생성
  - .claude/rules/ 추가
  - Hook 추가 (기존 hook과 별도 파일)

⚠ 주의 (머지 시 수동 해결 필요):
  - 기존 섹션 텍스트 수정 (L2 질문 한글화 등)
  - 기존 Hook 스크립트 수정
  - CLI 코드 수정

❌ 금지 (upstream 머지 불가):
  - spec.json 스키마 구조 변경 (필드 추가/삭제)
  - CLI 커맨드 이름 변경
  - 기존 스킬 삭제
  - 내부 네이밍 일괄 변경 (build script에서만 처리)
```

### 6-2. 브랜치 규칙

| 브랜치 | 역할 | 네이밍 | 직접 커밋 |
|--------|------|--------|----------|
| `main` | upstream 미러 | hoyeon 원본 | ❌ (upstream merge만) |
| `develop` | 커스터마이즈 통합 | hoyeon 유지 | ✅ |
| `feat/*` | 개별 커스텀 작업 | hoyeon 유지 | ✅ |
| `release/*` | 빌드 산출물 | **sr-harness** | ❌ (build script만) |

### 6-3. 커밋 컨벤션

모든 커스텀 변경은 `[custom]` 태그로 upstream 변경과 구분:

```
[custom] feat(specify): L2에 AMR 도메인 체크포인트 추가
[custom] feat(skills): doc-brainstorming 스킬 추가
[custom] build: build-release.sh 업데이트
[upstream] merge: hoyeon v1.6.0
```

### 6-4. 버전 규칙

```
sr-harness 버전 = hoyeon upstream 버전 + 커스텀 빌드 번호
예: hoyeon v1.5.4 기반 → sr-harness v1.5.4-sr.1, v1.5.4-sr.2, ...
    hoyeon v1.6.0 병합 → sr-harness v1.6.0-sr.1
```

---

## 7. 배포 아키텍처

### 7-1. Git 구조

```
GitHub: sr-ai-dev/sr-harness

Remotes:
  upstream → github.com/team-attention/hoyeon        (원본)
  origin   → github.com/sr-ai-dev/sr-harness         (fork)

Branches:
  main                    ← upstream 미러 (hoyeon 원본 그대로)
  develop                 ← 커스터마이즈 (hoyeon 네이밍 유지)
  release/v1.5.4-sr.1     ← 배포물 (sr-harness 네이밍으로 변환됨)
```

커밋 컨벤션:
```
[custom] feat(specify): ...     ← 시스콘 커스터마이즈
[custom] build: ...             ← 빌드/인프라 변경
[upstream] merge: hoyeon v1.6.0 ← upstream 병합
```

### 7-2. 로컬 디렉토리 구조 (플러그인 시스템)

Claude Code 플러그인은 **marketplace** (git clone)와 **cache** (실행용 복사본) 2계층으로 관리된다.

```
~/.claude/plugins/
├── installed_plugins.json                 ← 설치된 플러그인 메타데이터
├── known_marketplaces.json                ← marketplace 등록 정보
│
├── marketplaces/                          ← git clone (소스 관리)
│   └── {marketplace-name}/
│       ├── .git/                          ← git 이력, 브랜치 관리
│       ├── .claude-plugin/
│       │   └── plugin.json               ← 플러그인 메타 (name, version)
│       ├── skills/                        ← 스킬 정의 (.md)
│       ├── agents/                        ← 에이전트 정의 (.md)
│       ├── scripts/                       ← Hook 스크립트 (.sh)
│       └── cli/                           ← CLI 소스
│
└── cache/                                 ← 실행용 복사본
    └── {marketplace-name}/
        └── {plugin-name}/
            └── {version}/                 ← Claude Code가 여기서 읽음
                ├── skills/
                ├── agents/
                ├── scripts/
                └── cli/
```

#### marketplace vs cache 관계

| | marketplace | cache |
|--|------------|-------|
| 역할 | git clone (소스 관리) | 플러그인 실행에 사용 |
| git | ✅ .git/ 있음 | ❌ 없음 |
| 브랜치 관리 | develop, release 등 | 없음 (특정 시점 복사본) |
| 수정 | 커스터마이즈 작업 여기서 | 직접 수정 비권장 |
| 반영 | 플러그인 업데이트 시 cache로 복사됨 | Claude Code가 여기서 스킬 로드 |

> **주의**: marketplace에서 커스터마이즈해도 cache에 자동 반영되지 않는다.
> 플러그인 업데이트(`claude plugin update`) 또는 수동 복사가 필요하다.

### 7-3. 개발자 vs 팀원 디렉토리 비교

#### 개발자 (develop 브랜치 — 커스터마이즈 작업)

```
~/.claude/plugins/
├── marketplaces/
│   └── team-attention-dev/              ← develop 브랜치
│       ├── .claude-plugin/
│       │   └── plugin.json              ← name: "hoyeon"
│       ├── skills/specify/
│       │   ├── SKILL.md                 ← .hoyeon 참조 유지
│       │   └── references/
│       │       ├── L0-L1-context.md     ← Syscon Extension 포함
│       │       ├── L2-decisions.md      ← Syscon Extension 포함
│       │       ├── L3-requirements.md   ← Syscon Extension 포함
│       │       └── L4-tasks.md
│       ├── scripts/                     ← hoyeon-cli 참조 유지
│       └── build-release.sh             ← 네이밍 변환 스크립트
│
└── cache/team-attention-dev/hoyeon/1.5.4/  ← 실행 위치
```

#### 팀원 (release 브랜치 — 변환된 네이밍)

```
~/.claude/plugins/
├── marketplaces/
│   └── syscon-robotics/                  ← release 브랜치
│       ├── .claude-plugin/
│       │   └── plugin.json               ← name: "sr-harness"
│       ├── skills/specify/
│       │   ├── SKILL.md                  ← .sr-harness 참조
│       │   └── references/               ← 내용도 .sr-harness
│       ├── scripts/                      ← sr-harness-cli 참조
│       └── cli/                          ← @syscon-robotics/sr-harness-cli
│
└── cache/syscon-robotics/sr-harness/1.5.4-sr.1/  ← 실행 위치
```

#### 개발자 vs 팀원 비교 요약

| 항목 | 개발자 (develop) | 팀원 (release) |
|------|:---:|:---:|
| plugin name | `hoyeon` | `sr-harness` |
| 작업 디렉토리 | `.hoyeon/` | `.sr-harness/` |
| CLI | `hoyeon-cli` | `sr-harness-cli` |
| npm scope | `@team-attention` | `@syscon-robotics` |
| 스킬 내용 | 동일 (커스터마이즈 포함) | 동일 (네이밍만 변환) |
| 스킬 호출 | `/specify`, `/execute` | `/specify`, `/execute` (동일) |
| upstream 머지 | ✅ 가능 | N/A (빌드 산출물) |

### 7-4. 프로젝트 레벨 오버라이드

```
sr-harness (전사 표준 — release 브랜치)
  ├── 공통 스킬 29+ (specify, execute, ...)
  ├── 공통 에이전트 23+
  ├── 공통 Hook 13+
  └── 공통 Rules
       ↓ 프로젝트에서 확장
프로젝트 .claude/skills/  (프로젝트 전용 스킬)
프로젝트 .claude/rules/   (프로젝트 전용 규칙)
프로젝트 CLAUDE.md         (프로젝트 전용 지침)
```

프로젝트 레벨 `.claude/skills/`에 같은 이름의 스킬이 있으면 플러그인 버전 대신 프로젝트 버전이 사용됨:

| 수준 | 위치 | 용도 |
|------|------|------|
| **전사 표준** | sr-harness 플러그인 (release) | 모든 프로젝트 공통 |
| **팀별 커스텀** | 프로젝트 `.claude/skills/` | 프로젝트 특화 오버라이드 |
| **개인 커스텀** | `~/.claude/skills/` | 비권장 (관리 어려움) |

### 7-5. 팀원이 보는 환경

```
팀원 시점:
  $ sr-harness-cli --version         ← 회사 CLI 이름
  sr-harness-cli v1.5.4-sr.1

  $ ls -a project/
  .sr-harness/               ← 회사 디렉토리명
  .claude/

  $ claude
  > /specify                 ← 스킬 호출은 동일
  > /execute
```

### 7-6. 팀원 설치 방법

팀원 PC의 글로벌 설정 `~/.claude/settings.json`에 추가:

```json
{
  "enabledPlugins": {
    "sr-harness@syscon-robotics": true
  },
  "extraKnownMarketplaces": {
    "syscon-robotics": {
      "source": {
        "source": "github",
        "repo": "sr-ai-dev/sr-harness",
        "branch": "release/v1.5.4-sr.4"
      }
    }
  }
}
```

Claude Code 재시작 시 런타임이 자동으로:
1. `sr-ai-dev/sr-harness`의 release 브랜치를 clone → `~/.claude/plugins/marketplaces/syscon-robotics/`
2. cache에 복사 → `~/.claude/plugins/cache/syscon-robotics/sr-harness/`
3. 스킬, 에이전트, Hook 활성화

#### 설정 파일 위치

| 파일 | 경로 | 역할 |
|------|------|------|
| 글로벌 설정 | `~/.claude/settings.json` | 플러그인 등록, 권한, MCP 등 |
| 프로젝트 설정 | `프로젝트/.claude/settings.local.json` | 프로젝트별 오버라이드 |

팀원이 수정하는 건 **글로벌 설정** 하나.

### 7-7. 개발 환경과 플러그인 환경의 분리

개발(develop 브랜치)은 **아무 위치**에서 가능. `~/.claude/plugins/` 안에 있을 필요 없다.

```
개발용 clone (자유 경로):
  ~/dev-ws/sr-harness/                      ← 개발 + 커밋 + 빌드
  → develop 브랜치
  → 스킬/에이전트/스크립트 수정
  → build-release.sh 실행
  → release 브랜치 push

플러그인 로드 위치 (고정, Claude Code 런타임이 관리):
  ~/.claude/plugins/marketplaces/syscon-robotics/  ← release 브랜치 clone
  ~/.claude/plugins/cache/syscon-robotics/          ← 실제 실행
```

#### 개발 워크플로우 (자동화)

`build-release.sh`가 빌드부터 배포까지 한 번에 처리:

```bash
cd ~/dev-ws/syscon-robotics/sr-harness
./build-release.sh v1.5.4-sr.5
```

자동으로 실행되는 단계:

```
1. release 브랜치 생성 + 네이밍 변환 (.hoyeon→.sr-harness 등)
2. 잔여 참조 검사
3. 커밋
4. git push origin release/v1.5.4-sr.5
5. git checkout develop (복귀)
6. marketplace에서 release pull
7. cache에 rsync 동기화
```

완료 후 **새 Claude Code 세션을 시작하면 변경사항이 반영**된다.

#### marketplace 브랜치 선택

marketplace 디렉토리(`~/.claude/plugins/marketplaces/syscon-robotics/`)는 어떤 브랜치든 가능하다. Claude Code 런타임은 **cache에서 플러그인을 로드**하므로 marketplace 브랜치는 실행에 영향 없다.

| marketplace 브랜치 | 보이는 네이밍 | 실행 | 용도 |
|-------------------|-------------|:---:|---------|
| release | `.sr-harness`, `sr-harness-cli` | ✅ | 팀원과 동일 환경 (권장) |
| develop | `.hoyeon`, `hoyeon-cli` | ✅ | 개발자 내부 확인용 |

> marketplace는 `claude plugin update` 실행 시에만 사용된다 (marketplace → cache 복사).
> 일반 세션에서는 cache만 읽는다.

#### build 스크립트의 네이밍 변환 범위

`build-release.sh`는 **29개 스킬, 23개 에이전트, 13개 스크립트 — 전체 파일**을 일괄 변환:

| 변환 대상 | before (develop) | after (release) |
|----------|-----------------|-----------------|
| 디렉토리/참조 | `.hoyeon` | `.sr-harness` |
| CLI 바이너리 | `hoyeon-cli` | `sr-harness-cli` |
| npm scope | `@team-attention` | `@syscon-robotics` |
| plugin name | `hoyeon` | `sr-harness` |

예: `/execute` 스킬에 `hoyeon-cli spec validate .hoyeon/specs/...`라고 적혀 있으면, release에서는 자동으로 `sr-harness-cli spec validate .sr-harness/specs/...`로 변환된다.

#### 로컬 테스트 (develop에서 직접)

release 빌드 없이 개발 중인 내용을 바로 테스트하려면:

```bash
# develop의 변경을 cache에 직접 동기화
rsync -av --exclude='.git' \
  ~/dev-ws/syscon-robotics/sr-harness/ \
  ~/.claude/plugins/cache/syscon-robotics/sr-harness/1.5.4/

# 새 Claude Code 세션에서 테스트
```

> 이 방식은 네이밍 변환 없이 develop 그대로 로드된다.
> `.hoyeon` 네이밍이 보이지만 실행에는 문제 없다.

---

## 8. 리스크 및 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| Upstream 대규모 리팩토링 (스키마 변경) | develop에서 머지 충돌 증가 | v1 스키마가 slim 리셋 직후이므로 당분간 안정적. 대규모 변경 시 cherry-pick 전환 |
| Build script 변환 누락 | release에서 hoyeon 참조 잔존 | 잔여 참조 검사 단계로 자동 감지. CI에 검증 추가 |
| 팀원 Claude Code 숙련도 차이 | 하네스 활용도 편차 | 단계적 온보딩 (mirror → specify → execute) |
| hoyeon 라이선스 변경 | fork 지속 불가 | 현재 오픈소스. 변경 시 마지막 호환 버전에서 독립 |
| 커스텀 변경 간 충돌 (다수 팀원) | 표준 파편화 | develop 브랜치에서 통합. PR 리뷰 필수 |
| develop에서 검증했지만 release에서 오동작 | 네이밍 변환이 로직에 영향 | build 후 release에서도 표준 샘플 실행으로 교차 검증 |

---

## 9. 의사결정 로그

| 결정 | 선택 | 근거 |
|------|------|------|
| Fork vs Wrapper | Fork | 플러그인 시스템이 wrapper 레이어를 미지원. Full fork가 유일한 방법 |
| 내부 네이밍 변경 여부 | **안 함** | 내부 변경 = upstream 머지 불가. 외부 네이밍은 build-time 변환으로 해결 |
| 네이밍 변환 방식 | Build-time 변환 | 소스(develop)는 upstream 호환 유지, 배포물(release)만 회사 네이밍 |
| CLI 리브랜딩 방식 | Build script sed 치환 | alias/wrapper보다 깔끔. release에서 완전한 네이밍 통일 |
| Upstream 추적 전략 | 영구 유지 (main 미러) | cherry-pick보다 full merge가 누락 위험 적음. 충돌 비용은 develop에서 흡수 |
| 프로젝트 레벨 오버라이드 | 허용 | 전사 표준 + 프로젝트별 유연성 양립 |

---

## 10. 즉시 실행 항목 (Phase 1)

### Step 1: Fork + 레포 구성

- [ ] GitHub에 `sr-ai-dev/sr-harness` 레포 생성
- [ ] hoyeon v1.5.4 clone + upstream remote 설정
- [ ] develop 브랜치 생성

### Step 2: 기존 커스터마이즈 보존

- [ ] marketplace 클론의 uncommitted 변경 4개 파일을 develop에 커밋
- [ ] 커밋 메시지: `[custom] feat(specify): Document Rendering Protocol + 9-section design.md`

### Step 3: Build Pipeline 구축

- [ ] `build-release.sh` 작성 + 커밋
- [ ] 첫 release 빌드: `./build-release.sh v1.5.4-sr.1`
- [ ] 잔여 참조 검사 통과 확인

### Step 4: 로컬 전환 + 검증

- [ ] settings.json을 sr-harness (release 브랜치)로 전환
- [ ] Claude Code 재시작
- [ ] `/specify` 실행 → Document Rendering Protocol 동작 확인
- [ ] `/execute` 실행 → 기본 파이프라인 동작 확인

### Step 5: upstream 머지 리허설

- [ ] develop에서 upstream/main의 최신 상태와 merge 테스트
- [ ] 충돌 발생 시 해결 연습
- [ ] merge 후 build-release.sh 재실행 → release 정상 생성 확인
