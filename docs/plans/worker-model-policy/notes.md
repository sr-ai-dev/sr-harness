# Worker Model Policy — 검토 노트 (보류)

상태: **보류 (Deferred)** — 충분한 실험 후 도입 여부 재결정
검토일: 2026-05-05
검토 트리거: upstream `ef0ac59` (worker opus→sonnet 다운그레이드) 부분 체리픽 시 worker.md 변경 제외

## 배경

upstream develop 1.6.1 준비 commit `ef0ac59 feat(qa,execute): plumb evidence_dir through qa-verifier, tune agent models`는 다음과 같은 모델 분업을 도입함:

- 계획·검증 강화: `qa-verifier`, `taskgraph-planner`, `verify-planner` → sonnet → **opus**
- 구현 경량화: `worker` → opus → **sonnet**

sr-harness 1.6.0-sr.x 라인은 검증 측 업그레이드 3건은 채택했으나 worker 다운그레이드는 보류함. 이유: driver / cross-product 등 임베디드 작업에서 worker 추론력이 품질에 직결되므로, 일률적 다운그레이드는 위험.

대신 **task 단위 모델 정책**을 명시적·강제적으로 부여하는 방식이 sr-harness에 더 적합한지 검토했고, 그 결과를 본 노트에 기록한다.

## 검토한 정책 안

### 핵심 enabler

Claude Code Agent tool은 dispatch 시점에 frontmatter 모델을 override할 수 있음.

> "Optional model override for this agent. Takes precedence over the agent definition's model frontmatter."

→ `agents/worker.md`는 단일 정의를 유지하고, 호출 site에서 명시적으로 모델을 결정.

### 트리거 옵션 비교

| 옵션 | 트리거 소스 | 명시성 | 강제 가능? |
|---|---|---|---|
| A. `plan.json meta.sr_profile` → 정책 매핑 | specify가 채움 | ◎ | sr_profile 누락 시 validate FAIL |
| B. `plan.json tasks[].model_class` (enum) | task 단위 명시 | ◎◎ | required 필드로 강제 |
| C. requirements frontmatter override | spec 단위 | ○ | spec 보필 필요 |
| D. PreToolUse hook 검증 | 호출 시점 | ◎ | over-engineering |

**A+B 조합 권장.** blueprint이 sr_profile에서 task.model_class를 propagate, task 개별 override 가능, validate가 누락 강제 검증.

### 정책 매핑 (제안)

```
sr_profile=driver          → model_class=deep  → opus
sr_profile=cross-product   → model_class=deep  → opus
sr_profile=ros-node        → model_class=fast  → sonnet
sr_profile=generic         → model_class=fast  → sonnet
sr_profile 미정의          → validate FAIL (강제 명시)
```

### Dispatch 로직 (자연어 추론 zero)

```
worker_model = "opus" if task.model_class == "deep" else "sonnet"
Agent(subagent_type="worker", model=worker_model, ...)
```

## 영향 범위 (design-change-propagation 트리거 1)

| 레이어 | 파일 | 변경 |
|---|---|---|
| CLI 스키마 | `cli/schemas/plan.json` | `tasks[].model_class: enum["deep","fast"]` required |
| CLI 검증 | `cli/src/plan/validate.js` | enum + required 검증 |
| CLI 테스트 | `cli/tests/plan.test.mjs` | 누락 / 잘못된 enum 케이스 |
| 에이전트 | `agents/taskgraph-planner.md` | sr_profile→model_class propagation 가이드 |
| 스킬 (blueprint) | `skills/blueprint/SKILL.md` Phase 2 | task 생성 시 default model_class 채우기 |
| 스킬 (execute) | `references/agent.md`, `references/team.md` | `Agent(..., model=...)` 분기 |
| 스킬 (rulph) | `skills/rulph/SKILL.md` worker dispatch | 동일 분기 |
| 스킬 (specify) | (변경 없음) | sr_profile mandatory 강화만 |
| 문서 | `CLAUDE.md` Recent Changes, `docs/harness/13_sr-profile-reference.md` | 정책 추가 |

→ 약 **8개 파일, 1개 schema 마이그레이션**. 기존 spec_dir의 plan.json들에 model_class 누락 → strict 정책이면 reject 발생.

## 강제성 옵션

| 단계 | 정책 |
|---|---|
| **strict** | model_class 누락 시 validate FAIL → execute 진입 reject |
| medium | 누락 시 default `fast` + audit.md 경고 |
| loose | 누락 시 조용히 default `fast` |

"자연어 추론 X, 강제적" 요건에는 **strict**가 일관됨. 다만 기존 spec_dir 마이그레이션 비용 발생.

## 트레이드오프

장점:
- worker dispatch 비용 절감 (단순 task는 sonnet)
- driver / cross-product에서 opus 보장
- 정책이 plan.json에 박혀 git에서 추적 가능 (audit)
- worker.md 파일 단일 유지 (DRY)

단점:
- schema 마이그레이션 (기존 spec_dir 영향)
- propagation 체인 4단계 (specify → blueprint → plan.json → execute)
- model_class가 cross-cutting concern으로 남음 (다른 에이전트로 확대 가능성 vs 단일 책임)

## 결론 — 보류

본 검토 시점에서는 다음 이유로 도입을 미룸:

1. 비용/속도 압박이 명시된 단계 아님
2. driver / cross-product 코드 품질 위험을 sonnet으로도 안정적으로 처리할 수 있는지에 대한 **실증 데이터 부재**
3. schema 마이그레이션은 design-change-propagation 트리거 1 — 일정 비용 큼
4. gate=2 페어 리뷰(code-reviewer + spec-coverage)가 sonnet worker 출력의 결함을 충분히 잡아낼 수 있는지 측정 필요

## 다음 단계 (실험 설계)

도입 여부 재결정을 위해 다음 데이터 수집:

1. **worker dispatch 통계**: `audit.md` WORKER_SPAWN/WORKER_RESULT 로그 누적 — task 유형별(sr_profile별) opus vs sonnet 분포 가설 검증
2. **gate=2 FAIL 비율**: sonnet worker 출력의 페어 리뷰 통과율을 실제 spec에서 측정 (A/B로 일부 task에 model override)
3. **fix-loop 소진율**: model_class=fast 적용 시 1회 fix-loop 안에서 PASS로 회복되는 비율
4. **비용 시뮬레이션**: 월간 worker dispatch 횟수 × 평균 토큰 × 모델별 단가

이 데이터가 모이면 본 노트를 갱신하고 도입/유지 결정.

## 변경 이력

- 2026-05-05: 검토 노트 최초 작성 (보류 결정)
