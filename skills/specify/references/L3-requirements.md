## L3: Requirements + Sub-requirements

**Who**: Orchestrator dispatches Task(L3-deriver) → Task(L3-reviewer) sequentially
**Input**: goal + decisions + provisional requirements (as seed)
**Output**: `requirements[]` with source fields + `sub[]` (sub-requirements per requirement)
**Merge**: `spec merge requirements` (atomic, with sub[])
**Gate**: `spec validate --layer requirements` + gate-keeper via SendMessage
**Backtracking**: If decision gap found → AskUserQuestion → spec merge decisions (L2) → re-run L3

### Sandbox Capability Check (before derivation)

Before deriving requirements, check if `context.sandbox_capability` is set in spec.json.
If NOT set → Read `references/sandbox-guide.md` and follow its Phase A (auto-detect) → Phase B (user prompt if needed).
This determines the verify field type for all sub-requirements (command vs assertion vs instruction).

**MUST complete before any sub-requirement derivation begins.**

### L3 Pipeline: Derive → Review (max 3 cycles)

```
Task(L3-deriver) → Task(L3-reviewer)
                        │
                        ├─ PASS → User Approval → gate-keeper
                        │
                        └─ GAPS → orchestrator fix → Task(L3-reviewer)  [cycle 2]
                                                         │
                                                         ├─ PASS → User Approval
                                                         └─ GAPS → orchestrator fix → Task(L3-reviewer)  [cycle 3]
                                                                                          │
                                                                                          ├─ PASS → User Approval
                                                                                          └─ GAPS → ESCALATE to User Approval with remaining gaps
```

- L3-reviewer is called **at most 3 times** (initial + 2 re-reviews)
- Between reviewer calls, **orchestrator fixes GAPS directly** (no deriver re-call)
- After 3rd reviewer call with GAPS → remaining gaps included in User Approval for human decision

### Step 1: Task(L3-deriver) — Derive Requirements

Dispatch a Task subagent to derive requirements from decisions:

```
Task(prompt="
You are L3-deriver. Derive requirements and sub-requirements from the confirmed goal and decisions.

Goal: {confirmed_goal}

Decisions with implications:
{FOR EACH d in context.decisions:
  D{d.id}: {d.decision} — {d.rationale}
  Implications:
  {FOR EACH impl in d.implications (where status=confirmed):
    - [{impl.type}] {impl.implication}
  }
}

Provisional requirements (from interview — use as seed, validate and complete):
{FOR EACH r in provisional_requirements: {r.behavior} ← {r.source}}

Constraints:
{FOR EACH c in constraints:
  C{c.id}: [{c.type}] {c.rule}
}

## Your Task

### Phase 1: User Journeys
1. Identify user personas — who uses this system?
2. For each persona, list their key journeys (step → step → outcome)
3. For EVERY screen/feature/endpoint mentioned in decisions:
   - List ALL reachability paths: navigation click, deep link, URL direct access, back button, redirect, search result
   - Missing reachability paths cause 404s and broken routing
4. Flag any decisions that imply features without clear user-facing behavior

### Phase 2: Requirements from Journeys
- Every user journey path MUST produce at least one requirement or sub-requirement
- Group related journey paths into single requirements
- Convert each confirmed implication into at least one requirement
- If you find missing decisions, output as 'decision_gaps'

### Phase 3: Sub-requirements per Requirement

Apply Adaptive Decomposition:
- **ATOMIC** (single trigger, single outcome, no 'and' joining actions) → exactly 1 sub-req mirroring parent
- **COMPOUND** (multiple actions, input variations, success+failure paths) → decompose:
  1. Happy path behavior
  2. Error/failure behavior
  3. Boundary conditions (empty, max, first-time)
  4. State variations (auth state, data state)

### Behavior Quality Rules

BANNED in behavior text: 'correctly', 'properly', 'works', 'as expected', 'handles' (without specifying what).
REQUIRED: trigger (who/what) + observable outcome.

Examples:
- BAD: 'Login works correctly' → GOOD: 'POST /login with valid credentials → 200 + JWT in body'
- BAD: 'System handles errors' → GOOD: 'POST /login with empty password → 400 + error message'

### Verify Writer Heuristic

Verify is REQUIRED for all sub-requirements. Select type based on capability:
- Observable output + sandbox available → {type: 'command', run: '...', expect: {...}}
- Observable output + no sandbox → {type: 'assertion', checks: [...]}
- Subjective judgment (any capability) → {type: 'instruction', ask: '...'}

### verify Abstraction Rules (MANDATORY)

verify describes OBSERVABLE BEHAVIOR, not implementation details.

Prohibited: file paths, function/class names, code patterns, line numbers, internal variable names.
Allowed: API contracts, input/output relations, behavior properties, UI states.
Self-check: 'If all implementation file names changed, would this verify still be valid?' Yes → correct.

## Output Format

Return JSON:
{
  'decision_gaps': [...],  // missing decisions (if any)
  'requirements': [
    {
      'id': 'R1',
      'behavior': 'observable behavior',
      'priority': 1,
      'source': {'type': 'decision', 'ref': 'D1'},
      'sub': [
        {'id': 'R1.1', 'behavior': '...', 'verify': {...}},
        ...
      ]
    },
    ...
  ]
}
")
```

**If L3-deriver reports decision_gaps** → L3 backtracking:

```
AskUserQuestion(
  question: "L3 deriver found missing decisions needed to finalize requirements. Shall we return to L2?",
  header: "Decision Gap Found",
  options: [
    { label: "Yes, go back to L2", description: "I'll answer the missing decision questions" },
    { label: "Agent decides", description: "Use best judgment and log as assumptions" }
  ]
)
```

If user selects "Yes, go back to L2" → merge additional decisions, then re-run L3.

**L3→L2 backtracking — state cleanup (mandatory):**
1. Clear `provisional_requirements` from session state:
   `hoyeon-cli session set --sid $SESSION_ID --json '{"provisional_requirements": []}'`
2. On re-run: start fresh — do NOT reuse previous L3 output.
3. Requirements merge overwrites entirely (no `--append`, no `--patch`).

### Step 2: Task(L3-reviewer) — Review Requirements (max 3 calls)

After L3-deriver returns requirements, orchestrator merges them into spec.json, then dispatches L3-reviewer:

```
Task(prompt="
You are L3-reviewer. Review these requirements for completeness and quality.
Return PASS or GAPS.

Goal: {confirmed_goal}

Decisions:
{FOR EACH d in context.decisions:
  D{d.id}: {d.decision}
}

Requirements to review:
{merged_requirements_json}

## Attack Checklist

**Reachability completeness:**
- For every screen/feature in requirements: can the user reach it from ALL expected paths?
- Check: navigation click, URL direct access, deep link, back button, redirect, search result
- Missing reachability → GAPS (this is the #1 source of 404s in implementation)

**Requirement completeness:**
- Every decision has at least one requirement tracing back to it
- No requirement is an implementation detail (must be observable behavior)
- Source tracing is correct (goal/decision/implicit with correct ref)

**Sub-requirement coverage:**
- Every requirement has at least 1 sub-requirement
- Sub-requirements together cover the full behavior of the parent requirement
- No sub-requirement is duplicated across requirements
- Atomic requirements (single trigger, single outcome) should have exactly 1 sub-req — do not force-decompose

**Sub-requirement quality:**
- verify fields are at behavior level — not coupled to implementation
- verify.run (if present): executable shell command with concrete expected value
- verify.checks (if present): falsifiable assertions (can be proven wrong)
- verify.ask (if present): actionable step-by-step instructions

**Behavior text quality (BLOCKING):**
- IF behavior contains: 'correctly', 'properly', 'works', 'as expected', 'handles' (without specifying what) → REJECT
- IF behavior lacks a trigger (who/what initiates) OR observable outcome → REJECT
- Worker Legibility check: 'Can a developer who has never seen this codebase know what code to write from this behavior text alone?' No → REJECT

**verify abstraction level (BLOCKING):**
- IF verify references specific file paths → REJECT
- IF verify references function/class names → REJECT
- IF verify contains vague words: 'works', 'correctly', 'properly' → REJECT
- Self-check per sub-requirement: 'If implementation files were renamed, would this verify still hold?' No → REJECT

## Output Protocol

- **PASS**: All checks pass. Return: {verdict: 'PASS'}
- **GAPS**: Issues found. Return: {verdict: 'GAPS', gaps: [{requirement_id: 'R1', issue: '...', severity: 'blocking|warning'}, ...]}
")
```

### Reviewer cycle handling

```
cycle = 1
WHILE cycle <= 3:
  reviewer_result = Task(L3-reviewer with current requirements)

  IF reviewer_result.verdict == "PASS":
    → proceed to User Approval
    BREAK

  IF reviewer_result.verdict == "GAPS":
    IF cycle == 3:
      → ESCALATE: proceed to User Approval with remaining gaps displayed
      BREAK

    # Orchestrator fixes GAPS directly
    FOR EACH gap in reviewer_result.gaps:
      Fix the requirement/sub-requirement in spec.json via spec merge --patch

    cycle += 1
```

> Log each cycle: "L3-reviewer cycle {N}/3: {PASS|GAPS with N issues}"

### Handle suggested_additions

```
IF review.suggested_additions is non-empty:
  AskUserQuestion(
    "The review found behaviors not covered by any requirement. Add these?",
    options: review.suggested_additions
  )
  # Only merge user-approved suggestions as new requirements
```

### Merge requirements (atomic, with sub[])

> **Merge flag**: Use NO flag (default deep-merge) on the first-time write — this replaces the placeholder `requirements[]`.
> On backtrack re-run, still use NO flag — overwrites the entire `requirements[]` array.
> Do NOT use `--append` (would duplicate) or `--patch` (not appropriate for full replacement).

Follow the Mandatory Merge Protocol (SKILL.md):

```bash
# STEP 1: GUIDE (MANDATORY) — check schema before constructing
hoyeon-cli spec guide requirements

# STEP 2+3: CONSTRUCT + WRITE
# ⚠️ source must be {type, ref} OBJECT, not a string
# ⚠️ source.type ENUM: goal|decision|gap|implicit|negative (NOT "implication")
# ⚠️ verify (when present) must be {type, run|checks|ask} OBJECT, not a string
# ⚠️ NEVER truncate guide output (no head/tail) — read the FULL output
cat > /tmp/spec-merge.json << 'EOF'
{
  "requirements": [
    {
      "id": "R1",
      "behavior": "observable behavior statement",
      "priority": 1,
      "source": {"type": "decision", "ref": "D1"},
      "sub": [
        {
          "id": "R1.1",
          "behavior": "concrete testable behavior"
        },
        {
          "id": "R1.2",
          "behavior": "another concrete behavior",
          "verify": {"type": "command", "run": "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/health"}
        }
      ]
    }
  ]
}
EOF

# STEP 4: MERGE (no flag — replaces placeholder)
hoyeon-cli spec merge .dev/specs/{name}/spec.json --json "$(cat /tmp/spec-merge.json)" && rm /tmp/spec-merge.json

# STEP 5: VERIFY
hoyeon-cli spec validate .dev/specs/{name}/spec.json
```

If merge fails → follow Merge Failure Recovery (SKILL.md). Do NOT proceed to L3 gate with a broken merge.

### L3 User Approval (mandatory before gate)

Before running the gate, present ALL requirements and their sub-requirements to the user as **text output first**, then ask for approval.

**Step 1 — Display full details as text output (NOT inside AskUserQuestion):**

Print all requirements with their sub-requirements in full detail. This is regular text output, not a tool call:

```markdown
---
## L3 Requirements & Sub-requirements for Approval

### R1 [P1]: {behavior}
- **R1.1**: {sub-requirement behavior}
- **R1.2**: {sub-requirement behavior}

### R2 [P2]: {behavior}
- **R2.1**: {sub-requirement behavior}
- ...

{repeat for ALL requirements}

**Total: {N} requirements, {M} sub-requirements**
---
```

> Show EVERY requirement and EVERY sub-requirement. Do not summarize or truncate even if the list is long. The user needs to see everything before approving.

**Step 2 — Ask for approval (simple choice only):**

```
AskUserQuestion(
  question: "Review the requirements and sub-requirements above. Ready to proceed?",
  header: "L3 Requirements Approval",
  options: [
    { label: "Approve all", description: "Requirements look good — proceed to L4" },
    { label: "Revise", description: "I want to change, add, or remove requirements" },
    { label: "Challenge", description: "Think harder — what requirements are we missing?" },
    { label: "Abort", description: "Stop specification process" }
  ]
)
```

- **Approve all** → proceed to L3 Gate
- **Revise** → user provides corrections, orchestrator merges changes directly, re-present for approval (loop until approved)
- **Challenge** → orchestrator runs Requirements Completeness Audit (see below), proposes additional requirements, re-present for approval
- **Abort** → stop

#### Requirements Completeness Audit (triggered by "Challenge")

When the user selects "Challenge", the orchestrator self-audits the current requirement set across **two axes**:

##### Axis 1: Breadth — "What entire requirements are missing?"

1. **Decision coverage check** — for each L2 decision, verify at least one requirement traces back to it. Flag orphan decisions (decided but never specified as a requirement).
2. **Negative requirements** — what should the system explicitly NOT do? Look for missing "must not" requirements implied by decisions or constraints.
3. **User journey walk** — mentally walk through the primary user flow end-to-end. Flag any step where behavior is unspecified (e.g., "user lands on page — but what's the empty state?").
4. **Constraint-to-requirement traceability** — for each L2 constraint, is there a requirement whose sub-requirements actually verify it? Flag constraints that no sub-requirement exercises.

##### Axis 2: Depth — "Which existing requirements need richer sub-requirements?"

5. **Sub-requirement coverage** — for each requirement, check that sub-requirements cover: happy path behavior, failure/error handling, and boundary conditions. Flag requirements with only one sub-requirement that doesn't address failures.
6. **State variation scan** — for each requirement, ask: "Does behavior change based on state?" (empty vs populated, first-time vs returning, logged-in vs anonymous, mobile vs desktop). Flag unaddressed state variations.
7. **Concurrency/timing scan** — for each requirement, ask: "What if two users/processes do this simultaneously?" or "What if this happens during a pending operation?" Flag race conditions or timing-dependent behavior left unspecified.

##### Cross-axis check

8. **Cross-requirement conflict check** — look for pairs of requirements that could contradict each other when implemented together.

**Output format** — present findings grouped by axis:

```markdown
## Challenge Results — {N} potential gaps found

### Breadth Gaps (missing requirements)
- D2 decided [X] but no requirement specifies the behavior
- Nothing says what happens when [boundary condition]
- Between R2 and R4, what happens when [transition sub-requirement]?
- C3 (constraint) has no sub-requirement that exercises it

### Depth Gaps (existing requirements need richer sub-requirements)
- R1 only covers happy path — what if [failure behavior]?
- R3: behavior differs for empty state vs populated state? (not specified)
- R2: what if two users submit simultaneously? (not addressed)

### Conflicts
- R1 and R5 may conflict when [situation]
```

Then auto-generate the missing requirements/sub-requirements as proposals — **prioritize breadth gaps first** (a missing requirement is a bigger blind spot than a missing sub-requirement), then depth gaps. Merge them and re-present for approval.

> **Circuit breaker**: Challenge can be selected at most **2 times** per L3 cycle. After 2 rounds, only Approve/Revise/Abort remain.

> This approval is **mandatory** — even in autopilot mode, L3 requirements MUST be user-approved before gate-keeper runs. Requirements are what gets built — wrong requirements = wrong implementation.

### L3 Gate

```bash
hoyeon-cli spec validate .dev/specs/{name}/spec.json
```

Then call gate-keeper via SendMessage with requirements + sub-requirement summary.

**Standard**: Run coverage check + gate-keeper SendMessage. PASS → advance to L4.

If coverage check fails → read the ENTIRE gap list, then fix ALL gaps in a single `--patch` merge. Do NOT fix one gap at a time (causes O(n) coverage loops). Handle per Gate Protocol in SKILL.md.
