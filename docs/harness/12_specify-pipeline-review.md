# /specify Pipeline Review — Problems & Improvements

> 작성일: 2026-04-28
> 기준 버전: v1.6.0-sr.1
> 목적: `/specify` SKILL.md 내부 파이프라인의 잠재적 문제점과 개선 방향 정리

---

## 개요

`/specify`의 내부 파이프라인은 다음 5단계로 구성된다:

```
Phase 0: WHERE Grounding
    ├─ Step 0.1: Mirror + SR Context Detection
    ├─ Step 0.2: PROJECT_TYPE × SITUATION × AMBITION
    ├─ Step 0.2b: Risk Modifiers
    ├─ Step 0.3: spec_dir 생성 (hoyeon-cli req init)
    └─ Step 0.4: Axis Depth Calibration (A→B→C→D)

Phase 0.5: Context Research (brownfield only)
    └─ code-explorer × 2 + docs-researcher 병렬 실행

Phase 1: Interview
    └─ 3축(BUSINESS/INTERACTION/TECH) × AskUserQuestion
       + Inline Drill + gap-auditor 감사 루프

Phase 2: Requirements Extraction
    └─ business-extractor + interaction-extractor + tech-extractor 병렬

Phase 3: Cross-Check (in-memory)
    └─ CONFLICT / GAP / DUPLICATE 탐지

Phase 4: Confirmation
    ├─ Step 4.1: Cross-Check Summary 표시
    ├─ Step 4.2: 충돌/가정 AskUserQuestion 해소
    ├─ Step 4.3: Requirements Preview → 명시적 승인
    └─ Step 4.4: requirements.md 최종 기록
```

---

## 🔴 Critical — 파이프라인 붕괴 가능

### C-1. Phase 3 Cross-Check가 in-memory only

> ✅ **개선 적용됨** (SKILL.md Phase 3 / Phase 4 수정)

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

### C-2. Re-interview 분기의 미정의 동작

> ✅ **개선 적용됨** (SKILL.md Phase 4.3 수정)

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

### H-1. gap-auditor에 circuit breaker 없음

> ✅ **개선 적용됨** (SKILL.md Phase 1 Gap Audit Flow 수정)

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

### H-2. SR Context Detection의 False Positive 위험

> ✅ **개선 적용됨** (SKILL.md Step 0.1 수정)

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

### H-3. "Stuck on axis" 트리거 기준 미정의

> ✅ **개선 적용됨** (SKILL.md Phase 1 Gap Audit Triggers 수정)

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

### M-1. Depth Calibration → Phase 1 질문 연결이 암묵적

> ✅ **개선 적용됨** (SKILL.md Phase 1 — Depth → Question Guidelines 섹션 추가)

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

### M-2. Phase 1→2 전환에 사용자 확인 게이트 없음

> ✅ **개선 적용됨** (SKILL.md Interview Completion 섹션 수정)

**구 동작:**
gap-auditor Final SUFFICIENT 직후 Phase 2가 자동으로 시작되었다.

**문제:**
사용자가 인터뷰 결과를 검토할 기회 없이 추출이 진행 → 가정이 요구사항으로 굳어질 수 있음.

**적용된 개선:**
`Interview Completion` 이후 Phase 2 진입 전 AskUserQuestion 게이트 추가:
- "Proceed" → 3개 에이전트 병렬 실행
- "Add more" → 해당 축 보완 후 Final audit 재실행 → 다시 게이트

---

### M-3. Phase 2 parallel extraction — 구조적 불일치 발생

> ✅ **개선 적용됨** (SKILL.md Phase 2 Post-processing 섹션 추가)

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

### M-5. 재실행 시 qa-log.md 덮어쓰기 + Phase 0.5 중복 스캔

> ✅ **개선 적용됨** (SKILL.md Step 0.3 + Phase 0.5 수정)

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

### M-4. Template 의존성에 fallback 없음

> ✅ **개선 적용됨** (SKILL.md Step 0.3 Pre-flight check 추가)

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

## 수정 적용 시 우선순위

Critical 2개를 먼저 처리하는 것이 권장된다:

1. **C-1**: Phase 3에 `cross-check.md` 기록 추가 — SKILL.md Phase 3 섹션 수정
2. **C-2**: Re-interview 분기 경로 명시 — SKILL.md Phase 4.3 섹션 수정
3. **H-1**: gap-auditor loop에 `max_iter: 5` 명시 — SKILL.md Phase 1 Gap Audit Flow 수정
4. **H-2**: SR Detection 신뢰도 테이블 추가 — SKILL.md Step 0.1 수정
