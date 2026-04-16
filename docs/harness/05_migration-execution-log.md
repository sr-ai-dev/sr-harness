# 하네스 전환 실행 로그

> 작성일: 2026-04-12
> 목적: 글로벌 스킬 → hoyeon 전환 작업의 실행 기록

---

## 실행 요약

| Step | 작업 | 상태 | 일시 |
|------|------|:----:|------|
| 1 | 글로벌 CLAUDE.md 개편 적용 | ✅ | 2026-04-12 |
| 2 | 기존 스킬 8개 제거 | ✅ | 2026-04-12 |
| 3 | hoyeon 플러그인 + CLI 설치 | ✅ | 2026-04-12 |
| 4 | 검증 + 학습 | ⬚ | — |
| 5 | 문서 레이어 추가 (Phase 3) | ⬚ | — |

---

## Step 1: 글로벌 CLAUDE.md 개편

### 변경 내용

| 구분 | 섹션 | 상세 |
|------|------|------|
| **제거** | 5단계 워크플로우 (8줄) | hoyeon /specify → /execute로 대체 |
| **제거** | reviewer 필수 규칙 (18줄) | hoyeon verify depth에 위임 |
| **제거** | tester 검증 범위 (14줄) | hoyeon verify recipe에 위임 |
| **추가** | Iron Law (13줄) | "증거 없이 완료 주장 금지" + "근본 원인 없이 수정 금지" |
| **추가** | 폴백 워크플로우 (8줄) | hoyeon 미설치 환경용 경량 규칙 |
| **추가** | 마이그레이션 참고 (2줄) | reviewer/tester 규칙 이관 안내 |
| **수정** | 설계 문서 표준 | hoyeon/비hoyeon 분기 추가, SSoT 원칙 |
| **수정** | 작업 유형별 접근법 | hoyeon 우선, 폴백 규칙 |
| **수정** | 기능 사용 표시 | hoyeon-cli 항목 추가 |
| **유지** | 소통 규칙, Git 커밋, 실패 처리, 웹 검색, Auto Memory 등 | 변경 없음 |

### 백업

- 원본: `~/.claude/CLAUDE.md.bak.20260412`
- 개편안 설계 문서: `harness-research/docs/04_global-claude-md-draft.md`

### 마이그레이션 정책

reviewer/tester 필수 규칙을 사용하던 다른 프로젝트는 **일괄 변경하지 않고, 각 프로젝트 작업 시 개별 적용**한다. 메모리에 정책 기록 완료.

---

## Step 2: 기존 스킬 정리

### 제거된 스킬 (8개)

| 스킬 | 유형 | hoyeon 대체 |
|------|------|------------|
| writing-plans | symlink | /specify L3-L4 |
| development-workflow | symlink | /ultrawork |
| orchestrate | directory | hoyeon 전체 체계 |
| executing-plans | symlink | /execute Direct |
| subagent-driven-development | symlink | /execute Agent |
| verification-before-completion | symlink | /ralph + CLAUDE.md Iron Law |
| systematic-debugging | symlink | /bugfix + CLAUDE.md Iron Law |
| requesting-code-review | symlink | /execute 코드 리뷰 + /tribunal |

### 백업 위치

`~/.claude/skills/_removed_20260412/`

```
_removed_20260412/
├── orchestrate/                  ← 실제 디렉토리 (이동)
├── writing-plans.link            ← 심볼릭 링크 대상 기록
├── development-workflow.link
├── executing-plans.link
├── subagent-driven-development.link
├── verification-before-completion.link
├── systematic-debugging.link
└── requesting-code-review.link
```

### 유지된 스킬 (14개)

| 스킬 | 유지 이유 |
|------|----------|
| brainstorming | 역할 재정의 예정 (spec.json → 마크다운 렌더러) |
| dispatching-parallel-agents | 조사/디버깅 병렬화 (hoyeon과 용도 다름) |
| finishing-a-development-branch | hoyeon에 해당 기능 없음 |
| test-driven-development | /execute --tdd와 보완적 (방법론 vs 플래그) |
| using-git-worktrees | /execute worktree와 용도 다름 (독립 도구) |
| active-research | hoyeon에 해당 기능 없음 |
| actionbook | hoyeon에 해당 기능 없음 |
| ui-ux-pro-max | hoyeon에 해당 기능 없음 |
| humanizer | hoyeon에 해당 기능 없음 |
| find-skills | hoyeon에 해당 기능 없음 |
| writing-skills | hoyeon에 해당 기능 없음 |
| using-superpowers | hoyeon에 해당 기능 없음 |
| receiving-code-review | hoyeon에 해당 기능 없음 |
| init-project | Phase 3에서 수정 예정 |

---

## Step 3: hoyeon 설치

### 설치 항목

| 구분 | 명령어 | 결과 |
|------|--------|------|
| 마켓플레이스 추가 | `claude plugin marketplace add team-attention/hoyeon` | team-attention-dev 등록 |
| 플러그인 설치 | `claude plugin install hoyeon` | v1.5.4, user scope, enabled |
| CLI 전역 설치 | `npm install -g @team-attention/hoyeon-cli` | 7 packages added |

### 설치 확인

```
claude plugin list:
  ❯ hoyeon@team-attention-dev
    Version: 1.5.4
    Scope: user
    Status: ✔ enabled

hoyeon-cli --help:
  hoyeon-cli — Developer workflow CLI
```

### 설치 스코프

- **user scope** — 모든 프로젝트에서 사용 가능
- 프로젝트의 `.claude/` 디렉토리를 직접 수정하지 않음
- 기존 `settings.local.json` (ms365 MCP) 유지

---

## 참조 문서 인덱스

분석 및 결정 과정의 상세 기록:

| 문서 | 내용 |
|------|------|
| `01_priority1-comparison.md` | 핵심 워크플로우 비교 (writing-plans, dev-workflow, orchestrate) |
| `01-1_hoyeon-cli-role.md` | hoyeon-cli 역할과 스킬 의존성 |
| `02_priority2-comparison.md` | 실행/검증 비교 (executing-plans, subagent, verification, parallel) |
| `03_priority3-comparison.md` | 보조 스킬 비교 (debugging, TDD, code-review, worktrees) + 전체 종합 |
| `04_global-claude-md-draft.md` | 글로벌 CLAUDE.md 개편안 + 변경 해설 |
| `karpathy-autoresearch-llm-wiki.md` | Karpathy AutoResearch/LLM Wiki 기술 참고 (sr-project-framework 내) |

---

## 다음 단계

### Step 4: 검증 + 학습

새 세션에서 hoyeon 핵심 스킬을 실제 프로젝트에 적용:

| 순서 | 체험 대상 | 목적 |
|------|----------|------|
| 1 | `/specify` | 도출 체인 (L0→L4) + spec.json 생성 체험 |
| 2 | `/execute` | 3 dispatch 모드 + 4 verify depth 체험 |
| 3 | `/ralph` | Stop Hook 재주입 + DoD 루프 체험 |
| 4 | `/bugfix` | 3에이전트 병렬 진단 체험 |
| 5 | `/tribunal` | 3관점 대립 리뷰 체험 |

### Step 5: 문서 레이어 추가 (Phase 3)

학습 결과를 바탕으로:
- brainstorming을 spec.json → 마크다운 렌더러로 재정의
- 문서 프로젝트(sr-mngt-ws)의 하네스 재구성
- init-project에 문서 프로젝트 타입 추가
- 리브랜딩 검토 (SRCS 등 사내 명칭)
