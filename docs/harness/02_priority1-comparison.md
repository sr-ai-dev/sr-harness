# 1순위 비교 검토: 핵심 워크플로우 스킬

> 작성일: 2026-04-12
> 목적: 현재 글로벌 스킬 → hoyeon 전환 시 각 스킬 쌍의 차이와 통합 결정 도출

---

## 비교 1: writing-plans vs /specify L3-L4

### 역할 요약

| | writing-plans | /specify L3-L4 |
|---|---|---|
| **입력** | requirements.md + design.md (마크다운) | L2 Decisions (spec.json 내 구조화된 JSON) |
| **산출물** | tasks.md (마크다운) | spec.json의 requirements[] + tasks[] (JSON) |
| **도구** | 수작업 마크다운 작성 | `sr-harness-cli spec derive-requirements`, `derive-tasks`, `merge --patch` |

### 상세 차이

#### (a) 요구사항 도출

| 관점 | writing-plans | /specify L3 |
|------|--------------|-------------|
| **요구사항 레이어** | 없음 (brainstorming의 requirements.md를 그대로 받음) | L3에서 Decisions → Requirements 명시적 도출 |
| **자동 스캐폴드** | 없음 | `derive-requirements` → 결정 1:1 매핑 후 재구조화 |
| **서브 요구사항** | 없음 | 필수 (GWT: Given/When/Then 형식) |
| **품질 규칙** | 없음 | BANNED 단어 ("correctly", "properly"), 필수 요소 (trigger + outcome) |
| **경계 분해** | 없음 | API↔UI, Service↔Consumer 등 경계별 서브 요구사항 분리 필수 |
| **커버리지 검증** | 수동 | CLI 자동 (`spec validate --layer requirements`) |

**핵심 차이**: writing-plans는 요구사항을 "받는" 역할이고, /specify L3는 요구사항을 결정에서 "도출하고 검증하는" 역할이다.

#### (b) 태스크 분해

| 관점 | writing-plans | /specify L4 |
|------|--------------|-------------|
| **분해 단위** | 파일/함수 단위 (2-5분 스텝) | 수직 슬라이스 단위 (BE+FE+연결 검증) |
| **태스크 내용** | 완전한 코드 포함 (테스트 코드, 구현 코드, 커밋 명령) | action 문자열만 (구체적 코드는 Worker가 실행 시 결정) |
| **파일 매핑** | 명시적 (Create: path, Modify: path:lines, Test: path) | 없음 (실행 시 Worker가 결정) |
| **추적성** | 없음 (태스크↔요구사항 매핑이 암묵적) | `fulfills[]`로 태스크→요구사항 명시적 추적 |
| **의존성** | 암묵적 (번호 순서) | `depends_on[]`으로 DAG 구성, 병렬 실행 가능 |
| **검증 기준** | 태스크 내 인라인 (Expected: PASS/FAIL) | 별도 필드 없음 — fulfills[]가 가리키는 요구사항의 GWT가 기준 |
| **스캐폴드** | 수작업 | `derive-tasks` → 자동 생성 후 재구조화 |
| **런타임 적응** | 수동 재계획 | Derived Task System (append-only, depth-1, circuit breaker) |

**핵심 차이**: writing-plans는 "개발자에게 주는 상세 레시피"이고, /specify L4는 "Worker 에이전트가 해석할 구조화된 작업 명세"이다.

#### (c) TDD 접근

| 관점 | writing-plans | /specify L4 + /execute |
|------|--------------|----------------------|
| **TDD** | 필수 (test → fail → impl → pass → commit 5단계) | 옵트인 (`--tdd` 플래그) |
| **테스트 코드 위치** | 태스크 내 인라인 (완전한 테스트 코드 포함) | Worker가 실행 시 작성 |

### 비교 1 결론

| 항목 | 판정 | 근거 |
|------|------|------|
| **요구사항 추적성** | /specify 우위 | fulfills[] + GWT + CLI 검증 vs 암묵적 참조 |
| **태스크 상세도** | writing-plans 우위 | 완전한 코드/명령 포함 vs action 문자열만 |
| **자동화** | /specify 우위 | derive + validate + 런타임 적응 vs 수작업 |
| **병렬 실행** | /specify 우위 | DAG 기반 병렬 vs 순차 |
| **인간 가독성** | writing-plans 우위 | 마크다운 레시피 vs JSON 스키마 |
| **런타임 복원력** | /specify 우위 | Derived Task System vs 수동 재계획 |

**통합 방향**: /specify의 도출 체인(L0→L4)을 기본 엔진으로 채택. writing-plans의 "인간 가독성 레시피" 기능은 spec.json → tasks.md 렌더러로 보존 가능 (Phase 3에서 구현).

---

## 비교 2: development-workflow vs /ultrawork

### 역할 요약

| | development-workflow | /ultrawork |
|---|---|---|
| **목적** | 5단계 승인 기반 개발 워크플로우 오케스트레이션 | specify → execute 자동 파이프라인 |
| **단계** | 5단계 (Kickoff → Planning → Impl → Verify → Complete) | 2단계 (specify → execute) |
| **전환 메커니즘** | 스킬 체인 (수동 호출) + TodoWrite 상태 추적 | Stop Hook 자동 전환 + state.local.json |

### 상세 차이

#### (a) 단계 구조

| development-workflow (5단계) | /ultrawork 대응 | 차이 |
|---|---|---|
| 1. Kickoff (brainstorming) | specify L0-L2 (Interview) | brainstorming은 마크다운 산출, specify는 JSON |
| 2. Task Planning (writing-plans) | specify L3-L4 (Requirements+Tasks) | 위 비교 1 참조 |
| **승인 게이트 A** | specify L2 승인 | dev-workflow: 1회, specify: L2/L3/L4 3회 |
| **승인 게이트 B** | specify L4 Plan Summary 승인 | 동일 목적 |
| 3. Implementation | /execute (Direct/Agent/Team 3모드) | dev-workflow: 2모드(subagent/parallel), execute: 3모드 |
| 4. Verification | /execute 내장 (4-tier verify) | dev-workflow: 별도 스킬, execute: 통합 |
| 5. Completion | /execute 완료 보고 | dev-workflow: finishing-a-development-branch, execute: 보고만 |

#### (b) 상태 관리

| 관점 | development-workflow | /ultrawork |
|------|---------------------|------------|
| **상태 추적** | TodoWrite (대화 내) | state.local.json (파일 기반) |
| **세션 간 재개** | 파일 존재 여부로 단계 추정 | spec.json task status로 정확한 복원 |
| **컨텍스트 압축** | TodoWrite 상태로 위치 파악 | session-compact-hook.sh가 자동 복구 |

#### (c) 전환 메커니즘

| 관점 | development-workflow | /ultrawork |
|------|---------------------|------------|
| **단계 전환** | 스킬이 완료 → 오케스트레이터로 제어 반환 → 다음 스킬 호출 | Stop Hook이 자동 감지 → 다음 단계 트리거 |
| **중단 처리** | TodoWrite + 파일 기반 추정 | 사용자가 "stop/pause/wait" → 즉시 중단 |
| **자동화 수준** | 각 단계마다 사용자 확인 필수 | specify 중 3회 승인 외 자동 |

#### (d) 구현 실행

| 관점 | development-workflow | /execute |
|------|---------------------|----------|
| **실행 모드** | 2가지: subagent-driven / parallel session | 3가지: Direct / Agent / Team |
| **워크트리** | using-git-worktrees 별도 스킬 | /execute 내장 (EnterWorktree) |
| **검증 깊이** | 단일 (verification-before-completion) | 4단계 (Light/Standard/Thorough/Ralph) |
| **코드 리뷰** | reviewer 에이전트 (매 태스크 필수) | 조건부 (Standard+에서 자동/스킵 판단) |
| **런타임 실패** | 사용자에게 보고 후 중단 | Derived Task System (자동 재시도/적응) |

#### (e) 산출물

| 산출물 | development-workflow | /ultrawork |
|--------|---------------------|------------|
| 설계 문서 | requirements.md + design.md (마크다운) | spec.json (JSON) |
| 태스크 계획 | tasks.md (마크다운) | spec.json 내 tasks[] (JSON) |
| 완료 보고 | summary.md (마크다운) | 실행 보고 (콘솔 출력) |
| 학습 기록 | 없음 | learnings.json, issues.json (구조화된 지식 복리) |
| 실행 감사 | 없음 | audit.md, round-summaries.json |

#### (f) 양방향 동기화

| 관점 | development-workflow | /ultrawork |
|------|---------------------|------------|
| **설계 → 태스크 전파** | 수동 (design.md 변경 시 tasks.md 수동 업데이트, Gate B 복귀) | spec.json 내 단일 구조 → CLI로 일관성 유지 |
| **태스크 → 설계 역전파** | 수동 (모순 발견 시 사용자 확인 후 수정) | Derived Task 생성 (append-only, 기존 불변) |

### 비교 2 결론

| 항목 | 판정 | 근거 |
|------|------|------|
| **자동화 수준** | /ultrawork 우위 | Stop Hook 자동 전환 vs 수동 스킬 체인 |
| **상태 복원력** | /ultrawork 우위 | spec.json + state.json vs TodoWrite |
| **실행 유연성** | /execute 우위 | 3모드 + 4검증깊이 vs 2모드 + 1검증 |
| **런타임 적응** | /execute 우위 | Derived Task System vs 수동 재계획 |
| **지식 축적** | /ultrawork 우위 | learnings.json + BM25 검색 vs 없음 |
| **인간 산출물** | dev-workflow 우위 | 4개 마크다운 문서 vs JSON + 콘솔 출력 |
| **세분화된 승인** | /specify 우위 | L2/L3/L4 3회 vs Gate A/B 2회 |
| **워크트리 통합** | /execute 우위 | 내장 vs 별도 스킬 |

**통합 방향**: /ultrawork(specify→execute 파이프라인)을 기본 워크플로우 엔진으로 채택. development-workflow의 "인간 산출물 4종(requirements.md, design.md, tasks.md, summary.md)"은 spec.json → 마크다운 렌더러로 보존 (Phase 3에서 구현). finishing-a-development-branch는 hoyeon에 없으므로 별도 유지.

---

## 비교 3: orchestrate vs hoyeon 전체 체계

### 역할 요약

| | orchestrate (현재) | hoyeon |
|---|---|---|
| **목적** | 3모드 오케스트레이터 (Workflow/Teamplay/Harness) | 요구사항 중심 개발 자동화 플러그인 |
| **진입점** | orchestrate 스킬 1개 | /specify, /execute, /ultrawork 등 독립 스킬 |
| **상태** | Phase 1 (Pipeline만 구현) | v1.5.4 (3 dispatch + 4 verify + Derived Task) |

### 모드 매핑

| orchestrate 모드 | hoyeon 대응 | 커버리지 |
|---|---|---|
| **Workflow** ("5단계") | `/specify` → `/execute --dispatch direct` | 완전 대체 가능 |
| **Teamplay** ("팀플레이") | `/specify` → `/execute --dispatch agent` | 완전 대체 가능 |
| **Harness** ("하네스") | `/ultrawork` (자동 파이프라인) | 완전 대체 가능 |
| — | `/execute --dispatch team` (TeamCreate 영속 워커) | 새 기능 (orchestrate에 없음) |

### 상세 차이

#### (a) 에이전트 오케스트레이션

| 관점 | orchestrate | hoyeon /execute |
|------|-------------|-----------------|
| **패턴** | Pipeline (Phase 1), Fan-out 예정 | Direct / Agent(그루핑) / Team(영속 워커) |
| **coder→reviewer 루프** | 필수 (매 태스크, 최대 3회) | 조건부 코드 리뷰 (Standard+에서 자동 판단) |
| **reviewer 독립성** | 별도 에이전트 (reviewer.md) | code-reviewer 에이전트 (자동 패스 조건 있음) |
| **tester 검증** | 별도 에이전트 (빌드+런타임 필수) | 4-tier verify (Light→Thorough), qa-verifier |
| **병렬 실행** | Fan-out 예정 (미구현) | run_in_background 라운드 기반 병렬 |

#### (b) 트리거 체계

| 관점 | orchestrate | hoyeon |
|------|-------------|-------|
| **진입** | 키워드 ("5단계", "팀플레이", "하네스") | 슬래시 명령 (/specify, /execute, /ultrawork) |
| **자동 감지** | 3+파일 수정 시 제안 | 없음 (명시적 호출만) |
| **모드 전환** | 키워드 기반 | CLI 플래그 기반 (--dispatch, --verify) |

#### (c) 훅 시스템

| 관점 | orchestrate | hoyeon |
|------|-------------|-------|
| **훅** | 없음 (rules 파일로 게이트 로직) | 20개 훅 스크립트 (6종 이벤트) |
| **쓰기 보호** | 없음 | skill-session-guard.sh (specify 중 코드 차단) |
| **파이프라인 전환** | 수동 스킬 호출 | ultrawork-stop-hook.sh (자동 전환) |
| **세션 종료 차단** | 없음 | skill-session-stop.sh (미완료 태스크 시 차단) |
| **실패 복구** | 없음 | edit-error-recovery.sh, large-file-recovery.sh |
| **출력 제어** | 없음 | tool-output-truncator.sh (50K/10K 제한) |

#### (d) 글로벌 CLAUDE.md 규칙과의 관계

현재 글로벌 CLAUDE.md의 핵심 규칙들과 hoyeon의 대응:

| 글로벌 CLAUDE.md 규칙 | hoyeon 대응 | 비고 |
|---|---|---|
| reviewer 필수 실행 (매 coder 태스크 후) | 코드 리뷰 조건부 (diff ≤200줄 + 저위험 = 자동 패스) | **철학 차이**: 글로벌은 무조건, hoyeon은 조건부 |
| tester 빌드+런타임 검증 필수 | 4-tier verify (Light에서는 빌드만) | **철학 차이**: 글로벌은 항상 런타임, hoyeon은 선택 |
| 3회 NEEDS_REVISION 후 사용자 보고 | Derived Task circuit breaker (max 2 attempts) | 유사 |
| 설계 문서 없이 복잡한 구현 금지 | specify 없이 execute 불가 | 동일 |

### 비교 3 결론

| 항목 | 판정 | 근거 |
|------|------|------|
| **실행 성숙도** | hoyeon 우위 | 3 dispatch + 4 verify + Derived Task vs Phase 1 Pipeline만 |
| **훅 시스템** | hoyeon 우위 | 20개 훅 vs 없음 |
| **자동화** | hoyeon 우위 | Stop Hook 파이프라인 vs 수동 스킬 체인 |
| **유연성** | hoyeon 우위 | CLI 플래그 조합 vs 3모드 고정 |
| **접근성** | orchestrate 우위 | 한국어 키워드 vs 영어 슬래시 명령 |
| **reviewer 엄격성** | orchestrate 우위 | 무조건 필수 vs 조건부 스킵 |
| **사용 중인 프로젝트 영향** | 주의 필요 | 글로벌 교체 시 기존 프로젝트 규칙 충돌 |

**통합 방향**: hoyeon의 /specify → /execute → /ultrawork 체계를 기본 워크플로우 엔진으로 채택. orchestrate 스킬은 제거. 단, 다음 2개 요소는 보존/조정 필요:

1. **reviewer 엄격성**: hoyeon의 조건부 코드 리뷰를 기본 유지하되, 프로젝트별 `agent-overrides.md`에서 "무조건 리뷰" 옵션 제공
2. **한국어 트리거**: hoyeon에 한국어 키워드 트리거 추가 (커스텀 Hook 또는 skill description 확장)

---

## 종합: 1순위 통합 결정

### 확정 사항

| # | 결정 | 상세 |
|---|------|------|
| 1 | **기본 엔진** | hoyeon의 /specify → /execute 파이프라인을 기본 워크플로우 엔진으로 채택 |
| 2 | **제거 대상** | writing-plans, development-workflow, orchestrate — 3개 글로벌 스킬 제거 |
| 3 | **보존 대상** | finishing-a-development-branch — hoyeon에 해당 기능 없으므로 유지 |
| 4 | **spec.json = SSoT** | 모든 도출(결정→요구사항→태스크)은 spec.json에서 관리 |
| 5 | **문서 렌더러** | spec.json → requirements.md, design.md, tasks.md 렌더링 기능을 Phase 3에서 구현 |

### 조정 필요 사항

| # | 사항 | 방안 |
|---|------|------|
| 1 | **인간 가독 문서** | spec.json의 내용을 마크다운 문서로 렌더링하는 기능 필요 (팀원 공유, 평가용) |
| 2 | **reviewer 엄격성 설정** | 프로젝트별 agent-overrides.md에서 코드 리뷰 정책 조정 가능하도록 |
| 3 | **한국어 트리거** | hoyeon 스킬 description에 한국어 키워드 추가 또는 래퍼 스킬 |
| 4 | **글로벌 CLAUDE.md 정리** | 5단계 워크플로우/reviewer 필수 규칙을 hoyeon 체계에 맞게 개편 |
| 5 | **기존 프로젝트 영향** | 글로벌 변경 시 다른 프로젝트 호환성 검증 필요 |

---

## 선행 설계 결정: brainstorming의 역할 재정의

1순위 비교 검토에 앞서, brainstorming vs /specify 비교에서 다음 설계 결정이 확정되었다. 이 결정이 위 3개 비교의 "통합 방향"에 직접 반영되어 있다.

### 핵심 원칙: SSoT + 렌더링

```
/specify (도출 엔진)                    문서화 (협업/평가용)
─────────────────────                  ─────────────────────
L0: Goal 확정                          
L1: 코드베이스/컨텍스트 스캔            
L2: Decisions 도출  ─── [Gate 1] ──→   decisions 문서화
L3: Requirements 도출 ─ [Gate 2] ──→   requirements.md
L4: Tasks 도출 ──────── [Gate 3] ──→   design.md + tasks.md
                                        ↑
                                       팀원이 읽고 리뷰
                                       작업 평가 근거
```

- **spec.json이 Single Source of Truth** — 수정은 spec.json에서만
- **문서는 spec.json의 렌더링된 뷰(view)** — spec이 바뀌면 문서도 갱신
- 문서를 직접 수정하는 게 아니라, spec을 수정하면 문서가 따라온다

### 설계 결정 테이블

| 항목 | 결정 |
|------|------|
| **brainstorming 스킬** | 제거하지 않음. **spec.json → 마크다운 문서 생성** 역할로 재정의 |
| **위치** | 글로벌 스킬로 유지하되, /specify 이후 단계로 동작 |
| **트리거** | /specify 완료 후 자동 또는 수동으로 문서 생성 |
| **산출물** | requirements.md + design.md (기존 9섹션 구조 유지) |
| **SSoT** | spec.json (수정은 여기서만) → 문서는 파생물 |

### 이 결정이 위 비교에 미치는 영향

| 비교 | 영향 |
|------|------|
| **비교 1** (writing-plans vs /specify L3-L4) | writing-plans의 "인간 가독 레시피" 기능은 brainstorming 렌더러가 대체. writing-plans 자체는 제거 |
| **비교 2** (development-workflow vs /ultrawork) | dev-workflow의 산출물 4종(requirements.md, design.md, tasks.md, summary.md)은 brainstorming 렌더러가 생성. dev-workflow 자체는 제거 |
| **비교 3** (orchestrate vs hoyeon) | orchestrate의 `_templates/` 참조 로직은 brainstorming 렌더러에 흡수. orchestrate 자체는 제거 |

### 4가지 설계 결정 종합

| # | 결정 사항 | 방향 |
|---|-----------|------|
| 1 | **스킬 통합** | /specify + brainstorming 공존 (역할 분리: 도출 vs 문서화) |
| 2 | **트리거 통합** | hoyeon의 Hook 체계를 기본으로, 문서 트리거는 Phase 3에서 추가 |
| 3 | **init-project** | hoyeon 설치 후 Phase 3에서 문서 프로젝트 타입 추가 |
| 4 | **에이전트** | hoyeon 에이전트 기본, 문서용 역할 재정의는 agent-overrides로 |

---

## 다음 단계

2순위 비교 검토 진행:
- executing-plans vs /execute
- subagent-driven-development vs /execute Agent mode
- verification-before-completion vs /ralph
- dispatching-parallel-agents vs /execute Team mode
