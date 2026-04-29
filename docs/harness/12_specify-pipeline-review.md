# /specify Pipeline Review — Problems & Improvements

> 작성일: 2026-04-28
> 기준 버전: v1.6.0-sr.1
> 구현 동기화: 2026-04-29 (`skills/specify/SKILL.md` 반영)
> 추가 보강: 2026-04-29 (v1.6.0-sr.3 — 7건 추가 적용. 본 문서 마지막 섹션 참조)
> 목적: `/specify` SKILL.md 내부 파이프라인의 잠재적 문제점과 개선 방향 정리

---

## 개요

`/specify`의 내부 파이프라인은 다음 흐름으로 구성된다:

```
Phase 0: WHERE Grounding
    ├─ Step 0.1: Mirror + SR Context Detection
    ├─ Step 0.2: PROJECT_TYPE × SITUATION × AMBITION
    ├─ Step 0.2b: Risk Modifiers
    ├─ Step 0.3: spec_dir 생성 (hoyeon-cli req init)
    └─ Step 0.4: Axis Depth Calibration (A→B→C→D)

Phase 0.5: Context Research (brownfield only)
    └─ research_done cache / KB-first lookup
       + code-explorer × 2 + docs-researcher 병렬 실행

Phase 1: Interview
    └─ 3축(BUSINESS/INTERACTION/TECH) × AskUserQuestion
       + Inline Drill + gap-auditor 감사 루프

Phase 2: Requirements Extraction
    └─ business-extractor + interaction-extractor + tech-extractor 병렬
       + deterministic dedup post-processing

Phase 3: Cross-Check (cross-check.md 기록)
    └─ CONFLICT / GAP / DUPLICATE 탐지 + immutable audit record

Phase 4: Confirmation
    ├─ Step 4.1: Cross-Check Summary 표시
    ├─ Step 4.2: 충돌/가정 AskUserQuestion 해소
    ├─ Step 4.3: Requirements Preview → 명시적 승인
    ├─ Step 4.4: requirements.md 최종 기록
    └─ Step 4.5: KB Save (SR-Harness only)
```

---

## 🔴 Critical — 파이프라인 붕괴 가능

### C-1. (해결됨) Phase 3 Cross-Check가 in-memory only

> ✅ **개선 적용됨** (SKILL.md Phase 3 / Phase 4 수정)
>
> **현재 동작:** Phase 3은 `<spec_dir>/cross-check.md`에 안정 ID(`CC-N`)와 함께 발견 결과를 기록하고, Phase 4.1은 이 파일을 읽어 Summary를 표시한다.

**구 동작:**
Phase 3의 CONFLICT/GAP/DUPLICATE 분석 결과가 디스크에 기록되지 않았다.

```
Phase 3: Cross-Check  ← 결과 어디에도 기록 안 됨
    |
    v
Phase 4: Confirmation  ← 이 결과에 의존
```

**문제:**
세션 압축(compaction)이나 중단이 Phase 3~4 사이에 발생하면 분석 결과가 소멸된다.
`session-compact-hook.sh`는 skill 이름과 state.json 경로만 복구하며, in-memory 분석은 복구 불가하다.
Phase 4 Confirmation이 아무런 충돌 정보 없이 시작되어, 사용자는 이미 식별된 문제를 놓친 채 requirements.md가 작성된다.

**적용된 개선 (역할 분리 패턴):**
```
Phase 3 완료 시 → <spec_dir>/cross-check.md 기록 (불변 감사 기록, 이후 수정 없음)
Phase 4.1 → cross-check.md 읽어 Summary 표시
Phase 4.2 해결 결과 → requirements.md에 직접 반영 (accept/reject/modify/defer)
              defer → requirements.md의 ## Open Decisions 섹션에 추가
Phase 4 중단 후 재시작 → cross-check.md + requirements.md 비교로 미해결 항목 감지
```

cross-check.md(정적 발견 기록) ↔ requirements.md(동적 해결 상태)를 분리하여
파일/상태 불일치가 구조적으로 발생하지 않도록 설계됨.

---

### C-2. (해결됨) Re-interview 분기의 미정의 동작

> ✅ **개선 적용됨** (SKILL.md Phase 4.3 수정)
>
> **현재 동작:** Phase 4.3은 `Supplement axis`(해당 축만 재실행)와 `Full re-interview`(전체 재실행 + `reqs-*.md`/`cross-check.md` 삭제) 두 경로를 명시적으로 분기한다.

**구 동작:**
```
Phase 4.3: "Re-interview" 선택
    → "return to Phase 1 with the gap identified"
    → 이후 Phase 2, 3, 4 재실행 범위: 명시 없음
```

**문제:**
- 3개 extractor 전부를 재실행하는지, 해당 축만 재실행하는지 불분명하다.
- reqs-*.md 파일의 덮어쓰기 여부가 미정의다.
- 부분 재실행 시 Phase 2 결과물(reqs-business.md 등)이 서로 다른 인터뷰 상태를 반영하는 불일치 상태가 된다.

**적용된 개선 — 두 경로를 명시적으로 분리:**

| 경로 | 선택 조건 | 재실행 범위 | 파일 처리 |
|------|-----------|-------------|-----------|
| **Supplement axis** | 1개 축에만 갭 발견 | 해당 축 인터뷰 + extractor만 재실행 → Phase 3 재실행 → Phase 4 복귀 | 해당 `reqs-{axis}.md`만 덮어씀. 나머지 2개 유지 |
| **Full re-interview** | 목표/범위 자체가 오해됨 | Phase 1 전체 → Phase 2 전체 → Phase 3 → Phase 4 | `reqs-*.md` + `cross-check.md` 삭제. `qa-log.md`는 `## Re-interview` 섹션 추가 후 유지 |

핵심: 부분 재실행(`Supplement axis`) 시 나머지 두 축 결과물을 보존함으로써 reqs 파일 간 인터뷰 상태 불일치를 방지한다.

---

## 🟠 High — 품질 저하 또는 루프 위험

### H-1. (해결됨) gap-auditor에 circuit breaker 없음

> ✅ **개선 적용됨** (SKILL.md Phase 1 Gap Audit Flow 수정)
>
> **현재 동작:** `qa-log.md` frontmatter의 `audit_counts`로 축당 dispatch 수를 추적하며, 5회 초과 시 사용자에게 Continue/Accept 에스컬레이션을 띄운다.

**구 동작:**
```
"You do NOT decide completion yourself — only gap-auditor can say SUFFICIENT"
```

Phase 1 인터뷰 루프의 탈출 조건이 오직 gap-auditor의 SUFFICIENT 판정뿐이었다.

**문제:**
`ralph-stop.sh`에는 30회 circuit breaker가 있지만, Phase 1 gap-auditor 루프에는 최대 반복 횟수가 없다.
gap-auditor가 해당 프로젝트 도메인을 모르거나 낮은 품질의 감사를 반복할 경우 이론적으로 무한루프가 가능하다.

**적용된 개선:**
- 축당 최대 **5회** gap-auditor dispatch 제한
- 감사 횟수를 `qa-log.md` frontmatter의 `audit_counts: {business, interaction, tech, final}`에 추적
- 5회 초과 시 사용자에게 에스컬레이션 (AskUserQuestion):
  - "Continue interviewing" → 계속 진행
  - "Accept and move on" → 미해결 갭을 `open_decision`으로 전환 후 SUFFICIENT처럼 처리
- Interview Completion 조건에 "또는 circuit-breaker 에스컬레이션 수락" 명시

---

### H-2. (해결됨) SR Context Detection의 False Positive 위험

> ✅ **개선 적용됨** (SKILL.md Step 0.1 수정)
>
> **현재 동작:** Step 0.1은 high/medium/low 3단계 신뢰도 테이블을 사용하며, generic 키워드 단독으로는 추론하지 않고 medium 신호는 `(estimated)`로 표시해 사용자가 정정할 수 있게 한다.

**구 동작:**
단일 키워드 매칭으로 sr_profile을 결정했다:
```
`node`, `topic`, `action`, `service`  →  sr_profile: ros-node  (오탐 가능)
`dashboard`, `backend`, `be`, `fe`    →  sr_product: sarics-nx (오탐 가능)
`테스트`, `tool`, `도구`               →  sr_profile: infra     (오탐 가능)
```

**문제:**
이 키워드들은 다른 도메인에서 흔히 등장한다(`node` → Node.js, `topic` → Kafka, `dashboard` → Grafana 등).
잘못 추론된 sr_profile이 Phase 2 tech-extractor에 잘못된 boundary context로 주입되면 요구사항 ID 구조가 틀어진다.

**적용된 개선 — 신뢰도 3단계:**

| 신뢰도 | 조건 | 처리 |
|--------|------|------|
| **high** | domain-specific 키워드 (`core-nav*`, `rclpy`, `uart`, `nav2` 등) | 자동 추론 |
| **medium** | 2개+ 일반 키워드 또는 일반+domain-specific 혼합 | mirror에 `(추정)` 표시 후 확인 |
| **low** | 1개 일반 키워드만 | null로 설정 — 추론 안 함 |

`node`, `service`, `topic`, `action`은 generic으로 분류 — ROS 전용 키워드(`nav2`, `rclpy`, `amcl` 등)와 함께 등장할 때만 medium+ 처리.

---

### H-3. (해결됨) "Stuck on axis" 트리거 기준 미정의

> ✅ **개선 적용됨** (SKILL.md Phase 1 Gap Audit Triggers 수정)
>
> **현재 동작:** "moving forward"는 `qa-log.md`에 새 `status: resolved` 항목이 추가된 경우로 정의되며, `ambiguous`/`assumption` 만 추가된 턴은 진전으로 간주하지 않는다.

**구 동작:**
```
"after 3 consecutive AskUserQuestion turns on the same axis without moving forward"
```

**문제:**
"moving forward"의 측정 기준이 없어 오케스트레이터의 주관적 판단에 의존했다.

**적용된 개선 — 객관적 기준:**
```
직전 3턴에서 qa-log.md에 새 `status: resolved` 항목이 추가되지 않은 경우
(status: ambiguous 또는 status: assumption만 추가된 턴은 진전으로 간주하지 않음)
```

---

## 🟡 Medium — 설계 불일치 또는 암묵적 의존성

### M-1. (해결됨) Depth Calibration → Phase 1 질문 연결이 암묵적

> ✅ **개선 적용됨** (SKILL.md Phase 1 — Depth → Question Guidelines 섹션 추가)
>
> **현재 동작:** `light:1` / `standard:2-3` / `deep:4+` 최소 질문 수와 Inline/Post-Audit drill 의무 매핑이 표로 명시되며, gap-auditor도 같은 기준으로 coverage를 판정한다.

**구 동작:**
Step 0.4에서 `light/standard/deep`이 결정되지만 Phase 1에서 이것이 질문 수와 drill에 어떻게 반영되는지 명시가 없었다.

**문제:**
LLM의 추론에 전적으로 의존 → 실행마다 결과 편차.

**적용된 개선 — depth별 가이드라인 명시:**

| depth | 최소 질문 수 | Inline Drill (Type A) | Post-Audit Drill (Type B) |
|-------|-------------|----------------------|--------------------------|
| `light` | 1 | 선택적 | 선택적 |
| `standard` | 2–3 | 첫 모호 신호 시 | 필수 |
| `deep` | 4+ | 모든 신호에 의무 | 의무 |

gap-auditor도 동일 테이블을 기준으로 coverage 판정 — `deep` 노드에 질문 1개면 거의 항상 CONTINUE 반환.

---

### M-2. (해결됨) Phase 1→2 전환에 사용자 확인 게이트 없음

> ✅ **개선 적용됨** (SKILL.md Interview Completion 섹션 수정)
>
> **현재 동작:** Final SUFFICIENT 직후 Phase 2로 자동 진입하지 않고, `Proceed` / `Add more` AskUserQuestion 게이트를 거친다. `Add more` 선택 시 해당 축 보완 후 Final audit를 다시 실행한다.

**구 동작:**
gap-auditor Final SUFFICIENT 직후 Phase 2가 자동으로 시작되었다.

**문제:**
사용자가 인터뷰 결과를 검토할 기회 없이 추출이 진행 → 가정이 요구사항으로 굳어질 수 있음.

**적용된 개선:**
`Interview Completion` 이후 Phase 2 진입 전 AskUserQuestion 게이트 추가:
- "Proceed" → 3개 에이전트 병렬 실행
- "Add more" → 해당 축 보완 후 Final audit 재실행 → 다시 게이트

---

### M-3. (해결됨) Phase 2 parallel extraction — 구조적 불일치 발생

> ✅ **개선 적용됨** (SKILL.md Phase 2 Post-processing 섹션 추가)
>
> **현재 동작:** Phase 3 진입 전 deterministic dedup 패스가 실행되어 `given+when+then` 구조가 동일한 항목을 제거하고, 결과를 `cross-check.md`의 `## Dedup Log`에 기록한다.

**구 동작:**
3개 extractor 완료 후 바로 Phase 3으로 진행 — 구조적 중복이 모두 Cross-Check로 넘어갔다.

**문제:**
서로의 결과를 모르는 3개 에이전트가 병렬 실행되면 DUPLICATE는 구조적으로 반드시 발생한다.
이를 Phase 3에서 전부 처리하면 Phase 4 Confirmation이 과도하게 길어진다.

**적용된 개선 — Phase 2 Post-processing:**
3개 extractor 완료 후 Phase 3 진입 전 경량 dedup 패스:
- `when/then` 구조가 동일한 항목을 자동 제거 (더 specific한 축의 항목 유지)
- 제거 항목은 dedup 로그에 기록
- Phase 3에는 의미적 충돌(semantically overlapping)만 전달 → Confirmation 부하 감소

---

### M-5. (해결됨) 재실행 시 qa-log.md 덮어쓰기 + Phase 0.5 중복 스캔

> ✅ **개선 적용됨** (SKILL.md Step 0.3 + Phase 0.5 수정)
>
> **현재 동작:** Step 0.3은 기존 `qa-log.md`가 있으면 덮어쓰지 않고 재실행으로 간주하며, Phase 0.5는 `research_done: true` 플래그 시 Re-use/Re-scan AskUserQuestion 분기로 중복 스캔을 방지한다.

**구 동작:**
```
Step 0.3: "Initialize <spec_dir>/qa-log.md ..."  ← 기존 파일 체크 없음
Phase 0.5: "Skip if greenfield"                  ← research_done 체크 없음
```

같은 spec에 `/specify`를 재실행하면:
1. `requirements.md`는 이미 존재 → `req init` 스킵 (올바름)
2. `qa-log.md`는 **무조건 새로 초기화** → 이전 인터뷰 이력 소멸
3. Phase 0.5는 코드 변화 없어도 **3개 에이전트 다시 실행** → 불필요한 비용

`research_done: true` 플래그가 기록되지만 **세션 간 스킵 신호로 사용되지 않았다.**

**적용된 개선:**

Step 0.3 — qa-log.md 존재 여부 분기:
```
<spec_dir>/qa-log.md 존재?
  YES → 기존 파일 유지 (do NOT overwrite); 재실행으로 간주하고 초기화 스킵
  NO  → 새로 초기화 (기존 동작)
```

Phase 0.5 — research_done 기반 캐시:
```
qa-log.md frontmatter에 research_done: true 존재?
  YES → AskUserQuestion:
        - "Re-use": 기존 Research 섹션 유지, 에이전트 실행 생략
        - "Re-scan": 에이전트 재실행
  NO  → 기존 동작 (에이전트 병렬 실행)
```

---

### M-4. (해결됨) Template 의존성에 fallback 없음

> ✅ **개선 적용됨** (SKILL.md Step 0.3 Pre-flight check 추가)
>
> **현재 동작:** Step 0.3에서 `qa-log.md` / `reqs-axis.md` / `requirements.md` 3개 템플릿의 존재를 인터뷰 시작 전에 확인하며, 누락 시 즉시 abort한다.

**구 동작:**
템플릿 파일 존재 여부를 각 사용 시점(Phase 2, Phase 4.4)에야 확인 → Phase 4.4 실패 시 수 시간의 인터뷰 작업 손실.

**적용된 개선 — Step 0.3 Pre-flight check:**
파이프라인 진입 전(스펙 디렉토리 생성 전) 3개 템플릿 존재 확인:
```
${baseDir}/templates/qa-log.md
${baseDir}/templates/reqs-axis.md
${baseDir}/templates/requirements.md
```
하나라도 없으면 즉시 abort + 명확한 오류 메시지 출력. 인터뷰 시작 전에 조기 탐지.

---

## 우선순위 요약

| ID | 우선순위 | 문제 | 주요 영향 |
|----|----------|------|-----------|
| C-1 | ✅ 완료 | Phase 3 in-memory → 세션 중단 시 소멸 | 데이터 손실, 충돌 정보 유실 |
| C-2 | ✅ 완료 | Re-interview 재실행 범위 미정의 | Phase 2 결과물 불일치 |
| H-1 | ✅ 완료 | gap-auditor circuit breaker 없음 | 무한루프 가능 |
| H-2 | ✅ 완료 | SR Detection false positive | 잘못된 boundary context 주입 |
| H-3 | ✅ 완료 | "Stuck" 기준 미정의 | 감사 시점 불일치 |
| M-1 | ✅ 완료 | Depth → 질문 매핑 암묵적 | 실행마다 결과 편차 |
| M-2 | ✅ 완료 | Phase 1→2 게이트 없음 | 사용자 제어권 부재 |
| M-3 | ✅ 완료 | 병렬 extraction 불일치 | Phase 4 과부하 |
| M-4 | ✅ 완료 | Template 존재 확인 없음 | Phase 4 말미 실패 |
| M-5 | ✅ 완료 | 재실행 시 qa-log.md 덮어쓰기 + Phase 0.5 중복 스캔 | 인터뷰 이력 소멸, 불필요한 에이전트 비용 |

---

## 적용 검증 결과

2026-04-29 기준으로 위 항목은 `skills/specify/SKILL.md`에 다음 위치로 반영되었다.

| ID | SKILL.md 반영 위치 | 확인 내용 |
|----|-------------------|-----------|
| C-1 | Phase 3 / Phase 4.1 / Output Files | `cross-check.md` 생성, Phase 4에서 파일 기반 Summary, 출력 파일 표에 추가 |
| C-2 | Phase 4.3 | `Supplement axis` / `Full re-interview` 경로와 파일 처리 규칙 명시 |
| H-1 | Phase 1 Gap Audit Flow | `audit_counts` 증가, 축당 5회 circuit breaker, 사용자 에스컬레이션 추가 |
| H-2 | Step 0.1 | SR detection confidence table 추가, generic keyword 단독 추론 금지 |
| H-3 | Phase 1 Gap Audit Triggers | `status: resolved` 추가 여부를 stuck 기준으로 정의 |
| M-1 | Phase 1 Depth → Question Guidelines | `light/standard/deep`별 최소 질문 수와 drill 정책 명시 |
| M-2 | Interview Completion | Phase 2 진입 전 `Proceed` / `Add more` 사용자 게이트 추가 |
| M-3 | Phase 2 Post-processing | exact structural duplicate dedup 규칙과 `Dedup Log` 추가 |
| M-4 | Step 0.3 | template pre-flight check 추가 |
| M-5 | Step 0.3 / Phase 0.5 | 기존 `qa-log.md` 보존, `research_done` 기반 Re-use/Re-scan 분기 추가 |

---

## 전체 스킬 인벤토리 / 검증 커버리지

| Skill | Pipeline role | Main purpose | `validate_prompt` | Tool policy | 정비 포인트 |
|-------|---------------|--------------|-------------------|-------------|-------------|
| `specify` | Core pipeline | 목표를 인터뷰 기반 `requirements.md`로 변환 | 없음 | 없음 | 이번 문서의 적용 항목 반영 완료. 다음 단계로 `validate_prompt` 추가 권장 |
| `blueprint` | Core pipeline | `requirements.md`에서 `plan.json`, `contracts.md`, `design.md` 생성 | 없음 | 없음 | 산출물 3종 생성 조건을 `validate_prompt`로 고정 필요 |
| `execute` | Core pipeline | `plan.json` 또는 `requirements.md`를 실행 태스크로 수행 | 있음 | 있음 | 현재 커버리지 양호 |
| `bugfix` | Core pipeline | RCA → requirements → execute 기반 버그 수정 | 있음 | 있음(`allowed_tools`) | tool policy key를 `allowed-tools`로 표준화 권장 |
| `knowledge` | SR support | SR-Harness module KB CRUD / scan / status 관리 | 없음 | 있음 | scan/update/delete별 완료 조건을 `validate_prompt`로 추가 권장 |
| `spec-review` | SR support | 게이트 밖 requirements/plan/design/contracts 동기화 수정 | 없음 | 있음 | 문서 동기화 성공 조건과 `plan validate` 조건을 `validate_prompt`에 추가 권장 |
| `scaffold` | Planning | Greenfield 구조와 harness 의사결정 생성 | 없음 | 있음 | L2/L3/L4 gate 완료 조건을 `validate_prompt`로 추가 권장 |
| `ultrawork` | Automation | specify → execute end-to-end 자동 파이프라인 | 없음 | 있음 | chained skill 완료/중단 조건을 `validate_prompt`로 추가 권장 |
| `mirror` | Planning | 사용자 의도 mirror-back 및 확인 | 있음 | 있음 | 현재 커버리지 양호 |
| `discuss` | Planning | Socratic problem definition / idea clarification | 있음 | 있음 | 현재 커버리지 양호 |
| `stepback` | Review | 진행 중 작업의 scope/side effect/better approach 점검 | 있음 | 있음 | 현재 커버리지 양호 |
| `tribunal` | Review | Risk/Value/Feasibility 3관점 adversarial review | 있음 | 있음 | 현재 커버리지 양호 |
| `council` | Review | 다관점 decision committee / tradeoff map | 있음 | 있음 | 현재 커버리지 양호 |
| `rulph` | Review loop | Rubric 기반 평가와 반복 개선 | 있음 | 있음 | 현재 커버리지 양호 |
| `ralph` | Execution loop | DoD 기반 반복 완료 루프 | 있음 | 있음 | 현재 커버리지 양호 |
| `qa` | Verification | 브라우저/컴퓨터/CLI QA 및 fix evidence | 있음 | 있음 | 현재 커버리지 양호 |
| `check` | Verification | 변경사항 rule checklist / pre-push 검증 | 없음 | 없음 | PASS/WARN 출력 조건과 rule update 조건을 `validate_prompt`로 추가 권장 |
| `skill-session-analyzer` | Verification | 과거 skill/session 실행 적합성 분석 | 없음 | 있음 | 분석 보고서 필수 섹션을 `validate_prompt`로 추가 권장 |
| `browser-work` | Research/automation | 브라우저 작업 전 recon guide 작성 후 실행 위임 | 없음 | 없음 | guide 파일 필수 섹션과 cleanup 조건을 `validate_prompt`로 추가하고 allowed-tools 명시 권장 |
| `google-search` | Research | chromux 기반 Google search / article extraction | 없음 | 없음 | source/citation/visited URL 조건과 allowed-tools 추가 권장 |
| `deep-research` | Research | web/browser/Gemini 병렬 deep research report | 없음 | 없음 | cited report 필수 섹션을 `validate_prompt`로 추가 권장 |
| `dev-scan` | Research | Reddit/HN/Dev.to 등 개발자 커뮤니티 의견 수집 | 없음 | 없음 | sentiment/source coverage 조건과 allowed-tools 추가 권장 |
| `reference-seek` | Research | 내부/OSS 구현 reference 탐색 | 있음 | 없음 | allowed-tools 추가 권장 |
| `analyze-oss` | Research | OSS의 What/Why/Who/Usage 중심 분석 | 있음 | 없음 | allowed-tools 추가 권장 |
| `tech-decision` | Research/decision | 기술 선택 비교와 recommendation 생성 | 없음 | 없음 | `validate_prompt`와 allowed-tools 추가 권장 |
| `issue` | Delivery | 영향 분석 후 GitHub issue 생성 | 있음 | 있음(`allowed_tools`) | tool policy key를 `allowed-tools`로 표준화 권장 |
| `compound` | Delivery | PR/작업 learnings를 docs/learnings에 저장 | 없음 | 있음 | 저장 파일 경로/요약 필수 조건을 `validate_prompt`로 추가 권장 |

상세 분석과 실행 백로그는 [`14_skills-improvement-rollup.md`](./14_skills-improvement-rollup.md)에 별도 정리한다.

---

## v1.6.0-sr.3 추가 보강

> 작성일: 2026-04-29
> 트리거: 위 C-1~M-5 적용 후 fresh review에서 발견된 7건의 추가 갭
> 영향 범위: `skills/specify/SKILL.md`, `skills/specify/templates/qa-log.md`, `agents/interaction-extractor.md`, `agents/gap-auditor.md`

C-1~M-5 적용 후 SKILL.md/templates/agent를 다시 대조해 발견한 7건의 후속 갭을 같은 사이클에서 닫았다. 모두 기존 개선이 의존하는 기반 정합성 항목이라, 이 보강이 없으면 v1.6.0-sr.2의 기존 개선이 부분적으로만 동작한다.

### N-1. (적용됨) Interaction extractor 축 코드 불일치

**현상**: `skills/specify/SKILL.md`와 `skills/blueprint/SKILL.md`는 Interaction 축 ID를 `R-U*`로 사용한다. 하지만 `agents/interaction-extractor.md`는 `R-I*`로 작성하라고 지시했다.

**영향**: Phase 2에서 R-I*로 생성된 ID가 Phase 3 cross-check, Phase 4.4 final write를 거쳐 `/blueprint`에 도달했을 때 `R-U*` 기대치와 충돌 → journey/fulfills 매핑 깨짐.

**적용**: `agents/interaction-extractor.md` line 54를 `Use axis code U` + 예시 `R-U1, R-U1.1`로 통일.

### N-2. (적용됨) gap-auditor 깊이 기준 불일치

**현상**: `specify/SKILL.md` line 372-376은 `light=1 / standard=2-3 / deep=4+` **질문 수**를 기준으로 한다. 그러나 `agents/gap-auditor.md` line 20-22는 deep을 "drill follow-up 1개 이상"이라는 **drill 수** 기준으로 판정했다.

**영향**: orchestrator가 specify 기준으로 "deep 노드에 4개 질문 → 충분"으로 보내도 gap-auditor가 drill 부재로 AMBIGUOUS 반환 가능 → H-1 circuit breaker(5회 한계)를 무력화 → 무한루프 위험 부분 잔존.

**적용**: `agents/gap-auditor.md`의 Depth-Calibrated Evaluation 섹션을 specify 표와 동일 구조(질문 수 + drill 의무 + verdict bias 4-row 표)로 동기화.

### N-3. (적용됨) sr_modules 추출 규칙 부재

**현상**: Step 0.1 키워드 표는 `sr_product / sr_profile / sr_ros_version`만 다뤘고, `sr_modules` 값을 어떻게 추출하는지 명시 없었다. 그러나 Phase 0.5 KB-first lookup, Step 4.5 KB Save가 모두 `where.sr_modules`에 의존한다.

**영향**: 사용자가 "core-driver의 wheel 패킷 처리"라고 입력해도 sr_modules가 빈 상태 → KB-first lookup이 항상 agent dispatch로 fallback → M-5 KB 캐시가 실효성 잃음.

**적용**: SKILL.md Step 0.1에 토큰 → 정규화 모듈명 매핑 표 추가(`core-driver`/`wheel`/`bms` → `core-driver`, `core-nav*`/`nav2` → `core-navigation` 등 7-row). null vs `[]` 구분 규칙 명시.

### N-4. (적용됨) cross-check.md 파일 구조 미고정

**현상**: Phase 2 Post-processing이 `## Dedup Log`를 append하고, Phase 3가 같은 파일에 "Write a Cross-Check Report"라고만 명시 → 덮어쓰기 vs append 경계 모호.

**영향**: Phase 3 실행 시 Phase 2의 Dedup Log가 소실될 가능성. 게다가 Supplement axis 재실행 시 cross-check.md 라이프사이클이 명시되지 않아 immutability 규칙(line 633)과 잠재 충돌.

**적용**:
- SKILL.md Phase 2 Post-processing 다음에 "cross-check.md Section Structure (fixed)" 섹션 추가 — `## Dedup Log`(Phase 2 owner) + `## Cross-Check Report`(Phase 3 owner) 2-section 고정
- Phase 3 본문을 "Read existing cross-check.md, preserve Dedup Log, replace Cross-Check Report body"로 재작성

### N-5. (적용됨) qa-log.md 템플릿이 runtime 기대와 비동기

**현상**: SKILL.md는 frontmatter에 `sr_product` / `sr_modules` / `sr_ros_version` / `sr_profile` / `sr_raw_input` / `research_done` / `audit_counts` 7개 필드를 기록·증가시킨다고 명시한다. 그러나 `templates/qa-log.md`에는 7개 모두 없었다.

**영향**: 매 실행마다 orchestrator가 ad-hoc으로 필드를 만들어야 함. audit_counts 미초기화 시 increment 시점에 모호 발생, research_done 키 없음으로 Phase 0.5 캐시 hit 판정 불안정.

**적용**: `templates/qa-log.md` frontmatter에 7개 필드 default 값 추가 (sr_*는 null, research_done false, audit_counts 4축 모두 0).

### N-6. (적용됨) 재실행 시 scope mismatch 검출 부재

**현상**: Step 0.3는 기존 qa-log.md가 있으면 보존만 하고 새 mirror 결과와 비교 안 함. 사용자가 같은 spec_dir에 다른 goal로 재실행하면 frontmatter는 이전 goal, 본문은 새 Q&A → silent corruption.

**영향**: Phase 2 extractor가 모순된 컨텍스트(frontmatter goal vs 본문 답)를 보고 잘못된 요구사항 생성 가능. 디버깅 어려움.

**적용**: SKILL.md Step 0.3에 Resume mismatch check 추가 — `goal` / `non_goals` / `situation` / `ambition` / `sr_product` / `sr_profile` / `sr_modules` 비교 후 mismatch 시 AskUserQuestion 3-옵션(Update WHERE / Keep existing / Fresh spec).

### N-7. (적용됨) baseDir 정의 불명확

**현상**: `${baseDir}/templates/...`이 5+ 위치에서 사용되는데 정의가 line 188의 "specify skill directory"라는 간접 언급뿐.

**영향**: 신규 contributor 혼동 가능 — repo root vs skill directory 해석 차이 위험.

**적용**: SKILL.md 상단에 "Path Conventions" 섹션 추가 — `${baseDir}` = SKILL.md가 위치한 디렉토리(`skills/specify/`)로 명시, `<spec_dir>` 의미도 함께 명문화.

---

### 적용 결과 영향 매트릭스

| 보강 ID | 닫는 갭 | 의존 기존 개선 | 영향 |
|---|---|---|---|
| N-1 | R-U/R-I 표류 | C-2 (Re-interview), Phase 4.4 | /blueprint 매핑 정상화 |
| N-2 | gap-auditor 무한루프 | H-1 (circuit breaker) | 5회 한계가 의미를 갖게 됨 |
| N-3 | KB 캐시 무력화 | M-5 (research cache) | 재실행 시 agent dispatch 회피 |
| N-4 | cross-check 데이터 소실 | C-1 (Phase 3 영속화) | 섹션 충돌 제거 |
| N-5 | runtime/template drift | H-1, M-5 | silent fail 방지 |
| N-6 | scope corruption | M-5 (qa-log 보존) | 재실행 안전성 |
| N-7 | 경로 모호 | 전반 | contributor 혼동 제거 |

### 미해결로 남긴 항목 (별도 백로그)

- `validate_prompt` / `allowed-tools` 정규화 — 메타-개선이라 본 사이클 범위 외
- Phase 4.2 in-memory 결정의 영속화 (C-1 패턴이 Phase 4 내부에서 재발하는 잠재 이슈) — 별도 design doc 필요
- `## Pre-work` 섹션 파싱 형식 명세 — /execute 측 명세와 동시 작업 필요

이 3건은 다음 사이클(`v1.6.0-sr.4` 예정) 또는 별도 spec/specify로 다룬다.
