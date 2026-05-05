# Skills Improvement Rollup — `12_specify-pipeline-review.md` 기반 정리

> 작성일: 2026-04-29
> 원천 문서: [`12_specify-pipeline-review.md`](./12_specify-pipeline-review.md) (v1.6.0-sr.1 post-implementation review)
> 범위: `skills/` 디렉토리 전체 (27개 스킬)
> 목적: `/specify` 파이프라인 리뷰에서 도출된 발견 사항을 27개 스킬 전체에 mapping하여 개선 항목을 단일 시트로 정리

---

## 1. 원천 문서 개요

`12_specify-pipeline-review.md`는 `skills/specify/SKILL.md`(v1.6.0-sr.1)에 대한 post-implementation review로, 다음 두 부분으로 구성된다.

### 1.1 `/specify` 파이프라인 발견 항목 (10건, 모두 SKILL.md에 반영 완료)

| ID | 우선순위 | 문제 | 핵심 패턴 |
|----|----------|------|-----------|
| C-1 | Critical | Phase 3 Cross-Check가 in-memory only | 정적 발견 ↔ 동적 해결 파일 분리 |
| C-2 | Critical | Re-interview 분기의 미정의 동작 | `Supplement axis` / `Full re-interview` 경로 명시 |
| H-1 | High | gap-auditor에 circuit breaker 없음 | 축당 5회 + 사용자 에스컬레이션 |
| H-2 | High | SR Context Detection의 false positive 위험 | 신뢰도 3단계 (high/medium/low) |
| H-3 | High | "Stuck on axis" 트리거 기준 미정의 | 객관적 측정 기준 (`status: resolved` 변화) |
| M-1 | Medium | Depth → 질문 매핑이 암묵적 | depth별 최소 질문 수 가이드라인 명시 |
| M-2 | Medium | Phase 1→2 전환에 사용자 게이트 없음 | `Proceed/Add more` AskUserQuestion |
| M-3 | Medium | 병렬 extraction에서 구조적 불일치 | Phase 2 post-processing dedup |
| M-4 | Medium | Template 의존성에 fallback 없음 | Step 0.3 pre-flight check |
| M-5 | Medium | 재실행 시 qa-log 덮어쓰기 + Phase 0.5 중복 스캔 | research_done 기반 캐시 |

### 1.2 전체 스킬 인벤토리 / 검증 커버리지

원천 문서의 §"전체 스킬 인벤토리"는 27개 스킬 각각에 대해 `validate_prompt` / `Tool policy(allowed-tools)` 보유 여부와 정비 포인트를 제시한다. 본 문서는 이 인벤토리를 **현재 파일 상태로 검증한 뒤**, 우선순위로 재배열하고 횡단 개선 패턴(cross-cutting themes)을 추가한다.

---

## 2. 횡단 개선 패턴 (Cross-cutting themes)

`/specify` 리뷰에서 도출된 패턴 중 **다른 스킬에도 동일하게 적용되어야 할** 것을 분리한다.

### Theme A. State Persistence — 중간 분석 결과를 디스크에 기록 (C-1 일반화)

`/specify`가 Phase 3 Cross-Check를 in-memory에 두어 세션 압축 시 소멸된 것과 동일한 위험은 다음 스킬에도 존재한다.

- **잠재 영향군:** `blueprint`(plan + contracts + design 동시 산출), `bugfix`(RCA → requirements 흐름), `ultrawork`(specify→execute 체이닝), `compound`(learnings 추출), `skill-session-analyzer`(분석 결과)
- **개선 패턴:** "분석 결과는 다음 phase 진입 전에 파일로 flush", "정적 발견 파일과 동적 해결 파일을 분리", "재시작 시 두 파일 비교로 미해결 항목 감지"

### Theme B. Loop Termination — 무한 루프 가드 (H-1 일반화)

gap-auditor 5회 circuit breaker와 동일한 가드는 다음 스킬에 필요하다.

- **잠재 영향군:** `ralph`(이미 30회 가드 있음 — 정렬 확인), `rulph`(rubric 반복 평가), `gap-auditor`/`spec-validator` 같은 Phase 1 보조 에이전트, `execute`(verify 재실행 루프)
- **개선 패턴:** 최대 횟수 + 카운터 기록 + 에스컬레이션 분기

### Theme C. Pre-flight Checks — 외부 의존성 조기 탐지 (M-4 일반화)

template 3종 존재 확인을 Step 0.3에 둔 것과 동일한 패턴은 외부 리소스를 사용하는 모든 스킬에 적용 가능.

- **잠재 영향군:** `browser-work`(chromux 가용성), `google-search`/`deep-research`/`dev-scan`(브라우저 + 외부 API), `qa`(테스트 환경), `knowledge`(KB 디렉토리), `spec-review`(`hoyeon-cli` 가용성), `ultrawork`(specify/execute 체인 모두 가용한지)
- **개선 패턴:** 오케스트레이션 시작 전 의존성 fail-fast 검증, 명확한 abort 메시지

### Theme D. User Gate Before Side Effects — 자동 진행 차단 (M-2 일반화)

Phase 1→2 자동 진입 게이트와 동일한 패턴은 결과물을 다량 생성하기 직전 스킬에 필요하다.

- **잠재 영향군:** `blueprint`(task graph 확정 직전), `execute`(워커 dispatch 직전), `ultrawork`(specify 결과 → execute 진입 직전), `bugfix`(fix dispatch 직전), `scaffold`(파일 대량 생성 직전)
- **개선 패턴:** `AskUserQuestion(Proceed / Adjust)` 게이트

### Theme E. Cache + Re-run Behavior — 재실행 비용 통제 (M-5 일반화)

`research_done` 캐시 + Re-use/Re-scan 분기와 동일한 패턴은 비용이 큰 스캔/리서치를 수행하는 스킬에 필요하다.

- **잠재 영향군:** `deep-research`, `dev-scan`, `analyze-oss`, `reference-seek`, `knowledge`(scan), `skill-session-analyzer`
- **개선 패턴:** frontmatter 캐시 마커 + 명시적 Re-use/Re-scan 선택지

### Theme F. Confidence-tiered Inference — 키워드 단독 추론 금지 (H-2 일반화)

generic 키워드 단독으로 분류를 결정하지 않는 패턴은 다음 스킬에 필요하다.

- **잠재 영향군:** `tech-decision`(A vs B 분기), `dev-scan`(community sentiment 추출), `analyze-oss`(분류), `mirror`(SR 컨텍스트 mirror)
- **개선 패턴:** `high/medium/low` 신뢰도 + medium 이하는 사용자 확인

### Theme G. `validate_prompt` Coverage — 출력물 자동 검증

`CLAUDE.md`의 `PostToolUse[Skill]` 훅 (`validate-output.sh`)이 `validate_prompt` frontmatter를 읽어 자동 검증 리마인더를 출력한다. 현재 13/27(48%)만 적용 — 나머지에 추가 권장.

### Theme H. `allowed-tools` Coverage — 권한 명시

권한 surface area 축소를 위해 `allowed-tools` 명시. 현재 canonical `allowed-tools`는 15/27(56%)에만 적용되어 있고, `bugfix`/`issue` 2개는 non-canonical `allowed_tools` 표기를 사용한다. 두 표기를 모두 인정하면 tool policy 선언은 17/27(63%)이다. 표준화를 위해 `allowed_tools`는 `allowed-tools`로 정규화하는 것이 좋다. 특히 외부 IO를 수행하는 research 스킬군이 누락됨.

---

## 3. 스킬별 개선 항목 (27개)

원천 문서 §"전체 스킬 인벤토리" 행을 그대로 가져오되, **현재 파일 상태로 재검증**하고 (frontmatter `validate_prompt` 및 `allowed-tools`/`allowed_tools` 존재 여부 grep 기준), 횡단 패턴(Theme A~F) mapping과 **즉시 액션** 칼럼을 추가했다.

### 범례
- `validate`: SKILL.md frontmatter에 `validate_prompt:` 키 존재 여부
- `tools`: SKILL.md frontmatter의 tool policy 상태. `✓` = canonical `allowed-tools`, `△` = non-canonical `allowed_tools`, `✗` = 없음
- `Themes`: 적용 가능한 횡단 개선 패턴 (§2)
- 우선순위 — **P1**: Core pipeline / 빈번 사용 / state 위험 / **P2**: SR support 또는 빈번 사용 / **P3**: 보조 / 사용 빈도 낮음

### 3.1 Core Pipeline (5개)

| Skill | validate | tools | Themes | 즉시 액션 |
|-------|:--------:|:-----:|--------|-----------|
| **specify** | ✗ | ✗ | (이번 리뷰 적용 완료) | (1) `validate_prompt` 추가: `requirements.md / qa-log.md / cross-check.md / reqs-*.md` 4종 모두 존재해야 PASS, `## Open Decisions` 섹션 형식 검증 (2) `allowed-tools` 명시 — Read/Write/Edit/Task/Bash/AskUserQuestion 외 차단 |
| **blueprint** | ✗ | ✗ | A, D | (1) `validate_prompt`: `plan.json` 스키마 + `contracts.md` + `design.md` 9-section 존재 확인 (2) `allowed-tools` 명시 (3) Theme D 게이트: task graph 승인 → contracts/design 생성 (이미 verify plan 게이트 있음 — frontmatter 조건으로 고정) (4) Theme A: Phase 0.5 codebase recon 결과를 디스크에 flush |
| **execute** | ✓ | ✓ | A, B, D | 현재 커버리지 양호. (1) Theme B 정렬: ralph-stop 30회 가드와 execute 내부 verify 재실행 루프의 가드 일치 확인 (2) Theme A: worker 학습이 즉시 KB로 flush되는 경로(이미 v1.6.0-sr.2에 도입) `validate_prompt`에 `learnings.json` 존재 조건 추가 |
| **bugfix** | ✓ | △ | A, D | (1) `allowed_tools`를 canonical `allowed-tools`로 정규화 (2) `validate_prompt`: RCA 단계 산출물(`Error Handling table`, `Accumulated Learnings`)이 모두 채워졌는지 검증 |
| **knowledge** | ✗ | ✓ | A, E | (1) `validate_prompt`: scan/update/delete/list/status 각각의 완료 조건 명시 — scan은 commit_sha 기록, update는 de-dup 로그, delete는 archived 이동 (2) Theme E: scan 재실행 시 commit_sha match → 자동 skip (이미 v1.6.0-sr.2에 도입 — `validate_prompt`로 고정) |

### 3.2 SR Support / Planning (3개)

| Skill | validate | tools | Themes | 즉시 액션 |
|-------|:--------:|:-----:|--------|-----------|
| **spec-review** | ✗ | ✓ | C | (1) `validate_prompt`: `hoyeon-cli plan validate` 통과, requirements.md/plan.json/design.md/contracts.md 동기화 cascade 규칙 충족 검증 (2) Theme C: 시작 시 `hoyeon-cli` 가용성 fail-fast |
| **scaffold** | ✗ | ✓ | A, D | (1) `validate_prompt`: L2/L3/L4 gate 각각의 완료 조건 명시 (2) Theme D: 파일 대량 생성 직전 사용자 게이트 |
| **ultrawork** | ✗ | ✓ | A, B, C, D | (1) `validate_prompt`: chained skill (specify/blueprint/execute) 각 stage 완료 조건 (2) Theme C: 시작 시 의존 스킬 가용성 + 디렉토리 권한 확인 (3) Theme B: pipeline 전체 timeout/iter 가드 |

### 3.3 Planning / Review (7개)

| Skill | validate | tools | Themes | 즉시 액션 |
|-------|:--------:|:-----:|--------|-----------|
| **mirror** | ✓ | ✓ | F | 현재 커버리지 양호. Theme F: SR Context mirror 시 generic 키워드 단독 추론 금지 패턴 적용(specify와 일관성) |
| **discuss** | ✓ | ✓ | — | 현재 커버리지 양호. 추가 액션 없음 |
| **stepback** | ✓ | ✓ | — | 현재 커버리지 양호 |
| **tribunal** | ✓ | ✓ | B | 현재 커버리지 양호. 3관점 review 반복 시 Theme B 가드 확인 |
| **council** | ✓ | ✓ | B | 현재 커버리지 양호. deliberation 반복 시 Theme B 가드 확인 |
| **rulph** | ✓ | ✓ | A, B | 현재 커버리지 양호. Theme A: rubric 평가 결과 즉시 디스크 flush 확인 |
| **ralph** | ✓ | ✓ | A, B | 현재 커버리지 양호. ralph-stop.sh의 30회 가드를 `validate_prompt`에 명시 |

### 3.4 Verification (3개)

| Skill | validate | tools | Themes | 즉시 액션 |
|-------|:--------:|:-----:|--------|-----------|
| **qa** | ✓ | ✓ | C | 현재 커버리지 양호. Theme C: 테스트 환경 fail-fast 확인 |
| **check** | ✗ | ✗ | — | (1) `validate_prompt`: PASS/WARN/FAIL 출력 형식 + rule update 시 적용 조건 명시 (2) `allowed-tools` 명시 |
| **skill-session-analyzer** | ✗ | ✓ | A, E | (1) `validate_prompt`: 분석 보고서 필수 섹션(요약/이슈/개선/메트릭) 명시 (2) Theme E: 동일 session 재분석 시 캐시 |

### 3.5 Research (6개)

| Skill | validate | tools | Themes | 즉시 액션 |
|-------|:--------:|:-----:|--------|-----------|
| **browser-work** | ✗ | ✗ | C | (1) `allowed-tools` 명시 (2) `validate_prompt`: guide 파일 필수 섹션 + cleanup 완료 조건 (3) Theme C: chromux 가용성 사전 확인 |
| **google-search** | ✗ | ✗ | C, E | (1) `allowed-tools` 명시 (2) `validate_prompt`: source/citation/visited URL 모두 기록 (3) Theme E: 동일 query 재실행 시 캐시 |
| **deep-research** | ✗ | ✗ | A, C, E | (1) `allowed-tools` 명시 (2) `validate_prompt`: cited report 필수 섹션 — sources, methodology, findings, citations (3) Theme A: 병렬 subagent 결과 즉시 flush (4) Theme E: 캐시 |
| **dev-scan** | ✗ | ✗ | C, E, F | (1) `allowed-tools` 명시 (2) `validate_prompt`: sentiment + source coverage 조건 (3) Theme F: sentiment 추출 시 신뢰도 표기 |
| **reference-seek** | ✓ | ✗ | E | (1) `allowed-tools` 명시 (2) Theme E: 동일 query 재탐색 캐시 |
| **analyze-oss** | ✓ | ✗ | E, F | (1) `allowed-tools` 명시 (2) Theme F: What/Why/Who 분류 시 신뢰도 표기 (3) Theme E: 동일 OSS 재분석 캐시 |

### 3.6 Decision / Delivery (3개)

| Skill | validate | tools | Themes | 즉시 액션 |
|-------|:--------:|:-----:|--------|-----------|
| **tech-decision** | ✗ | ✗ | F | (1) `validate_prompt`: 비교 항목/평가 축/recommendation 명시 (2) `allowed-tools` 명시 (3) Theme F: A vs B 분기 시 신뢰도 표기 |
| **issue** | ✓ | △ | — | (1) `allowed_tools`를 canonical `allowed-tools`로 정규화 (2) `validate_prompt`에 "preview shown before gh issue create" 조건 추가 권장 |
| **compound** | ✗ | ✓ | A | (1) `validate_prompt`: 저장 파일 경로 + 요약 섹션 필수 조건 (2) Theme A: learnings 추출 결과 즉시 flush |

---

## 4. 우선순위 요약 (실행 권장 순서)

### Tier 1 — Core pipeline 의 검증 공백 (즉시 권장, 5건)

원천 문서가 명시한 "Core pipeline"이면서 `validate_prompt`가 비어 있는 항목은 회귀 위험이 가장 높다.

1. **specify** — 이번 리뷰의 주제 자체. `validate_prompt`로 cross-check.md/qa-log.md/Open Decisions 섹션을 고정해 향후 재발 방지
2. **blueprint** — `plan.json` + `contracts.md` + `design.md` 3종 동시 산출인데 검증 없음
3. **knowledge** — KB 무결성(commit_sha, dedup, schema) 검증 없음
4. **spec-review** — 동기화 cascade가 깨지면 specify→blueprint 흐름 전체에 영향
5. **ultrawork** — chained pipeline 자체에 stage gate 없음

### Tier 2 — tool policy 표준화 / 누락 해결 (3건)

tool policy가 없거나 non-canonical key를 쓰는 항목이다. 런타임이 `allowed_tools`를 허용하더라도 문서와 대부분의 스킬은 `allowed-tools`를 기준으로 설명하므로 표준화를 권장한다.

- **bugfix** (`allowed_tools` → `allowed-tools` 정규화)
- **browser-work** (`allowed-tools` 추가)
- **issue** (`allowed_tools` → `allowed-tools` 정규화)

이 3건을 처리하면 canonical `allowed-tools` coverage가 15/27 → 18/27로 올라간다.

### Tier 3 — Research 스킬군의 권한/검증 일괄 강화 (6건)

`browser-work`, `google-search`, `deep-research`, `dev-scan`, `reference-seek`, `analyze-oss` — 외부 IO를 수행하지만 `allowed-tools`/`validate_prompt`가 모두 비거나 부분적임. 일괄 템플릿 적용으로 최저 비용으로 정비 가능.

### Tier 4 — 보조 스킬의 점진적 정비 (5건)

- **scaffold**, **skill-session-analyzer**, **check**, **compound**, **tech-decision** — 사용 빈도가 낮거나 영향 범위가 제한적이지만 일관성을 위해 추가 권장

---

## 5. 실행 백로그

| ID | 우선순위 | 대상 | 변경 | 기대 효과 |
|----|----------|------|------|-----------|
| B-01 | P1 | `specify` | `validate_prompt` 추가: `qa-log.md`, `reqs-*.md`, `cross-check.md`, final `requirements.md`, `Open Decisions` 형식 검증 | 이번 리뷰에서 고친 회귀를 자동 감지 |
| B-02 | P1 | `blueprint` | `validate_prompt` + `allowed-tools` 추가. `plan.json validate`, `contracts.md`, 9-section `design.md` 조건 고정 | downstream `/execute` 입력 품질 보장 |
| B-03 | P1 | `knowledge` | scan/update/delete/list/status별 `validate_prompt` 추가 | KB 무결성, commit_sha/source.path 규칙 회귀 방지 |
| B-04 | P1 | `spec-review` | cascade sync 검증 `validate_prompt` 추가, `hoyeon-cli plan validate` 조건 명시 | gate 밖 문서 수정 시 requirements/plan/design drift 방지 |
| B-05 | P1 | `ultrawork` | stage별 completion marker와 circuit breaker를 `validate_prompt`로 고정 | chained pipeline 중간 실패/무한 진행 방지 |
| B-06 | P2 | `bugfix`, `issue` | `allowed_tools`를 `allowed-tools`로 정규화 | frontmatter convention 일관화 |
| B-07 | P2 | `browser-work` | `allowed-tools` + guide-file `validate_prompt` 추가 | browser automation 실패 시 재현/복구 가능성 개선 |
| B-08 | P2 | `google-search`, `deep-research`, `dev-scan` | research skill 공통 `allowed-tools`/`validate_prompt` 템플릿 적용 | 외부 IO 권한 명시, source coverage 검증 |
| B-09 | P2 | `reference-seek`, `analyze-oss` | `allowed-tools` 추가, cache/re-run 규칙 추가 | 반복 리서치 비용 감소 |
| B-10 | P3 | `check`, `compound`, `tech-decision`, `skill-session-analyzer`, `scaffold` | 각 산출물 필수 섹션 중심 `validate_prompt` 추가 | 보조 스킬 출력 품질 균일화 |

---

## 6. 권장 액션 플랜 (Sprint-level)

| Sprint | 범위 | 산출물 |
|--------|------|--------|
| S1 (1주) | Tier 1 5개 스킬에 `validate_prompt` 추가 | 5개 SKILL.md 수정 PR + `validate-output.sh` 동작 검증 |
| S2 (1주) | Tier 2 tool policy 3건 해결 + Tier 3 Research 6개 일괄 | `allowed-tools` 템플릿 정의 + 적용 |
| S3 (지속) | Theme A/B/E 일반화 패턴을 SKILL.md 작성 가이드(`docs/harness/00_skill-architecture-understanding.md` 또는 별도 SKILL_TEMPLATE.md)에 흡수 | 신규 스킬 작성 시 자동 적용되도록 가이드 갱신 |

---

## 7. 부록 — 현재 상태 검증 결과

원천 문서 §"전체 스킬 인벤토리"의 `validate_prompt` / `Tool policy` 칼럼을 현재 frontmatter grep과 대조한 결과.

### 7.1 Coverage Summary

| 항목 | 개수 | 비율 | 비고 |
|------|-----:|-----:|------|
| `validate_prompt` 있음 | 13/27 | 48% | 자동 출력 검증 리마인더 대상 |
| canonical `allowed-tools` 있음 | 15/27 | 56% | 표준 frontmatter key |
| non-canonical `allowed_tools` 있음 | 2/27 | 7% | `bugfix`, `issue` |
| tool policy 없음 | 10/27 | 37% | 주로 research/decision 계열 |

### 7.2 Standardization Findings

| Skill | 현재 상태 | 권장 조치 |
|-------|-----------|-----------|
| `bugfix` | `allowed_tools` 사용 | `allowed-tools`로 key rename |
| `issue` | `allowed_tools` 사용 | `allowed-tools`로 key rename |
| `browser-work` | tool policy 없음 | `allowed-tools` 추가 |

(`validate_prompt` 칼럼은 27건 모두 현재 상태와 일치)

---

## 변경 이력
- 2026-04-29: 최초 작성. 원천 문서 12_specify-pipeline-review.md (2026-04-28 작성, 2026-04-29 SKILL.md 동기화)를 기반으로 27개 스킬 전체에 mapping.
- 2026-04-29: `allowed_tools`/`allowed-tools` 표기 차이를 반영해 coverage와 우선순위 정정. 실행 백로그 추가.
