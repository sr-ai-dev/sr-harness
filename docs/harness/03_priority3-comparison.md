# 3순위 비교 검토: 보조 스킬

> 작성일: 2026-04-12
> 목적: 현재 글로벌 스킬 → hoyeon 전환 시 보조 스킬의 차이와 통합 결정 도출

---

## 비교 8: systematic-debugging vs /bugfix

### 역할 요약

| | systematic-debugging | /bugfix |
|---|---|---|
| **목적** | 근본 원인 먼저 찾은 뒤 수정하라 (방법론) | 진단 → spec.json 생성 → /execute로 수정 (파이프라인) |
| **본질** | **행동 규칙** (4단계 프로세스) | **자동화된 파이프라인** (에이전트 병렬 디스패치 + CLI) |
| **산출물** | 없음 (규칙 준수 여부만) | spec.json + debug report (.sr-harness/debug/) |

### 상세 차이

| 관점 | systematic-debugging | /bugfix |
|------|---------------------|---------|
| **프로세스** | 4단계 수동 (근본 원인 → 패턴 분석 → 가설 → 구현) | 5단계 자동 (진단 → spec 생성 → execute → 결과 처리 → 보고) |
| **근본 원인 분석** | 인간이 직접 (에러 읽기, 재현, 변경 추적, 데이터 플로우) | 3개 에이전트 병렬 (debugger + verification-planner + gap-analyzer) |
| **수정 실행** | 1개 가설 → 1개 수정 → 수동 검증 | spec.json → /execute (Worker + verify recipe) |
| **반복** | 3회 실패 시 아키텍처 재검토 | 3회 실패 시 circuit breaker → /specify 에스컬레이션 |
| **stagnation 감지** | 수동 ("3+ fixes failed" 규칙) | 자동 (SPINNING/OSCILLATION/NO_PROGRESS 패턴 감지) |
| **에스컬레이션** | "사용자와 논의" | spec.json 보존 → /specify로 에스컬레이션 (컨텍스트 유지) |
| **지식 보존** | 없음 | .sr-harness/debug/{slug}.md + learnings.json |
| **QA 후속** | 없음 | Phase 5.3에서 /qa 제안 |
| **외부 도구 의존** | 없음 | sr-harness-cli (spec init, merge, validate) |

### 핵심 차이: 규칙 vs 파이프라인

**systematic-debugging**은 "어떻게 생각해야 하는가"를 가르치는 **사고 프레임워크**:
```
"근본 원인 없이 수정하지 마라" (Iron Law)
→ 에러 읽기 → 재현 → 변경 추적 → 데이터 플로우 추적
→ 패턴 분석 → 가설 → 최소 테스트 → 수정
```

**/bugfix**는 "이 순서대로 실행하라"는 **자동화된 파이프라인**:
```
/bugfix "에러 설명"
→ debugger + gap-analyzer 병렬 디스패치 (자동)
→ 사용자 확인 → spec.json 생성 (자동)
→ /execute → 검증 → 보고
```

### 비교 8 결론

| 항목 | 판정 | 근거 |
|------|------|------|
| **자동화** | /bugfix 압도적 우위 | 에이전트 병렬 진단 + spec + execute 파이프라인 vs 수동 프로세스 |
| **반복 관리** | /bugfix 우위 | stagnation 패턴 자동 감지 vs 수동 카운트 |
| **에스컬레이션** | /bugfix 우위 | spec.json 보존 → /specify vs "사용자와 논의" |
| **사고 프레임워크** | systematic-debugging 우위 | 4단계 사고 과정이 /bugfix보다 교육적 |
| **독립성** | systematic-debugging 우위 | 외부 도구 없이 어디서든 적용 가능 |

**판정: 대체 가능, 단 원칙은 보존.**

/bugfix가 systematic-debugging의 핵심 원칙 3가지를 이미 내재화하고 있다:
- "NO FIXES WITHOUT ROOT CAUSE" (Iron Law 동일)
- 3회 실패 시 circuit breaker (Phase 4 아키텍처 의문)
- 근본 원인 역추적 (debugger 에이전트)

systematic-debugging의 "행동 규칙" 가치(사고 프레임워크)는 글로벌 CLAUDE.md에 간결한 규칙으로 유지 가능.

---

## 비교 9: test-driven-development vs /execute --tdd

### 역할 요약

| | test-driven-development | /execute --tdd |
|---|---|---|
| **목적** | TDD 방법론 강제 (Red-Green-Refactor) | Worker에 TDD 모드 플래그 전달 |
| **본질** | **행동 규칙** (프로세스 + 안티패턴) | **옵트인 플래그** (Worker의 실행 모드) |
| **적용** | 모든 개발 (기능, 버그 수정, 리팩토링) | /execute 실행 시 선택적 |

### 상세 차이

| 관점 | test-driven-development | /execute --tdd |
|------|------------------------|----------------|
| **깊이** | 풍부한 방법론 (Iron Law, Red-Green-Refactor, 안티패턴 11개, 합리화 11개) | Worker에 "TDD flow 사용" 플래그 |
| **강제력** | 프롬프트 규칙 ("코드 먼저 쓰면 삭제") | Worker에 지시 (강제력은 Worker 프롬프트 수준) |
| **교육 가치** | 높음 (왜 TDD인가, 합리화 방지, 안티패턴 목록) | 없음 (on/off 플래그) |
| **적용 범위** | 단독 사용 가능 (어떤 워크플로우든) | /execute 내부에서만 |
| **기본값** | 항상 ON (예외는 사용자 허락 시만) | OFF (--tdd 명시 시만 ON) |

### 핵심 차이: 방법론 vs 플래그

test-driven-development는 370줄의 **TDD 교과서**이다:
- Red-Green-Refactor 사이클 상세 설명
- "테스트 없이 프로덕션 코드 금지" Iron Law
- 11개 합리화 방지 규칙 ("너무 간단해서 테스트 불필요" → 반박)
- 안티패턴 목록 (mock 남용, test-after 등)

/execute --tdd는 **Worker 프롬프트에 전달되는 1줄 지시**:
```
When tdd = true, Workers write tests BEFORE implementation (RED-GREEN-REFACTOR)
```

### 비교 9 결론

| 항목 | 판정 | 근거 |
|------|------|------|
| **방법론 깊이** | TDD 스킬 압도적 우위 | 370줄 교과서 vs 1줄 플래그 |
| **execute 통합** | /execute --tdd 우위 | 파이프라인 내 자연스러운 통합 |
| **독립 사용** | TDD 스킬 우위 | /execute 없이도 사용 가능 |
| **교육 가치** | TDD 스킬 우위 | 합리화 방지, 안티패턴 등 |

**판정: 유지 (보완적).**

두 가지는 레이어가 다르다:
- test-driven-development = **방법론** (왜, 어떻게 TDD를 해야 하는가)
- /execute --tdd = **실행 플래그** (Worker에 TDD 모드 ON)

TDD 스킬은 /execute와 무관하게 독립적으로 사용 가능하며, /execute --tdd가 Worker에 전달하는 TDD 지침의 원천이 될 수 있다. **유지하되, /execute --tdd와 중복되지 않도록 역할 분리** — TDD 스킬은 "교육/원칙", --tdd 플래그는 "실행 모드".

---

## 비교 10: requesting-code-review vs /tribunal

### 역할 요약

| | requesting-code-review | /tribunal |
|---|---|---|
| **목적** | 코드 리뷰 에이전트 디스패치 (단일 리뷰어) | 3관점 대립 리뷰 (Risk/Value/Feasibility) |
| **리뷰어 수** | 1개 (code-reviewer) | 3개 병렬 (codex-risk-analyst + value-assessor + feasibility-checker) |
| **산출물** | Strengths/Issues/Assessment | Verdict (APPROVE/REVISE/REJECT) + 스코어 테이블 |

### 상세 차이

| 관점 | requesting-code-review | /tribunal |
|------|----------------------|-----------|
| **리뷰 관점** | 코드 품질 단일 관점 | 위험성/가치/실행가능성 3관점 |
| **리뷰어 에이전트** | code-reviewer (Claude) 1개 | 3개 병렬: codex-risk-analyst(Codex) + value-assessor(Claude) + feasibility-checker(Claude) |
| **멀티 모델** | 없음 (Claude만) | 있음 (Codex + Claude 혼합) |
| **입력** | git diff (BASE_SHA → HEAD_SHA) | 파일, PR, diff, 자유 입력 |
| **판정** | Ready to proceed / Issues 목록 | APPROVE / REVISE / REJECT (매트릭스 기반) |
| **대립 토론** | 없음 | Contention Points (에이전트 간 의견 차이 분석) |
| **후속 액션** | Fix Critical → Fix Important → Note Minor | Must fix → Should address → Consider |
| **적용 범위** | 코드 구현 후 리뷰 | 계획/PR/diff/제안서 등 범용 |
| **워크플로우 통합** | subagent-driven의 일부 | 독립 스킬 |

### 비교 10 결론

| 항목 | 판정 | 근거 |
|------|------|------|
| **리뷰 깊이** | /tribunal 우위 | 3관점 + 대립 토론 + 멀티 모델 vs 단일 리뷰어 |
| **코드 특화** | requesting-code-review 우위 | git diff 기반 코드 리뷰에 특화 |
| **범용성** | /tribunal 우위 | 계획, PR, diff, 제안서 모두 리뷰 가능 |
| **경량성** | requesting-code-review 우위 | 에이전트 1개 vs 3개 |
| **execute 통합** | /execute 코드 리뷰 우위 | verify-standard에 코드 리뷰 내장 |

**판정: 대체 가능, 단 용도 분리.**

- requesting-code-review의 "코드 리뷰" 기능은 /execute의 verify-standard 코드 리뷰로 대체
- /tribunal의 "3관점 대립 리뷰"는 requesting-code-review보다 상위 기능
- requesting-code-review를 제거하고, 코드 리뷰가 필요하면 /execute 내장 리뷰 또는 /tribunal 사용

---

## 비교 11: using-git-worktrees vs /execute worktree mode

### 역할 요약

| | using-git-worktrees | /execute worktree mode |
|---|---|---|
| **목적** | git worktree 생성 + 안전 검증 (독립 스킬) | /execute Phase 0에서 worktree 진입 (내장) |
| **본질** | **도구 래퍼** (git worktree 안전하게 사용) | **실행 모드** (EnterWorktree API 호출) |

### 상세 차이

| 관점 | using-git-worktrees | /execute worktree |
|------|--------------------|-------------------|
| **생성 방식** | `git worktree add` 직접 실행 | `EnterWorktree(name=spec_name)` API 호출 |
| **디렉토리 선택** | 3단계 우선순위 (.worktrees → CLAUDE.md → 사용자) | 자동 (spec 이름 기반) |
| **안전 검증** | .gitignore 확인, 없으면 추가 + 커밋 | 없음 (API가 관리) |
| **프로젝트 셋업** | 자동 (npm install, cargo build 등 감지) | 없음 (Worker가 필요 시 처리) |
| **베이스라인 테스트** | 필수 (테스트 실패 시 보고) | 없음 |
| **독립 사용** | 어떤 워크플로우에서든 호출 가능 | /execute 내부에서만 |
| **정리** | finishing-a-development-branch와 페어 | ExitWorktree API |

### 비교 11 결론

| 항목 | 판정 | 근거 |
|------|------|------|
| **안전성** | using-git-worktrees 우위 | .gitignore 검증 + 베이스라인 테스트 |
| **통합성** | /execute 우위 | 실행 파이프라인에 자연스러운 내장 |
| **독립 사용** | using-git-worktrees 우위 | /execute 없이도 사용 가능 |
| **경량성** | /execute 우위 | API 1줄 vs 200줄 스킬 |

**판정: 유지 (용도 다름).**

- /execute의 worktree mode는 **실행 파이프라인 내부 기능** (spec 실행 시 격리)
- using-git-worktrees는 **독립 도구** (/execute 없이 worktree가 필요할 때)
- using-git-worktrees의 안전 검증 (.gitignore, 베이스라인 테스트)은 /execute에 없는 가치

---

## 종합: 3순위 통합 결정

### 확정 사항

| # | 현재 스킬 | 판정 | hoyeon 대체 | 비고 |
|---|-----------|------|------------|------|
| 8 | systematic-debugging | **제거, 원칙 유지** | /bugfix | Iron Law는 CLAUDE.md에 유지 |
| 9 | test-driven-development | **유지** | — | /execute --tdd와 레이어 다름 (방법론 vs 플래그) |
| 10 | requesting-code-review | **제거** | /execute 코드 리뷰 + /tribunal | verify-standard에 코드 리뷰 내장 |
| 11 | using-git-worktrees | **유지** | — | /execute worktree와 용도 다름 (독립 도구) |

---

## 전체 통합 결정 종합 (1순위 + 2순위 + 3순위)

### 최종 스킬 처분 테이블

| 스킬 | 판정 | hoyeon 대체 | 비고 |
|------|------|------------|------|
| brainstorming | **역할 재정의** | — | spec.json → 마크다운 렌더러 |
| writing-plans | **제거** | /specify L3-L4 | 추적성 + 자동 스캐폴드가 우위 |
| development-workflow | **제거** | /ultrawork | Hook 자동 전환 + 상태 복원이 우위 |
| orchestrate | **제거** | hoyeon 전체 | 3 dispatch + 4 verify가 Phase 1 Pipeline 상회 |
| executing-plans | **제거** | /execute Direct | DAG 병렬 + Derived Task가 우위 |
| subagent-driven-development | **제거** | /execute Agent | 그루핑 + verify-standard가 우위 |
| verification-before-completion | **스킬 제거, 원칙 유지** | /ralph + CLAUDE.md | 핵심 원칙은 글로벌 규칙으로 내재화 |
| dispatching-parallel-agents | **유지** | — | 조사/디버깅 병렬화 (용도 다름) |
| finishing-a-development-branch | **유지** | — | hoyeon에 해당 기능 없음 |
| systematic-debugging | **스킬 제거, 원칙 유지** | /bugfix | Iron Law는 CLAUDE.md에 유지 |
| test-driven-development | **유지** | — | /execute --tdd와 보완적 (방법론 vs 플래그) |
| requesting-code-review | **제거** | /execute 코드 리뷰 + /tribunal | verify-standard에 코드 리뷰 내장 |
| using-git-worktrees | **유지** | — | /execute worktree와 용도 다름 |

### 요약 통계

```
제거 확정:      8개   (writing-plans, development-workflow, orchestrate,
                      executing-plans, subagent-driven-development,
                      verification-before-completion, systematic-debugging,
                      requesting-code-review)

역할 변경:      1개   (brainstorming → 렌더러)

유지 확정:      4개   (dispatching-parallel-agents, finishing-a-development-branch,
                      test-driven-development, using-git-worktrees)

원칙 보존:      2건   (verification-before-completion의 Iron Law,
                      systematic-debugging의 Iron Law → CLAUDE.md 규칙)
```

### 미검토 글로벌 스킬 (hoyeon과 무관)

다음 10개 스킬은 hoyeon에 대응 기능이 없으므로 비교 대상이 아니며 **그대로 유지**:

- active-research
- actionbook
- ui-ux-pro-max
- humanizer
- find-skills
- writing-skills
- using-superpowers
- receiving-code-review
- init-project (Phase 3에서 수정 예정)

### 다음 단계

비교 검토 완료. 다음 작업:
1. 글로벌 CLAUDE.md 개편안 작성 (제거 스킬 규칙 삭제 + 보존 원칙 유지)
2. hoyeon 설치 계획 확정
3. 기존 스킬 정리 실행
