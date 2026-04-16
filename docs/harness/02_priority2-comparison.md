# 2순위 비교 검토: 실행/검증 스킬

> 작성일: 2026-04-12
> 목적: 현재 글로벌 스킬 → hoyeon 전환 시 실행/검증 계층 스킬의 차이와 통합 결정 도출

---

## 비교 4: executing-plans vs /execute (Direct mode)

### 역할 요약

| | executing-plans | /execute (Direct) |
|---|---|---|
| **입력** | tasks.md (마크다운) | spec.json (`sr-harness-cli spec plan`) |
| **실행 주체** | 오케스트레이터 본인 (배치 실행) | 오케스트레이터 본인 (서브에이전트 없음) |
| **리뷰** | 배치 간 사용자 리뷰 | verify recipe (Light/Standard/Thorough/Ralph) |

### 상세 차이

| 관점 | executing-plans | /execute Direct |
|------|----------------|-----------------|
| **배치 단위** | 3 태스크씩 (고정) | 라운드 기반 (DAG 병렬 그루핑) |
| **진행 제어** | 배치 간 사용자 피드백 대기 | 자동 진행 (Stop Hook 차단만) |
| **상태 추적** | TodoWrite (대화 내) | spec.json task status + state.json |
| **실패 시** | 즉시 중단, 사용자에게 보고 | Derived Task 생성 → 자동 재시도 (max 2) |
| **워크트리** | 별도 스킬 (using-git-worktrees) 필요 | 내장 (EnterWorktree) |
| **완료 후** | finishing-a-development-branch 호출 | 보고 출력 |
| **세션 복구** | 파일 존재 여부로 추정 | spec plan + session-compact-hook.sh |
| **검증** | "Run verifications as specified" (태스크 내 인라인) | 4-tier verify pipeline (별도 레시피) |

### 비교 4 결론

| 항목 | 판정 | 근거 |
|------|------|------|
| **자동화** | /execute 우위 | DAG 병렬 + 자동 진행 vs 3개 배치 + 수동 피드백 |
| **복원력** | /execute 우위 | Derived Task + session compact vs TodoWrite |
| **사용자 개입** | executing-plans 우위 (의도적) | 배치 간 리뷰가 목적인 스킬 |
| **통합 검증** | /execute 우위 | 4-tier verify vs 인라인 검증 |

**판정: 대체 가능.** executing-plans의 "배치 간 사용자 리뷰"가 필요하면 /execute의 verify depth를 조정하거나 중간 보고를 추가하는 방식으로 커버 가능.

---

## 비교 5: subagent-driven-development vs /execute (Agent mode)

### 역할 요약

| | subagent-driven-development | /execute Agent mode |
|---|---|---|
| **입력** | tasks.md (마크다운) | spec.json (JSON) |
| **실행 주체** | 태스크당 fresh 서브에이전트 | 태스크 그룹당 Worker 서브에이전트 |
| **리뷰** | 2단계: spec-reviewer → code-quality-reviewer (매 태스크) | 조건부 코드 리뷰 (Standard+에서 자동 패스 조건) |

### 상세 차이

| 관점 | subagent-driven-development | /execute Agent |
|------|----------------------------|----------------|
| **에이전트 단위** | 태스크 1개 = 에이전트 1개 | 태스크 그룹 (같은 모듈) = 에이전트 1개 |
| **리뷰 구조** | 3개 에이전트/태스크 (implementer + spec-reviewer + code-quality-reviewer) | Worker → 라운드 커밋 → verify recipe |
| **리뷰 시점** | 매 태스크 후 즉시 (순차) | 전체 라운드 후 (배치) |
| **코드 리뷰** | 매 태스크 필수 + 전체 완료 후 최종 리뷰 | 조건부 (diff ≤200줄 + 저위험 = 자동 패스) |
| **프롬프트 관리** | 별도 .md 파일 (implementer-prompt.md 등) | WORKER_DESCRIPTION 인라인 템플릿 |
| **병렬 실행** | 불가 ("dispatch multiple implementation subagents in parallel" = Red Flag) | 라운드 내 독립 태스크 run_in_background 병렬 |
| **태스크 적응** | 없음 (실패 시 fix 서브에이전트 디스패치) | Derived Task System (append-only, depth-1) |
| **컨텍스트 공유** | 이전 태스크 결과를 다음 에이전트에 전달 | learnings.json + issues.json + round-summaries.json |
| **커밋 전략** | 태스크당 커밋 | 라운드당 커밋 |
| **TDD** | 서브에이전트가 자연스럽게 TDD | 옵트인 (--tdd 플래그) |

### 비교 5 결론

| 항목 | 판정 | 근거 |
|------|------|------|
| **리뷰 엄격성** | subagent 우위 | 2단계 리뷰 (spec + quality) 매 태스크 vs 조건부 배치 리뷰 |
| **병렬 실행** | /execute 우위 | 라운드 내 병렬 vs 순차 전용 |
| **태스크 효율** | /execute 우위 | 태스크 그루핑 → 에이전트 수 감소 |
| **런타임 적응** | /execute 우위 | Derived Task vs 수동 fix 에이전트 |
| **지식 축적** | /execute 우위 | learnings.json + BM25 검색 vs 없음 |
| **품질 보장** | subagent 우위 | spec-reviewer가 "요구사항 충족 여부"를 별도 검증 |

**판정: 대체 가능.** subagent-driven의 "2단계 리뷰" 장점은 /execute의 verify-standard(Tier 1 시맨틱 검증 + 코드 리뷰)로 커버된다. subagent-driven이 매 태스크마다 리뷰하는 반면 /execute는 라운드 후 일괄 검증하지만, /execute의 Derived Task System이 실패 시 자동 복구를 제공하므로 최종 품질은 동등하거나 우위.

---

## 비교 6: verification-before-completion vs /ralph

### 역할 요약

| | verification-before-completion | /ralph |
|---|---|---|
| **목적** | "완료 주장 전 증거를 대라" | "DoD가 모두 충족될 때까지 반복하라" |
| **메커니즘** | 정신 모델 / 가드레일 (규칙) | Stop Hook 재주입 + 독립 검증 에이전트 |
| **강제력** | LLM의 자기 규율에 의존 | 시스템 수준 차단 (Hook이 세션 종료 차단) |

### 상세 차이

| 관점 | verification-before-completion | /ralph |
|------|-------------------------------|--------|
| **본질** | **규칙/원칙** ("증거 없이 완료 주장 금지") | **메커니즘** (DoD 체크리스트 + Stop Hook 루프) |
| **검증 방식** | 명령 실행 → 출력 확인 → 주장 | DoD 항목별 독립 에이전트(ralph-verifier) 검증 |
| **강제력** | 프롬프트 지시 (위반 가능) | Hook 차단 (시스템 수준, 우회 불가) |
| **반복** | 없음 (1회 검증 후 주장) | 최대 10회 반복 (circuit breaker) |
| **자기 검증 편향** | 본인이 검증 (편향 가능) | 별도 에이전트가 검증 (컨텍스트 격리) |
| **DoD 정의** | 없음 (상황별 판단) | 사용자가 확인한 3-7개 이진 기준 |
| **적용 범위** | 모든 완료 주장 (범용) | 특정 태스크 루프 (명시적 호출) |
| **상태 관리** | 없음 | state.json + ralph-dod.md |
| **execute 연동** | 없음 (독립 스킬) | verify-ralph 모드로 /execute에 통합 |

### 핵심 차이: 규칙 vs 메커니즘

**verification-before-completion**은 "거짓말하지 마라"는 **행동 규칙**이다:
```
❌ "테스트가 통과할 거예요" (증거 없음)
✅ npm test → 34/34 pass → "테스트 통과" (증거 있음)
```

**/ralph**는 "통과할 때까지 나가지 못한다"는 **시스템 메커니즘**이다:
```
작업 완료 → 세션 종료 시도 → Stop Hook 발동 →
ralph-verifier가 DoD 확인 → 미충족 항목 발견 →
원래 프롬프트 재주입 → 수정 → 다시 종료 시도 → ...반복
```

### 비교 6 결론

| 항목 | 판정 | 근거 |
|------|------|------|
| **강제력** | /ralph 압도적 우위 | 시스템 차단 vs 프롬프트 규율 |
| **자기 검증 편향 방지** | /ralph 우위 | 별도 에이전트 vs 본인 검증 |
| **범용성** | verification 우위 | 모든 상황 vs 명시적 호출 필요 |
| **경량성** | verification 우위 | 규칙 1개 vs DoD + Hook + 에이전트 + 상태 |
| **execute 통합** | /ralph 우위 | verify-ralph 모드로 내장 vs 별도 스킬 |

**판정: 상호 보완적이나, /ralph가 상위 호환.**

- verification-before-completion의 "증거 없이 완료 주장 금지" 원칙은 **글로벌 CLAUDE.md에 규칙으로 유지** (모든 상황에 적용)
- /ralph는 **고품질이 필요한 태스크에 선택적 적용** (verify depth = ralph)
- verification-before-completion 스킬 자체는 제거 가능 — 핵심 원칙은 CLAUDE.md 규칙으로 내재화

---

## 비교 7: dispatching-parallel-agents vs /execute (Team mode)

### 역할 요약

| | dispatching-parallel-agents | /execute Team mode |
|---|---|---|
| **목적** | 독립 문제를 병렬 에이전트로 분산 | TeamCreate 영속 워커로 태스크 분배 |
| **에이전트 수명** | 1회성 (Task 호출 → 결과 → 종료) | 영속 (TeamCreate → claim → 완료 → 대기) |
| **상태 공유** | 없음 (각자 독립) | learnings.json + issues.json 공유 |

### 상세 차이

| 관점 | dispatching-parallel-agents | /execute Team |
|------|----------------------------|---------------|
| **에이전트 생성** | Task() 호출 (1회성) | TeamCreate (영속 워커, claim 기반) |
| **태스크 할당** | 수동 (프롬프트에 명시) | 자동 (TaskList → 미할당 태스크 claim) |
| **워커 수** | 문제 수 = 에이전트 수 | min(ceil(parallel/2), 5) |
| **의존성 관리** | 없음 (모두 독립 전제) | TaskUpdate addBlocks (DAG 기반) |
| **통합 검증** | 사용자가 수동 (diff 충돌 확인) | verify recipe (Tier 0~3) |
| **적응** | 없음 | Derived Task System |
| **컨텍스트 공유** | 없음 | round-summaries.json + learnings.json |
| **적용 범위** | 디버깅/수정 (문제 병렬 해결) | 기능 구현 (태스크 병렬 실행) |
| **사용 조건** | 2+ 독립 문제 (관련 없는 실패) | 3+ 병렬 태스크 (spec 기반) |

### 비교 7 결론

| 항목 | 판정 | 근거 |
|------|------|------|
| **자동화** | /execute Team 우위 | claim 기반 자동 할당 vs 수동 프롬프트 |
| **의존성** | /execute Team 우위 | DAG + addBlocks vs 독립 전제 |
| **검증** | /execute Team 우위 | 4-tier verify vs 수동 통합 |
| **단순성** | dispatching 우위 | Task() 한 줄 vs TeamCreate 설정 |
| **범용성** | dispatching 우위 | 디버깅/조사에도 사용 vs 구현 전용 |

**판정: 부분 대체.**

- /execute Team mode는 "spec 기반 기능 구현의 병렬 실행"을 완전 대체
- dispatching-parallel-agents의 "독립 문제 병렬 조사" (디버깅, 탐색적 분석)는 /execute와 다른 용도
- **dispatching-parallel-agents는 유지** — /execute Team과 용도가 다름 (구현 vs 조사)

---

## 종합: 2순위 통합 결정

### 확정 사항

| # | 현재 스킬 | 판정 | hoyeon 대체 | 비고 |
|---|-----------|------|------------|------|
| 4 | executing-plans | **제거** | /execute Direct | 배치 리뷰는 verify depth로 대체 |
| 5 | subagent-driven-development | **제거** | /execute Agent | 2단계 리뷰는 verify-standard로 대체 |
| 6 | verification-before-completion | **스킬 제거, 원칙 유지** | /ralph + CLAUDE.md 규칙 | 핵심 원칙은 글로벌 규칙으로 내재화 |
| 7 | dispatching-parallel-agents | **유지** | — | /execute Team과 용도 다름 (구현 vs 조사) |

### 1순위 + 2순위 누적 결정

| 스킬 | 판정 | 대체/비고 |
|------|------|-----------|
| brainstorming | **역할 재정의** | spec.json → 마크다운 렌더러 |
| writing-plans | **제거** | /specify L3-L4 |
| development-workflow | **제거** | /ultrawork |
| orchestrate | **제거** | hoyeon 전체 체계 |
| executing-plans | **제거** | /execute Direct |
| subagent-driven-development | **제거** | /execute Agent |
| verification-before-completion | **스킬 제거, 원칙 유지** | /ralph + CLAUDE.md 규칙 |
| dispatching-parallel-agents | **유지** | 조사/디버깅 병렬화 (용도 다름) |
| finishing-a-development-branch | **유지** | hoyeon에 해당 기능 없음 |

### 다음 단계

3순위 비교 검토 진행:
- systematic-debugging vs /bugfix
- test-driven-development vs /execute --tdd
- requesting-code-review vs /tribunal
- using-git-worktrees vs /execute worktree mode
