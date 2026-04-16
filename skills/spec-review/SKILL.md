---
name: spec-review
description: |
  "/spec-review", "spec review", "스펙 리뷰", "문서 리뷰",
  "설계 문서 수정", "spec 수정", "요구사항 수정",
  "design.md 수정해줘", "requirements.md 변경"
  Gate 밖에서 spec.json + 문서 동기화 수정.
  specify 세션 없이도 문서 기반 피드백 → spec.json 수정 → 관련 문서 재렌더링.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

# /spec-review — Gate 밖 문서 동기화 리뷰

specify 세션의 승인 게이트 밖에서도 **문서 기반 피드백 → spec.json 수정 → 관련 문서 재렌더링**을 수행한다.

---

## 왜 필요한가

```
specify 승인 게이트 내:
  "D3 수정해줘" → spec.json patch → 문서 재렌더링 → ✅ 동기화

게이트 밖 (다른 세션, 일반 대화):
  "design.md §4 수정해줘" → md만 수정 → ❌ spec.json 미반영
```

/spec-review는 **언제든지** specify와 동일한 동기화를 제공한다.

---

## 실행 흐름

### Step 1: spec.json 로드

```
1. .sr-harness/specs/ 디렉토리에서 spec 목록 확인
2. spec이 1개 → 자동 로드
3. spec이 2개+ → 사용자에게 선택 질문
```

```
AskUserQuestion(
  question: "리뷰할 spec을 선택해주세요.",
  options: [
    { label: "wheel-controller-uart-refactor", description: "..." },
    { label: "narrow-corridor-navigation", description: "..." }
  ]
)
```

### Step 2: 현재 상태 표시

```
Spec: wheel-controller-uart-refactor
Status: L3 완료 (requirements + design 생성됨, tasks 미생성)

Documents:
  ✅ design.md (§1~§4, §6)
  ✅ requirements.md (R1~R4, 12 sub-requirements)
  ❌ tasks.md (L4 미진행)

Decisions: D1~D5
Requirements: R1~R4 (12 sub-reqs)
```

### Step 3: 피드백 수신 루프

사용자의 자연어 피드백을 받아 처리한다.

```
사용자 피드백 수신
    ↓
피드백 유형 분류:
  ├── Decision 수정     → "D3의 프로토콜을 CAN으로 변경"
  ├── Requirement 수정  → "R2에 타임아웃 에러 케이스 추가"
  ├── Requirement 삭제  → "R3.2 삭제해줘"
  ├── 문서 섹션 수정    → "design.md §4의 시퀀스가 틀렸다"
  └── 일반 보완 요청    → "에러 핸들링이 전체적으로 부족하다"
    ↓
spec.json 매핑 + 수정
    ↓
영향 범위 분석
    ↓
관련 문서 재렌더링
    ↓
갱신된 내용 제시
    ↓
[Continue / Done]
```

### Step 4: spec.json 수정

피드백을 spec.json 필드에 매핑하여 수정:

| 피드백 유형 | spec.json 조작 | CLI 명령 |
|-----------|---------------|---------|
| 기존 항목 수정 | `--patch` | `sr-harness-cli spec merge --stdin --patch` |
| 새 항목 추가 | `--append` | `sr-harness-cli spec merge --stdin --append` |
| 항목 삭제 + 재작성 | no flag (전체 교체) | `sr-harness-cli spec merge --stdin` |

**ID 기반 역추적:**
- "D3" → `context.decisions[2]`
- "R2.3" → `requirements[1].sub[2]`
- "§6" → `context.decisions[]` 전체 (design.md §6 = 설계 결정)
- "§4" → `requirements[]` (design.md §4 = 기능 상세)

### Step 5: 영향 범위 분석 + 재렌더링

수정된 spec.json 필드에서 영향받는 문서를 파악하여 재렌더링:

| 수정 대상 | 영향 문서 |
|----------|---------|
| `decisions[]` 변경 | design.md §6, §1(기술 스택), §2(아키텍처) |
| `requirements[]` 변경 | requirements.md, design.md §3, §4 |
| `requirements[].sub[]` 변경 | requirements.md, design.md §4 |
| `tasks[]` 변경 | tasks.md, design.md §5, §7, §8 |
| `constraints[]` 변경 | design.md §6 |
| `meta.non_goals` 변경 | requirements.md, design.md §9 |

**재렌더링 규칙:**
1. 영향받는 문서의 해당 섹션만 재생성 (전체 재생성 아님)
2. 재생성 시 spec.json의 ID 가시성 규칙 유지 (D1, R1.1 등)
3. 재생성된 섹션을 기존 문서에 반영 (Edit)

### Step 6: 결과 제시

```
## 수정 완료

### spec.json 변경
- D3: answer "UART 115200" → "CAN 250kbps" (--patch)
- D3: rationale 갱신

### 문서 재렌더링
- design.md §6 D3 섹션 재생성
- design.md §2.3 동적 흐름 갱신 (D3 참조)
- requirements.md R2.1, R2.2 갱신 (D3에 연결)

[Continue reviewing / Done]
```

---

## Validate (선택)

재렌더링 후 spec.json 무결성 확인:

```bash
sr-harness-cli spec validate .sr-harness/specs/{name}/spec.json
```

validate 실패 시 사용자에게 보고하고 수정 제안.

---

## 사용 예시

```bash
# 다음 날 design.md를 다시 읽다가 문제 발견
claude "/spec-review"
> "R2.3의 타임아웃 500ms를 300ms로 변경해줘"
# → spec.json patch → requirements.md + design.md §4 재렌더링

# 리뷰 미팅 후 피드백 반영
claude "/spec-review"
> "D5의 ROS2 bridge 대신 직접 REST 호출로 변경"
# → spec.json patch → design.md §2, §6 + requirements.md 재렌더링

# 여러 항목 연속 수정
> "R1에 인증 실패 시 재시도 로직 추가해줘"
# → spec.json append → requirements.md + design.md §4 재렌더링
> "Done"
```

---

## /specify 승인 게이트와의 차이

| | 승인 게이트 (specify 내) | /spec-review |
|--|------------------------|-------------|
| 실행 시점 | L2/L3/L4 완료 직후 | **언제든지** |
| 세션 | specify 세션 안에서만 | 독립 세션 |
| spec.json 동기화 | 자동 | 자동 |
| 문서 재렌더링 | 자동 | 자동 |
| Approve/Abort | 있음 | 없음 (Done만) |
| 다음 레이어 진행 | Approve 시 | 없음 |
