---
name: specify
description: |
  Turn a goal into an implementation plan (spec.json v1).
  Simplified layer chain: L0:Goal → L1:Context → L2:Decisions → L3:Requirements → L4:Tasks.
  No reviewer agents, no verify fields. Evidence-based clarity scoring at L2.
  CLI validates schema+coverage at each layer. User approves at L2, L3, L4.
  Use when: "/specify", "specify", "plan this"
allowed-tools:
  - Read
  - Grep
  - Glob
  - Task
  - Bash
  - Write
  - AskUserQuestion
---

# /specify — Spec Generator

Generate a spec.json (v1 schema) through a structured derivation chain.
Each layer builds on the previous — no skipping, no out-of-order merges.

Before starting, run `sr-harness-cli spec guide full --schema v1` to see the complete schema.

---

## Core Rules

1. **CLI is the writer** — `spec init`, `spec merge`, `spec validate`. Never hand-write spec.json.
2. **Stdin merge** — Pass JSON via heredoc stdin. No temp files.
   ```bash
   sr-harness-cli spec merge .sr-harness/specs/{name}/spec.json --stdin << 'EOF'
   {"context": {"decisions": [...]}}
   EOF
   ```
3. **Guide before merge** — Run `sr-harness-cli spec guide <section> --schema v1` before constructing JSON. Guide output is the source of truth.
4. **Validate at layer transitions** — `sr-harness-cli spec validate .sr-harness/specs/{name}/spec.json` once per layer (before advancing), not after every merge.
5. **One merge per section** — Never merge multiple sections in parallel.
6. **Merge failure** — Read error → run guide → fix JSON → retry (max 2). Don't retry with same JSON.
7. **--append for arrays** — When adding to existing arrays (decisions). **No flag** for first-time writes.
8. **Revision Merge Protocol** — When user selects "Revise" at an approval gate:
   - **Modify existing item** (e.g. update D3's rationale) → `--patch`
   - **Add new item** (e.g. add D5) → `--append`
   - **Remove + rewrite entire section** → no flag (intentional full replace)
   - **NEVER** use no-flag merge with a subset of items — this silently replaces the entire array.

---

## Document Rendering Protocol

At each approval gate (L2, L3, L4), generate human-readable design documents from spec.json.
**spec.json is the Single Source of Truth. Documents are rendered views — never edit documents directly.**

### Document Location

```
.sr-harness/specs/{name}/
├── spec.json              ← SSoT (existing)
├── requirements.md        ← Generated at L3, updated at L4
├── design.md              ← Generated at L2 (partial), grown at L3/L4 (full 9-section)
└── tasks.md               ← Generated at L4
```

### Rendering Schedule

| Gate | Documents generated/updated | design.md sections |
|------|---------------------------|-------------------|
| L2 | design.md (partial) + requirements.md (initial) | §1 시스템 개요, §2 아키텍처 (초안), §6 핵심 설계 결정 |
| L3 | requirements.md (full) + design.md (updated) | + §3 주요 엔티티, §4 주요 기능 상세 |
| L4 | tasks.md (new) + design.md (complete) | + §5 시퀀스 다이어그램, §7 API 요약, §8 테스트 구조, §9 확장 포인트 |

### design.md 9-Section Standard (from brainstorming skill)

| # | Section | Required | Content |
|---|---------|:--------:|---------|
| 1 | 시스템 개요 | ✓ | 목적 2-3문장 + 기술 스택 표 (`| 분류 | 기술 | 용도 |`) |
| 2 | 아키텍처 | ✓ | **3관점 필수**: 2.1 배포 구조 (ASCII + 표), 2.2 정적 구조 (모듈 관계도 + 역할 표), 2.3 동적 흐름 (경로별 도식 + 비교표) |
| 3 | 주요 엔티티 | ✓ | 데이터 모델 표, 상태, 열거형, 스키마, 설정, 예외 |
| 4 | 주요 기능 상세 | ✓ | 기능별 섹션: 엔드포인트, JSON 예시, 처리 흐름 ASCII, 알고리즘, 분기 |
| 5 | 시퀀스 다이어그램 | ✓ | Mermaid/ASCII, **실제 파일/클래스명 사용** (추상 이름 금지) |
| 6 | 핵심 설계 결정 | ✓ | 결정별 섹션: 무엇을 + 왜(대안 대비) + 코드 예시 |
| 7 | API 엔드포인트 요약 | - | 전체 엔드포인트 표 |
| 8 | 테스트 구조 | - | 테스트 파일별 표 + 격리 전략 |
| 9 | 확장 포인트 | - | 미구현 기능의 구체적 추가 방법 |

### Writing Principles (mandatory)

1. 도해만 그리지 않음 → 반드시 **구체적 설명(표/산문)** 동반
2. ASCII 도해 기본, Mermaid는 복잡한 시퀀스에만 사용
3. 추상적 설명 금지 → 실제 파일명, 함수명, 클래스명, 필드명 사용
4. 요청/응답은 실제 JSON 예시 포함
5. 설계 문서이므로 구현 세부사항(코드 스니펫)까지 기술
6. 각 다이어그램에 설명 표 동반

### Rendering ≠ Copying

spec.json provides the skeleton (what decisions were made, what requirements exist).
Documents must **generate** rich design content from that skeleton:
- `decisions[].answer: "JWT"` → §6: JWT vs alternatives comparison + rationale + code example
- `requirements[].behavior` → §4: endpoint URL, JSON request/response, processing flow ASCII
- `tasks[].depends_on` → §5: sequence diagram with real file names
- `context.research` → §2: 3-perspective architecture diagrams

### ID Visibility Rule

All documents must display spec.json IDs (D1, R1, R1.1, T1) for reverse mapping.
When user says "R2.3을 수정해줘", map to `spec.json requirements[1].sub[2]` → `--patch` → re-render.

### Revision via Document Review

At each gate, users review the **rendered documents** (not raw spec.json).
Revision loop:
1. User points to a document section (e.g., "§6의 D3 근거가 약해")
2. Map to spec.json field → modify via `--patch` or `--append`
3. Re-render affected document sections
4. Re-present for review
5. Repeat until approved

---

## Layer Flow

Execute layers sequentially. Read each reference file just-in-time.

| Layer | Read File | What | Gate |
|-------|-----------|------|------|
| L0 | `${baseDir}/references/L0-L1-context.md` | Mirror → confirmed_goal, non_goals → **Product/Module/ROS selection** | User confirms mirror + selection |
| L1 | (same file) | Knowledge DB load → Codebase research → context.research | Auto-advance |
| L2 | `${baseDir}/references/L2-decisions.md` | Interview → decisions + constraints (profile-based checkpoints) | CLI validate + L2-reviewer + User approval |
| L3 | `${baseDir}/references/L3-requirements.md` | Derive requirements + sub from decisions (module-specific boundary patterns) | CLI validate + User approval |
| L4 | `${baseDir}/references/L4-tasks.md` | Derive tasks + external_deps, Plan Summary | CLI validate + User approval |

### Session Init (before L0)

```bash
sr-harness-cli spec init {name} --goal "{goal}" --type dev --schema v1 --interaction {interaction} \
  .sr-harness/specs/{name}/spec.json
```

`{name}` = kebab-case from goal. `{interaction}` = interactive (default) or autopilot (with `--autopilot` flag).

```bash
SESSION_ID="[from UserPromptSubmit hook]"
sr-harness-cli session set --sid $SESSION_ID --spec ".sr-harness/specs/{name}/spec.json"
```

---

## User Approval Protocol

Three approval gates (L2, L3, L4). Each follows this pattern:

### Gate Sequence

1. **CLI validate** — `sr-harness-cli spec validate`
2. **Render documents** — Generate/update design.md, requirements.md, tasks.md per Rendering Schedule
3. **Present documents** — Show the rendered markdown documents to user (not raw spec.json)
4. **Ask for approval** — User reviews the documents

```
AskUserQuestion(
  question: "설계 문서를 검토해주세요. 진행할까요?",
  options: [
    { label: "Approve", description: "Looks good — proceed to next layer" },
    { label: "Revise", description: "I want to change something in the documents" },
    { label: "Abort", description: "Stop specification" }
  ]
)
```

- **Approve** → advance to next layer
- **Revise** → user points to document sections → map to spec.json → modify → re-render → re-present (loop until approved)
- **Abort** → stop

Autopilot mode: skip user approval (except Plan Summary at L4). Documents are still generated.

---

## Checklist Before Stopping

- [ ] spec.json at `.sr-harness/specs/{name}/spec.json`
- [ ] `sr-harness-cli spec validate` passes
- [ ] `context.confirmed_goal` populated
- [ ] `meta.non_goals` populated (empty `[]` if none)
- [ ] `context.decisions[]` populated
- [ ] Every requirement has at least 1 sub-requirement
- [ ] Every task has `fulfills[]`
- [ ] **design.md** at `.sr-harness/specs/{name}/design.md` — 9 sections complete
- [ ] **requirements.md** at `.sr-harness/specs/{name}/requirements.md`
- [ ] **tasks.md** at `.sr-harness/specs/{name}/tasks.md`
- [ ] Plan Summary presented to user
- [ ] `meta.approved_by` and `meta.approved_at` written after approval
