# /specify 재설계 — Living Spec System

> 작성일: 2026-05-04 (최초) / 2026-05-04 (sr.7 구현 반영)
> 대상: `skills/specify/SKILL.md` (v1.6.0-sr.7 배포)
> 목적: 현행 specify 흐름의 병목/UX 문제를 정리하고, **점진적·진화형 요구사항 관리(Living Spec)** 로의 재설계 방향을 제시
> 관련 문서:
> - [`12_specify-pipeline-review.md`](./12_specify-pipeline-review.md) — 기존 보강 이력
> - [`13_sr-profile-reference.md`](./13_sr-profile-reference.md) — SR Profile 참고
> - [`14_skills-improvement-rollup.md`](./14_skills-improvement-rollup.md) — 27개 스킬 개선 매핑

---

## 0. 한 줄 요약

> `/specify`를 **단발 인터뷰 산출물**에서 **프로젝트 라이프사이클 동안 자라는 Living Spec**으로 전환하고,
> 인터뷰는 "Recall(고민)" → "Recognition + Verification(확인)" 패러다임으로 바꾼다.

---

## 0.5 sr.7 구현 현황 (M-Lite — 실제 배포된 상태)

> **이 섹션은 §1 이하의 "vision"과 분리되어 실제로 v1.6.0-sr.7에서 동작하는 것만 정리합니다.**
> 본 문서 §5의 명령 체계 (`/specify init/expand/reflect/...`)는 **미구현**이며 M1+에서 도입됩니다.
> Smart Router 효율성의 일반 원리는 [`16_state-management-pattern.md`](./16_state-management-pattern.md) (Cold Scan vs Warm State Lookup) 참고.

### 0.5.1 호출 형태 — 명령은 `/specify` 하나뿐

sr.7에는 `/specify init`, `/specify expand`, `/specify reflect` 같은 sub-command가 존재하지 않습니다. **명령은 `/specify` 하나**이고, 동작은 플래그 + 상태 기반 라우팅으로 결정됩니다.

```
/specify [--quick] [--strict] [-context @<file>...] ["<goal>"]
```

### 0.5.2 항상 적용되는 변경 (always-on)

플래그 없이 `/specify`를 호출해도 **이전 sr.6과 동일하게 동작하지 않습니다**. 다음 두 가지가 default 동작이 되었습니다:

| 변경 | 동작 |
|---|---|
| **Default-First Question Pattern** | Phase 1의 모든 질문이 "What X?" (Recall) 대신 "Confirm tentative <X> or override?" (Recognition + Verification) 형태. 사용자는 **Confirm / Modify / Skip / Other** 4-way 선택. tentative 추정 답의 출처를 `[from <file>:<lines>]` 형태로 표기. 우선순위: context-bundle → research → KB → WHERE → engineering default. |
| **Gap-auditor 단일 호출 default** | 축당 1회만 audit 실행. CONTINUE 시 자동으로 AMBIGUOUS 항목을 `## Open Items`로 승격하고 축을 sufficient로 처리. legacy multi-loop 회로차단기는 `--strict` opt-in으로 격하. |
| **Bare 호출 Smart Router** | `/specify` (인자 없음)는 spec_dir 상태에 따라 init / resume / status로 자동 라우팅. 별도 sub-command 없음. |

### 0.5.3 Opt-in 플래그

| 플래그 | 효과 | 미사용 시 |
|---|---|---|
| `--quick` | Phase 1 노드당 max **2 질문** cap, inline drill 비활성, gap-auditor 단일 호출 (이미 default), final audit skip. | `depth_calibration` 그대로 (deep 노드는 4+ 질문). |
| `--strict` | gap-auditor multi-loop 복원 (축당 max 5회 + 사용자 회로차단기). | 단일 호출 (default). |
| `-context @<file>` | 사전 문서를 읽어 `<spec_dir>/context-bundle.md`로 stash. Mirror + Phase 1 default 답변 소스로 사용. qa-log frontmatter에 `source: from-context-doc` + `lineage: <file>:<line-range>` 기록. | 추출 단계 skip. |
| `-context conversation` | 현재 대화 히스토리를 컨텍스트 소스로 추가 (opt-in). | 자동 사용 안 함. |

`--quick` + `-context`는 **결합 가능** — 가장 빠른 경로 (1-2분, batch confirm 위주).

### 0.5.4 호출 패턴 동작 매트릭스

| 호출 | 질문 깊이 | 질문 형식 | gap-audit | inline drill | final audit |
|---|---|---|---|---|---|
| sr.6 이전 (참고) | depth_calibration 그대로 | Recall ("What X?") | 축당 max 5회 루프 | 활성 | 실행 |
| sr.7 `/specify "<goal>"` | depth_calibration 그대로 | **Default-First** | **단일 호출** | 활성 | 실행 |
| sr.7 `/specify --quick "<goal>"` | **노드당 max 2** | Default-First | 단일 호출 | **비활성** | **skip** |
| sr.7 `/specify --strict "<goal>"` | depth_calibration 그대로 | Default-First | **5회 루프 (legacy)** | 활성 | 실행 |
| sr.7 `/specify -context @file "<goal>"` | depth_calibration 그대로, 추출된 노드 skip | Default-First (context를 1순위로) | 단일 호출 | 활성 | 실행 |
| sr.7 `/specify` (bare) | — | Smart Router → init/resume/status 자동 분기 | — | — | — |

### 0.5.5 vision 섹션과의 매핑

| §1+에서 제안된 항목 | sr.7 구현 상태 |
|---|---|
| 명령 체계 (`init`/`expand`/`reflect`/`status`/`diff`/`decisions`/`lock`) | **미구현**. `/specify` 단일 명령 + 플래그/Smart Router로 대체. |
| spec.json SSoT | **미구현**. 기존 다파일 모델(`requirements.md`+`qa-log.md`+`reqs-*.md`+`cross-check.md`) 그대로. |
| spec_inbox.json + 적재 hook | **미구현**. `/blueprint`, `/execute`, `/qa`는 spec에 backfill하지 않음. |
| Uncertainty 메타데이터 (confidence/source/lineage/locked) | **부분 구현**. qa-log frontmatter에 `source` + `lineage`만 기록 (context-doc 출처 추적용). spec.json이 없어 요구사항 단위로는 미반영. |
| Default-First Interview Engine | **구현 완료** (always-on). |
| Pipeline-wide Issue Pool | **미구현** (spec_inbox 의존). |
| Dynamic Depth (priority score) | **미구현**. 기존 depth_calibration + `--quick` cap. |
| Active Axis 동적 선택 | **미구현**. WHERE 기반 calibration은 그대로 (모든 축 활성). |
| Knowledge System 깊은 통합 | **부분**. 기존 KB-first lookup(Phase 0.5)은 그대로 동작. Default-First가 KB를 1순위 default 소스로 사용. |
| Smart Router | **구현 완료** (lite — 라우팅만, 추천 출력은 SKILL.md 가이드라인 수준). |
| Context-First Ingestion | **lite 구현**. `-context` 플래그로 문서 ingest, 정식 Phase 0.0 추출 agent는 미구현. |
| Spec Health Dashboard | **미구현** (`/specify status`가 별도 명령으로 없음). |
| SpecQuery API | **미구현**. |
| Compaction-safe state machine | **부분**. 기존 hook 시스템 그대로. |

### 0.5.6 사용자 가이드 — 어떻게 써야 하나

| 의도 | 호출 |
|---|---|
| 새 spec 시작 (정성) | `/specify "<goal>"` |
| 새 spec 빠르게 (skeleton 수준) | `/specify --quick "<goal>"` |
| 사전 문서가 있음 | `/specify -context @docs/idea.md "<goal>"` |
| 사전 문서 + 빠르게 | `/specify --quick -context @docs/idea.md "<goal>"` |
| 이전 sr.6 동작 복원 (multi-loop만) | `/specify --strict "<goal>"` |
| 진행 중인 spec 이어가기 / 상태 보기 | `/specify` (bare — Smart Router) |

`init`이라는 명시적 명령은 **사용하지 않습니다**. bare `/specify` 또는 plain `/specify "<goal>"`이 init 역할을 모두 수행합니다.

---

## 1. 배경 — 사용자 피드백

현행 `/specify`는 다음 문제를 갖는다.

1. **시간/토큰 과소비** — 인터뷰가 30~60분, 토큰 80~150K 추정.
2. **비현실적 질문 깊이** — Business / Interaction / Tech 3축에 대해 **처음부터 세밀하게** 묻는다.
3. **Recall 강요** — 사용자가 한 번도 생각 안 해본 영역도 즉답을 강요. "조사하고 공부해야 답할 수 있는" 질문 다수.
4. **단일-shot 모델 부적합** — 실제로 요구사항은 설계/구현/테스트 진행 중 **점진적으로** 또렷해진다. 처음부터 모두 짜내는 것은 비현실적.

핵심 인사이트:

> **요구사항은 인터뷰의 산출물이 아니라, 라이프사이클 동안 자라는 자산이다.**

---

## 2. 현행 specify 세부 흐름

```
Phase 0: WHERE Grounding
  Step 0.1   Mirror + SR Context Detection → AskUserQuestion (승인/수정, 최대 2회)
  Step 0.2   3-question batch (project_type / situation / ambition)
  Step 0.2b  4-option multiSelect (risk modifiers)
  Step 0.3   spec_dir 설정, 템플릿 pre-flight, CLI init, qa-log 초기화
             → resume mismatch 시 추가 AskUserQuestion
  Step 0.4   Depth calibration 산출 (SITUATION × AMBITION × RISK × SR Profile)

Phase 0.5: Context Research (brownfield only)
  캐시 확인 → AskUserQuestion (re-use/re-scan)
  KB stale 모듈마다 AskUserQuestion
  code-explorer × 2-3 + docs-researcher 병렬 dispatch
  결과 → qa-log.md ## Research

Phase 1: Interview            ← 가장 긴 단계
  Axis 1 Business     AskUserQuestion × N + Inline Drill + gap-auditor
  Axis 2 Interaction  AskUserQuestion × N + Inline Drill + gap-auditor
  Axis 3 Tech         AskUserQuestion × N + Inline Drill + gap-auditor
  Final audit         gap-auditor 1회 추가
  Phase 2 gate        AskUserQuestion 1회

Phase 2: Extraction           ← 두 번째로 긴 단계
  business / interaction / tech extractor 3개 병렬
  reqs-*.md + cross-check.md (Dedup Log)

Phase 3: Cross-Check
  3개 reqs 파일 → CONFLICT / GAP / DUPLICATE
  cross-check.md ## Cross-Check Report

Phase 4: Confirmation
  Step 4.1  요약 (cross-check + reqs-*.md + qa-log)
  Step 4.2  CC-N마다 AskUserQuestion (accept/reject/modify/defer)
  Step 4.3  Preview + AskUserQuestion (Approve/Edit/Re-interview)
  Step 4.4  requirements.md + performance.md 작성
  Step 4.5  KB Save (sr_modules 있을 때만)
```

---

## 3. 병목 / 시간·토큰 소비 요소

| 순위 | 병목 | 원인 | 영향 |
|---|---|---|---|
| 1 | **gap-auditor 반복 호출** | CONTINUE 루프 + qa-log.md 전체를 매 호출 전송 | axis당 최대 5회 × 3 + final 5회 = **최대 20회 subagent 호출** |
| 2 | **Phase 1 인터뷰 길이** | depth=`deep`이면 노드당 4+ 질문 × 18+ 노드 | **최대 72+ 개별 질문** |
| 3 | **Phase 2 extractor** | qa-log.md 전체를 3개 agent에게 각각 전달 | 동일 데이터 4회 이상 전송 (3 ext + final audit) |
| 4 | **Phase 0.5 research** | code-explorer 탐색 범위가 넓을 때 토큰 폭발 | 대형 codebase에서 심각 |
| 5 | **Phase 4 CC 해결** | CC-N 수에 비례하는 직렬 AskUserQuestion | CC가 많으면 끝없는 confirm |

추가 구조 문제:
- qa-log.md는 Phase 1 동안 단조 증가 → 후반 호출일수록 토큰 부담 폭증.
- "I don't know" 처리가 **late fallback**이라 이미 사용자가 고민·피로해진 후에야 발동.
- Phase 4까지 가야 의사결정 누락이 표면화.

---

## 4. 개선 철학

### 4.1 패러다임 전환

| 축 | 현재 | 개선 |
|---|---|---|
| 시간성 | 단발성 인터뷰 | 라이프사이클 동안 진화 |
| 데이터 | 다파일 분산 | spec.json SSoT |
| 불확실성 | "Open Items"에 묻음 | 1급 메타데이터 |
| 질문 방식 | Recall (사용자 고민) | Recognition + Verification |
| 축 적용 | 3축 강제 | WHERE 기반 동적 |
| 깊이 | 사전 calibration | JIT priority score |
| 다른 skill과 관계 | 일방향 produce | 양방향 (read + flag) |
| KB | 참고용 | default 풀 + 누적 학습 |
| UX | 텍스트 인터뷰 | dashboard + diff + multi-modal |

### 4.2 핵심 원칙

1. **Skeleton-First** — v0은 5~10분 골격. 나머지는 후속 단계에서.
2. **Default-First** — 인터뷰어가 추정 답을 먼저 제시, 사용자는 확인/수정.
3. **Living Spec** — `/blueprint`, `/execute`, `/qa`가 발견한 것을 spec에 backfill.
4. **Uncertainty = 1급 시민** — 모르는 영역은 묻어두는 게 아니라 명시적으로 표시.
5. **Question Budget** — 단계별 질문 상한선. priority score 상위만 묻는다.
6. **Knowledge 누적** — 비슷한 spec을 두 번째 만들 때는 confirm 위주.

---

## 5. 프로덕트급 재설계 — Living Spec System

### 5.1 명령 체계

| 명령 | 시점 | 목적 | 인터뷰 규모 |
|---|---|---|---|
| `/specify init` | 프로젝트 시작 | v0 골격 | 8~12 질문 / 5~10분 |
| `/specify expand <axis>` | 필요 시 | 특정 축 심화 | 5 질문 / 5분 |
| `/specify reflect --from blueprint\|execute\|qa` | 후속 단계 후 | inbox batch 흡수 | 3~7 질문 / 3~5분 |
| `/specify diff <v_a> <v_b>` | 검토 | 버전 간 변경점 | — |
| `/specify status` | 언제든 | spec 건강 지표 | — |
| `/specify decisions` | 언제든 | Open Decisions 대시보드 | — |
| `/specify lock <R-id>` | 확정 시 | 특정 요구사항 잠금 | — |

기존 `/specify` (단발 호출)는 **`init` + 자동 `expand` + `reflect` 대기 상태**로 deprecated.

#### 5.1.1 바(bare) `/specify` — Smart Router

**개별 호출 강요는 안 한다.** 인자 없이 `/specify`를 부르면 현재 상태 기반으로 자동 라우팅 + 추천한다.

| spec_dir 상태 | inbox 상태 | 자동 동작 |
|---|---|---|
| 없음 / 비어 있음 | — | `init` 모드 진입 (디렉토리/대화에서 spec_dir 후보 추론) |
| 존재 + 인터뷰 미완료 | — | **resume** (마지막 단계부터 이어서) |
| 완료 + inbox 비어있음 | empty | `status` 출력 + 추가 작업 안내 |
| 완료 + inbox 있음 | N개 | "🔔 N건 미처리 발견. reflect 진행?" → AskUserQuestion |
| 다수 spec_dir 후보 | — | "어느 spec을 다룰까요?" 선택 |

항상 다음 행동을 추천 형태로 노출:

```
$ /specify
[spec: teleop-ui (v0.2)] 진행 상태: blueprint inbox 7건 미처리

다음 행동을 제안합니다:
  1) /specify reflect --from blueprint   (권장 ⭐ — 7건 batch, 약 3-5분)
  2) /specify expand interaction         (Interaction coverage 42%)
  3) /specify status                     (전체 health 보기)
  4) /specify init                       (새 spec 시작)
```

**원칙**: 사용자는 외울 필요 없다. 시스템이 가장 가치 있는 행동을 추천하고, 명시적 호출은 자동화/숙련 사용자용.

### 5.2 데이터 모델 — `spec.json` SSoT

현행 `requirements.md` + `qa-log.md` + `reqs-*.md` + `cross-check.md` (다파일 분산) → **`spec.json` 단일 진실 원천**.

```json
{
  "spec_version": "v0.3",
  "type": "feature",
  "goal": "...",
  "non_goals": ["..."],
  "where": {
    "situation": "...",
    "ambition": "...",
    "sr_profile": "ros-node"
  },
  "requirements": [
    {
      "id": "R-T1.2",
      "axis": "tech",
      "title": "...",
      "given": "...", "when": "...", "then": "...",
      "confidence": "high|medium|low",
      "source": "user-stated | inferred-research | default-confirmed | tentative",
      "decided_at": { "stage": "specify-v0", "ts": "2026-05-04T..." },
      "locked": false,
      "lineage": ["CC-3", "blueprint-issue-12"]
    }
  ],
  "open_decisions": [],
  "uncertainty_zones": [
    { "node": "TECH.SECURITY", "reason": "user deferred", "since": "v0" }
  ],
  "history": [
    { "version": "v0",   "stage": "specify init",      "ts": "...", "diff": [] },
    { "version": "v0.1", "stage": "blueprint reflect", "ts": "...", "diff": [] }
  ]
}
```

마크다운(`requirements.md`)은 spec.json에서 자동 렌더링한 view. 직접 편집 금지.

### 5.3 Uncertainty 메타데이터

요구사항마다:

| 속성 | 의미 | 활용 |
|---|---|---|
| `confidence` | high/medium/low | low는 후속 단계 자동 검증 대상 |
| `source` | user-stated / inferred-research / default-confirmed / tentative | tentative는 reflect 시 우선 재방문 |
| `locked` | 사용자가 확정한 항목 | reflect도 변경 금지 |
| `lineage` | 어떤 질문/CC/issue에서 도출됐는지 | 추적성 |
| `uncertainty_zones` | 의도적으로 비워둔 영역 | 후속 단계가 채울 것 |

### 5.4 Default-First Interview Engine

```
[현재] "What X?"  → 사용자 고민 / 조사 / 즉답 강요

[개선 4-way]
1. 인터뷰어가 KB + research + WHERE로 가장 가능한 답을 추정
2. AskUserQuestion 옵션을 "추정 답 + 근거" 형태로 제시
3. 사용자는 4가지 중 선택:
   - Confirm        — 그대로 채택 (default 권장)
   - Modify         — 한 번에 수정안 입력
   - Skip           — uncertainty zone으로, 후속 단계가 결정
   - Lock different — 다른 값으로 잠금
```

질문은 **Recall → Recognition → Verification**으로 격상.

### 5.4.1 Context-First Ingestion — 사전 정보 활용 패턴

**전형적 시나리오**: 사용자는 일반 채팅 → 정리 문서 작성 → `/specify`로 진입한다. 이때 문서에 이미 답변의 70%가 있는데 처음부터 다시 묻는 것은 낭비. 이 패턴을 1급 시민으로 지원한다.

#### 입력 방식 (3-tier)

| Tier | 방식 | 예시 |
|---|---|---|
| 1. 명시 (권장) | `-context` 플래그 | `/specify init -context @docs/idea.md @notes/meeting.md` |
| 2. IDE 통합 | 현재 열린/선택 파일 자동 감지 | IDE에서 `idea.md` 열고 `/specify init` |
| 3. 자동 감지 | `.sr-harness/context/` 디렉토리 + 최근 대화 | "현재 채팅에 컨텍스트가 충분합니다. 활용?" |

여러 소스 결합 허용:

```
/specify init -context @docs/idea.md @docs/constraints.md -context conversation
```

#### Phase 0.0: Context Ingestion (신설)

기존 Phase 0 앞에 새 단계 삽입:

```
Phase 0.0: Context Ingestion
  Step 0.0.1  Context 수집
              - 명시 파일 + IDE selection + 대화 히스토리 통합
              - 토큰 한도 체크 (>50K이면 요약 agent 거침)

  Step 0.0.2  사전 추출 (Pre-Fill Agent — 단일 호출)
              - 추출 대상:
                · goal, non_goals, type, situation, ambition
                · WHO/WHY/WHAT/SUCCESS/SCOPE/RISK (Business)
                · JOURNEY/HAPPY/EDGE/ACCESS (Interaction)
                · ARCH/DATA/INFRA/DEPEND/COMPAT/SECURITY (Tech)
                · sr_product / sr_modules / sr_profile (SR-Harness)
              - 각 항목에 confidence + source(file:line) 부여

  Step 0.0.3  Coverage 리포트
              "문서에서 다음 항목들을 추출했습니다:"
              ┌─────────────────┬────────┬──────────┬─────────────────┐
              │ 항목            │ 신뢰도 │ 출처     │ 추출값          │
              ├─────────────────┼────────┼──────────┼─────────────────┤
              │ goal            │ high   │ idea:5   │ "원격 텔레옵..."│
              │ non_goals (3개) │ high   │ idea:12  │ ...             │
              │ project_type    │ high   │ idea:1   │ user-facing     │
              │ situation       │ medium │ 추론     │ greenfield (?)  │
              │ ROS version     │ high   │ idea:34  │ ros2            │
              │ auth method     │ low    │ 추측     │ SSO?            │
              └─────────────────┴────────┴──────────┴─────────────────┘
              감지된 빈 영역: SUCCESS metrics, INTERACTION.STATE, TECH.SECURITY

  Step 0.0.4  Batch Confirm
              AskUserQuestion (multiSelect):
              "다음 high-confidence 추출값을 그대로 사용?"
              [✓] goal: ...
              [✓] non_goals: ...
              [✓] project_type: user-facing
              [ ] situation: greenfield (medium — 직접 확인 권장)
              → 체크된 것은 spec.json에 즉시 확정 (source: from-context-doc + lineage)
              → 미체크 항목은 정상 인터뷰로 폴백
```

#### Phase 1 인터뷰 변경

Pre-Fill 완료 후:

1. **이미 답해진 노드 스킵** — gap-auditor도 "context-doc에서 확정"으로 인지
2. **빈 영역만 인터뷰** — Question Budget 자동 축소 (8~12 → 3~5 질문)
3. **출처 명시** — "[docs/idea.md:42-58]에 명시된 SSO를 그대로 쓸까요?" 식으로 default-first 강화

#### spec.json 확장

```json
{
  "requirements": [
    {
      "id": "R-B1.1",
      "source": "from-context-doc",          // 새 값
      "lineage": ["docs/idea.md:12-18"],     // 파일/라인 추적
      "confidence": "high"
    }
  ],
  "context_sources": [                       // 새 섹션
    {
      "path": "docs/idea.md",
      "ingested_at": "2026-05-04T...",
      "extracted_count": 14,
      "confirmed_count": 12
    }
  ]
}
```

이러면 나중에 "이 요구사항이 어디서 왔지?" 추적 가능.

#### 효과 추정

| 시나리오 | 인터뷰 시간 (현행) | Context-First |
|---|---|---|
| 문서 0개 | 30~60분 | 5~10분 (init 자체 개선 효과) |
| 문서 1개 (간략 5KB) | 30~60분 | **2~4분** (3~5 질문) |
| 문서 2-3개 (충실 20KB) | 30~60분 | **1~2분** (batch confirm 위주) |

문서가 충실하면 거의 batch confirm UI로 끝난다.

#### 위험 / 완화책

| 위험 | 완화책 |
|---|---|
| 추출 agent 오해석 | 모든 추출은 confidence + source 표시. low/medium은 정상 인터뷰 폴백 |
| 문서 토큰 폭증 | 50K 초과 시 요약 agent 선행, 원본은 lineage 참조용으로 보관 |
| 다중 문서 충돌 | 추출 단계에서 conflict 감지 → "doc-A: SSO, doc-B: OAuth — 어느 쪽?" 1회 묻기 |
| 채팅 노이즈 | `-context conversation`은 명시 시에만 활성. 자동은 안 함 |
| 컨텍스트 stale | `context_sources[].ingested_at` vs 문서 mtime, 최근이면 "재수집할까요?" |

### 5.5 Pipeline-wide Issue Pool — 자동 spec 진화

```
.sr-harness/specs/<spec_dir>/
  spec.json                 ← SSoT
  spec_inbox.json           ← 새로 도입: 후속 단계가 적재하는 발견들
  history/                  ← spec.json 스냅샷 v0, v0.1, ...
  rendered/
    requirements.md
    decisions.md
    performance.md
```

**spec_inbox.json**에 적재되는 항목 예시:

| 출처 | 형태 |
|---|---|
| `/blueprint` 실행 중 | "R-T2가 contract 도출 시 모호: API rate limit 명세 부재" |
| `/execute` worker | "lift 모듈 구현 중 발견: E-Stop propagation 정책 미정" |
| `/qa` 실패 | "R-U1.3 통과 조건이 OS별로 달라야 함 — spec 미반영" |

`/specify reflect --from <stage>`는 inbox에서 batch로 끌어내 짧은 인터뷰로 흡수.

### 5.6 Dynamic Depth — Just-in-Time Priority

Phase 0 depth_calibration **폐지**. 대신:

```
Question Priority Score = (impact × ambiguity × downstream_blockage) / answer_effort

  impact              : 잘못 결정 시 수정 비용
  ambiguity           : 현재 spec에서 추론 불가 정도
  downstream_blockage : blueprint/execute가 막히는지
  answer_effort       : 사용자가 답하기 어려운 정도 (모르는 것은 점수 ↓)
```

**Question Budget**:
- `init`: 8~12 질문
- `expand`: 5 질문
- `reflect`: 3~7 질문 (inbox 크기에 비례)

상위 priority만 묻고, 나머지는 자동으로 uncertainty zone.

### 5.7 Active Axis 동적 선택

3축 강제 폐지. WHERE 조합으로 자동 결정:

| WHERE 조합 | 활성 축 (init) | expand 권장 시점 |
|---|---|---|
| toy + dev-tool | Business 1축 | 사용자 추가 안 하면 끝 |
| feature + greenfield | Business + Tech | execute 진행 중 Interaction expand |
| product + external-exposure | 3축 + Security drill | blueprint 후 모두 expand |
| brownfield-refactor | Tech 중심 | qa 후 Business reflect |
| sr_profile=driver | Tech + HW boundary | execute 후 SAFETY reflect |

사용자가 `/specify expand <axis>`로 명시적 호출 가능.

### 5.8 Knowledge System 깊은 통합

현행 KB는 "참고 자료" 수준. 개선:

| 단계 | KB 활용 |
|---|---|
| `init` 시작 | KB에서 유사 spec/모듈 검색 → default 답변 풀 |
| 인터뷰 중 | "이전 spec의 X 결정과 충돌" 자동 경고 |
| `reflect` 후 | 새 결정을 KB에 누적 — 다음 spec의 default 향상 |
| `lock` 시 | KB에 "검증된 패턴"으로 승격 |

**효과**: 비슷한 프로젝트 두 번째 만들 때 인터뷰가 거의 사라진다 (대부분 confirm).

### 5.9 Spec Health Dashboard

`/specify status` 출력 예시:

```
┌─ spec: teleop-ui (v0.3) ────────────────────────┐
│ Coverage:                                        │
│   Business    ████████░░  78%  (9/12 nodes)     │
│   Interaction ████░░░░░░  42%  (5/12)           │
│   Tech        ██████████ 100%  (locked)         │
│                                                  │
│ Confidence:                                      │
│   high   24 reqs    medium 8    low 3           │
│                                                  │
│ Decision Debt: 5 open                            │
│   - OD-3: WebSocket vs SSE (blocking)           │
│   - OD-4: a11y level (deferred)                 │
│                                                  │
│ Staleness:                                       │
│   Last reflect: 2 days ago (from execute)        │
│   spec_inbox: 7 unprocessed items ⚠            │
│                                                  │
│ Recommended action: /specify reflect --from execute │
└──────────────────────────────────────────────────┘
```

### 5.10 Cross-Skill Protocol — SpecQuery API

worker/agent가 막히면 spec에 직접 질문할 수 있는 API:

```
SpecQuery.read("R-T1.2")              # 요구사항 조회
SpecQuery.flag_ambiguity("R-T1.2", "rate limit not defined")
SpecQuery.suggest_addition({...})     # 새 요구사항 후보 제안
SpecQuery.lock("R-T1.2")              # 확정
```

worker가 사용자 개입 없이 spec_inbox에 자동 적재 → 이후 `/specify reflect`에서 batch 처리.

### 5.11 다양화된 인터뷰 모드

| 유형 | UI |
|---|---|
| 단일 선택 | AskUserQuestion (기존) |
| 우선순위 정렬 | 마크다운 리스트 + 사용자 재정렬 |
| 복잡한 사양 | spec.json fragment를 IDE 에디터로 편집 |
| 일괄 confirm | "다음 12개 추정 답변 모두 확인" batch |
| 시각적 결정 | mermaid / ASCII 표 + yes/modify |

### 5.12 Compaction-safe & Resumable

- spec.json + spec_inbox.json은 매 작업 후 atomic write
- session state 분리: `<spec_dir>/.session/<sid>.json`
- 어디서 끊겨도 `/specify resume`이 정확한 다음 단계로 복귀
- spec_dir 단위로 묶여 worktree 이동에도 안전

---

## 6. 새 워크플로우 예시

### 6.1 Greenfield — 컨텍스트 문서 없이 시작

```
사용자: /specify init "robot teleop UI"
  ↓ 5분, 6-8 질문, 골격 v0
  ↓ spec.json (must-haves 3개 + non-goals + uncertainty_zones 표시)

사용자: /blueprint .sr-harness/specs/teleop-ui/
  ↓ 설계 중 "권한 모델 미정", "rate limit 미정" 등을 spec_inbox.json에 자동 적재

사용자: /specify reflect --from blueprint
  ↓ inbox 5개 batch 검토, 3~5분 → spec.json v0.1로 승격

사용자: /execute ...
  ↓ worker가 모호함 만남 → SpecQuery.flag_ambiguity → spec_inbox 적재

사용자: /specify reflect --from execute
  ↓ ... v0.2

사용자: /qa ...
  ↓ 실패에서 도출된 새 requirement → spec_inbox

사용자: /specify reflect --from qa
  ↓ ... v0.3 → 사용자가 /specify lock R-T1.2 등으로 확정
```

### 6.2 Context-First — 사전 정리 문서로 시작 (권장 패턴)

```
사용자: (사전에 일반 채팅으로 아이디어 정리 → docs/idea.md 작성)
        (IDE에서 docs/idea.md 열어둔 상태)
        /specify init

시스템: 컨텍스트 후보를 감지했습니다:
        - docs/idea.md (현재 열린 파일, 8KB)
        - 최근 대화 (직전 50턴, ~12K tokens)
        포함할까요?
        [✓] docs/idea.md
        [ ] 최근 대화

사용자: docs/idea.md만 체크

시스템: (3-5초) 문서에서 14개 항목 추출 완료.
        ── Coverage 리포트 ──
        high  : goal, non_goals(3), project_type, ROS version, ...
        medium: situation (추론), ambition (추론)
        low   : auth method (추측)
        빈 영역: SUCCESS metrics, INTERACTION.STATE, TECH.SECURITY

        다음 12개 high-confidence 추출값을 그대로 사용?
        [batch confirm UI]

사용자: 확인 (12개 모두 ✓)

시스템: ✓ Pre-fill 완료. 남은 빈 영역에 대해 4개 질문만 드립니다.
        Q1. SUCCESS metrics: 어떤 신호로 성공을 판단? ...
        ...

(약 2분 후)

시스템: spec.json v0 작성 완료.
        - 12개: docs/idea.md 출처 (lineage 포함)
        - 4개: 인터뷰 출처
        - 3개: uncertainty zone (TECH.SECURITY 등)
        다음 단계: /blueprint .sr-harness/specs/teleop-ui/

사용자: /blueprint ...
  ↓ (이후는 6.1과 동일한 진화 사이클)
```

### 6.3 바(bare) `/specify` — 라우팅 자동화

```
사용자: /specify
시스템: [spec: teleop-ui (v0.2)] 진행 상태: blueprint inbox 7건 미처리
        다음 행동을 제안합니다:
          1) /specify reflect --from blueprint   (권장 ⭐ — 약 3-5분)
          2) /specify expand interaction         (coverage 42%)
          3) /specify status
          4) /specify init                       (새 spec 시작)

사용자: 1
시스템: → reflect 진행
```

---

## 7. 마이그레이션 플랜

| 단계 | 변경 | 호환성 | 기간 |
|---|---|---|---|
| **M1** | spec.json + 렌더러 도입, 기존 specify 그대로 | 기존 spec_dir 그대로 동작 | 1주 |
| **M2** | `/specify init` 승격 (--quick) + spec_inbox.json 골격 | 신규 spec만 신구조 | 1주 |
| **M3** | `/specify reflect` + blueprint/execute에 inbox 적재 hook | 부분 활성 | 2주 |
| **M4** | Default-First 인터뷰 엔진, KB 통합 | 인터뷰 UX 변경 | 1주 |
| **M5** | Dashboard, diff, decisions UI | 신규 명령 추가 | 1주 |
| **M6** | 기존 specify deprecate, 마이그레이션 가이드 | 완전 전환 | 1주 |

총 6~7주, **점진적 출시** 가능 (M2까지만으로도 즉시 효과).

---

## 8. KPI / 성공 지표

| 지표 | 현재 추정 | 목표 |
|---|---:|---:|
| init 평균 시간 | 30~60분 | **5~10분** |
| init 평균 토큰 | 80~150K | **20~40K** |
| 사용자 "I don't know" 비율 | ~20% | **<5%** |
| spec → 첫 blueprint 도달까지 | 30~60분 | **10분** |
| reflect 1회 평균 | (없음) | **3~5분, 5~10 질문** |
| spec 재사용률 (KB hit) | <10% | **>50%** |
| compaction 후 resume 성공률 | 부분적 | **>95%** |

---

## 9. 트레이드오프 / 위험

| 위험 | 완화책 |
|---|---|
| spec.json 스키마 진화 비용 | 버전 필드 + migration 스크립트, M1에 schema validator 포함 |
| 다른 skill 변경 부담 (blueprint/execute) | SpecQuery API를 thin shim으로 도입, 기존 인터페이스 유지 |
| 사용자가 reflect를 안 부르면 spec 정체 | dashboard staleness 경고 + 다른 명령에서 "reflect 먼저" 제안 |
| Default-First가 잘못된 default 강요 | "Skip" 옵션 항상 노출, lock되지 않은 default는 다음 reflect에서 재검토 |
| 명령 증가 (학습 비용) | 인자 없는 `/specify` 호출이 자동으로 적절한 서브명령 제안 |
| v0 spec의 부정확성 | BDUF 결과물도 어차피 부정확 — 진화 메커니즘이 보완 |

---

## 10. 즉시 시도 가능한 최소 변경 (큰 수술 전 단계)

큰 재설계 전에 작은 효과를 보고 싶다면 다음 3개만 적용:

1. **`--quick` 플래그 추가** — Phase 1을 axis별 1~2 질문으로 강제 cap
2. **Default-First 패턴 적용** — Phase 1 인터뷰어 프롬프트에 "answer first, then confirm" 가이드 추가
3. **gap-auditor 루프 → 단일 호출** — CONTINUE 시 자동 Open Items promote (현재 5회 한도 → 1회 한도)

위 3개만으로도 인터뷰 시간이 절반 이하로 감소할 것으로 추정.

---

## 11. 다음 액션

이 문서는 **방향 제안**이다. 합의가 되면 다음 중 하나로 들어간다:

- **A안**: M1+M2 PoC 먼저. spec.json 스키마와 `/specify init` skeleton 구현.
- **B안**: 즉시 효과를 위한 §10 최소 변경부터.
- **C안**: SpecQuery API 설계 우선 — blueprint/execute의 backfill 통로를 먼저 깔고 specify는 나중.

각 선택지의 트레이드오프:

| 안 | 효과 도달 시간 | 후속 작업 부담 | 위험 |
|---|---|---|---|
| A | 2~3주 | 큼 (M3~M6) | 신구조 도입 비용 |
| B | 1~2일 | 작음 | 근본 해결 안 됨 |
| C | 2주 | 중간 | spec 단계 효과 지연 |

권장: **B로 즉시 효과 + A로 본격 전환** 병행.

---

## 부록 A. 용어 정리

- **Living Spec**: 라이프사이클 동안 진화하는 spec. v0/v0.1/.../v1.0 형태로 버전 관리.
- **spec_inbox.json**: 후속 단계가 발견한 spec 후보를 적재하는 큐.
- **Uncertainty Zone**: 의도적으로 비워둔 영역. 후속 단계가 채워줄 것.
- **Question Budget**: 단계별 인터뷰 질문 상한선.
- **SpecQuery**: 다른 skill이 spec을 read/flag할 수 있는 API.
- **Default-First**: 추정 답을 먼저 제시하고 사용자가 확인/수정하는 인터뷰 방식.
- **Smart Router**: 인자 없는 `/specify` 호출 시 현재 상태 기반으로 적절한 서브명령을 자동 라우팅/추천하는 로직.
- **Context-First Ingestion**: 사전 정리 문서/IDE selection/대화 히스토리를 입력받아 인터뷰 전에 답변 후보를 자동 추출하는 단계 (Phase 0.0).
- **Pre-Fill Agent**: Context-First Ingestion에서 문서 → 구조화된 spec 후보 답변으로 변환하는 단일 호출 agent.
- **context_sources**: spec.json에서 추출 출처 문서 목록을 추적하는 섹션 (path, ingested_at, extracted/confirmed count).

## 부록 B. 관련 기존 보강과의 관계

| 기존 보강 | 본 재설계와의 관계 |
|---|---|
| C-1 (Phase 3 in-memory → file) | spec_inbox.json으로 일반화 흡수 |
| C-2 (Re-interview 분기) | reflect 명령으로 명시화 |
| H-1 (gap-auditor circuit breaker) | priority score + budget으로 대체 |
| H-3 (stuck on axis 트리거) | uncertainty zone 자동 전환으로 대체 |
| M-3 (병렬 extraction dedup) | extractor 호출 자체가 줄어 자연 해소 |
| M-5 (research_done 캐시) | KB 통합으로 흡수, 더 강력해짐 |
| N-* (v1.6.0-sr.3/sr.4 보강) | 대부분 patch성 — Living Spec으로 가면 재설계 가능 |
