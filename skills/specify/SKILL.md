---
name: specify
description: |
  Layer-based spec generator (L0-L5 derivation chain) outputting unified spec.json v5 via cli.
  Layer sequence: Goal→Context→Decisions→Requirements+Sub-requirements→Tasks→Review.
  Each layer has a merge checkpoint and a gate (spec coverage + step-back gate-keeper).
  Mode support: interactive/autopilot. Optional: --workshop for 3-agent L3 workshop.
  Use when: "/specify", "specify", "plan this", "계획 짜줘", "스펙 만들어줘"
allowed-tools:
  - Read
  - Grep
  - Glob
  - Task
  - Bash
  - Write
  - AskUserQuestion
  - SendMessage
  - TeamCreate
validate_prompt: |
  Must produce a valid spec.json that passes both hoyeon-cli spec validate and hoyeon-cli spec check.
  spec.json must include: meta.mode, context.research (per spec guide context), tasks with acceptance_criteria,
  requirements with sub-requirements, context.confirmed_goal.
  Must include: constraints, external_dependencies, meta.non_goals.
  SKILL.md must have exactly 6 sections starting with "## L0:" through "## L5:".
  Output files must be in .dev/specs/{name}/ directory.
---

# /specify — Layer-Based Spec Generator (spec.json v5)

Generate a schema-validated, machine-executable spec.json through a structured derivation chain.
Layer structure: **Goal → Context → Decisions → Requirements+Sub-requirements → Tasks → Review**.
Each layer builds on the previous — no skipping, no out-of-order merges.

---

## Core Principles

### Foundational (existing)

1. **cli is the writer** — Never hand-write spec.json. Use `spec init`, `spec merge`, `spec task`
2. **Validate on every write** — `spec merge` auto-validates. Errors caught immediately
3. **Mode-aware** — Depth and interaction control agent count and user involvement
4. **Incremental build** — spec.json evolves from v0 (meta only) to final (all sections)
5. **Layers gate progress** — L2~L4 have spec coverage check + step-back gate-keeper review. L0 uses mirror confirmation, L1 auto-advances after merge.
6. **No intermediate files** — No DRAFT.md. spec.json IS the draft until finalized

### Architectural

These principles guide reference file design. They do NOT override the core layer behaviors defined in v1.

---

## Mode Selection

### Flag Parsing

| Flag | Effect | Default |
|------|--------|---------|
| `--workshop` | Enable 3-agent L3 workshop (L3-user-advocate, L3-requirement-writer, L3-devil's-advocate) | Off (orchestrator derives sub-requirements directly) |
| `--autopilot` | `{interaction}` = autopilot | `{interaction}` = interactive |
| `--interactive` | `{interaction}` = interactive | (default) |

### Merge JSON Passing Convention

All `spec merge --json '...'` examples below show JSON inline for readability. In practice, **always use file-based passing** to avoid zsh shell escaping issues:
```bash
cat > /tmp/spec-merge.json << 'EOF'
{ "meta": { "non_goals": ["...", "..."] } }
EOF
hoyeon-cli spec merge .dev/specs/{name}/spec.json --json "$(cat /tmp/spec-merge.json)" && rm /tmp/spec-merge.json
```
Also: **always run `hoyeon-cli spec guide <section>` before constructing merge JSON** to verify field names and types.

### Mandatory Merge Protocol

Every `spec merge` call MUST follow this 5-step sequence. No exceptions, no shortcuts.

```
STEP 1: GUIDE  — Run `hoyeon-cli spec guide <section>` and READ the output
STEP 2: CONSTRUCT — Build JSON matching the guide's field names and types EXACTLY
STEP 3: WRITE  — Write JSON to /tmp/spec-merge.json via heredoc (<< 'EOF')
STEP 4: MERGE  — Run `hoyeon-cli spec merge ... --json "$(cat /tmp/spec-merge.json)" && rm /tmp/spec-merge.json`
STEP 5: VERIFY — Run `hoyeon-cli spec validate .dev/specs/{name}/spec.json` to confirm state is valid
```

**CRITICAL: guide output is the SINGLE SOURCE OF TRUTH for field types.** If any example in this file conflicts with `spec guide` output, the guide wins. Do NOT construct JSON from memory — always copy field names and types from the guide output.

**Common type mistakes** (from real session failures — these cause 90% of merge rejections):

| Field | WRONG | CORRECT | How to verify |
|-------|-------|---------|---------------|
| `verify` | `"npm test"` (string) | `{"type": "command", "run": "npm test"}` (object) | `spec guide verify` |
| `source` | `"D1"` (string) | `{"type": "decision", "ref": "D1"}` (object) | `spec guide requirements` |
| `checks[]` | `["npm run build"]` (string array) | `[{"type": "build", "run": "npm run build"}]` (object array) | `spec guide acceptance-criteria` |
| `research` | object with wrong shape | Check guide: `string \| {researchFindings}` — shape varies by schema version | `spec guide context` |
| `source.ref` | `"CRUD"` (free text) | Must reference an existing decision ID (e.g., `"D1"`) | `spec guide requirements` |
### Schema Version Integrity

**Never change `schema_version` after `spec init`.** The version set by `spec init` determines which schema is used for all subsequent validations. Changing it mid-spec breaks all previously merged sections.

- After `spec init`, read the created spec.json to confirm which `schema_version` was set
- All `spec guide` output reflects the CLI's default schema — if guide output contradicts what validate accepts, the spec's `schema_version` governs
- If you need a different schema version, re-run `spec init` with the correct version flag — do NOT patch `meta.schema_version` via merge

### Sequential CLI Validation

**Never run `spec validate`, `spec check`, `spec coverage`, or `spec plan` in parallel.** When one fails, parallel siblings are auto-cancelled — inflating failure count and losing error details.

Always chain validation commands sequentially:
```bash
# CORRECT: sequential chain — each command runs only if previous succeeds
hoyeon-cli spec validate .dev/specs/{name}/spec.json && \
hoyeon-cli spec check .dev/specs/{name}/spec.json && \
hoyeon-cli spec coverage .dev/specs/{name}/spec.json

# WRONG: parallel calls — if validate fails, check and coverage are cancelled with no output
# (three separate Bash tool calls for validate, check, coverage)
```

### Merge Failure Recovery

When `spec merge` returns non-zero exit code, follow this exact sequence:

```
1. READ the error message — identify which field/type failed
2. RUN `hoyeon-cli spec guide <failed-section>` — get the correct schema
3. DIFF your JSON against the guide output — find the type mismatch
4. FIX the JSON — correct types, add missing required fields
5. RETRY merge (max 2 retries per merge call)
6. IF still failing after 2 retries → HALT and show error to user
```

**Do NOT:**
- Retry with the same JSON hoping for a different result
- Skip the guide lookup and guess the fix
- Continue to the next layer while current merge is broken
- Batch-fix multiple sections at once (fix one at a time)

### Interaction Defaults

Default is `interactive`. Use `--autopilot` to skip user prompts (except HIGH risk items).

### Autopilot Decision Rules

| Decision Point | Rule |
|----------------|------|
| Tech choices | Use existing stack; prefer patterns in codebase |
| Trade-off questions | Choose lower-risk, simpler option |
| Ambiguous scope | Interpret narrowly (minimum viable) |
| HIGH risk items | HALT and ask user (override autopilot) |
| Missing info | Assume standard approach; log in assumptions |

---

## Session Initialization

### spec init

```bash
hoyeon-cli spec init {name} --goal "{goal}" --type dev --interaction {interaction} \
  .dev/specs/{name}/spec.json
```

**Naming**: `{name}` = kebab-case, derived from goal (e.g., "fix-login-bug", "add-auth-middleware").

Output: minimal spec.json with `meta` + placeholder `tasks`.

Immediately update session state with the spec path:

```bash
SESSION_ID="[session ID from UserPromptSubmit hook]"
hoyeon-cli session set --sid $SESSION_ID --spec ".dev/specs/{name}/spec.json"
```

> **Merge JSON Passing Convention**: All `spec merge --json '...'` examples below show JSON inline for readability. In practice, **always use file-based passing** to avoid zsh shell escaping issues:
> ```bash
> cat > /tmp/spec-merge.json << 'EOF'
> { "meta": { "non_goals": ["...", "..."] } }
> EOF
> hoyeon-cli spec merge .dev/specs/{name}/spec.json --json "$(cat /tmp/spec-merge.json)" && rm /tmp/spec-merge.json
> ```
> Also: **always run `hoyeon-cli spec guide <section>` before constructing merge JSON** to verify field names and types.

### Team Mode Setup

After spec init, spawn the team. The team size depends on whether `--workshop` is used.

```
TeamCreate("specify-session")
```

**Teammates:**

| Name | Role | Active During | Spawn Prompt Focus | Required |
|------|------|---------------|--------------------|----------|
| **gate-keeper** | Layer-transition reviewer | L2~L4 gate | Check for DRIFT, GAP, CONFLICT, BACKTRACK + information sufficiency (EXTERNAL_REF_UNVERIFIED, CODEBASE_CLAIM_UNVERIFIED, ASSUMPTION_LOAD). Return PASS or REVIEW_NEEDED with numbered items. Read-only: use Read, Grep, Glob only. Do NOT write files, run Bash, or create Tasks. | Always |
| **L3-user-advocate** | User journey mapper + priority judge | L3 (--workshop only) | From decisions, derive user personas and their journeys. For every screen/feature, enumerate ALL reachability paths. Judge gap severity from user perspective. | `--workshop` only |
| **L3-requirement-writer** | Requirements + sub-requirements author | L3 (--workshop only) | Receive user journeys from L3-user-advocate. Structure into formal Requirements + Sub-requirements. Output structured JSON with requirements[] and sub[]. | `--workshop` only |
| **L3-devil's-advocate** | Adversarial completeness tester | L3 (--workshop only) | Attack requirements: find missing paths, contradictions, impossible assumptions. Return PASS or GAPS with specific issues. | `--workshop` only |

> All teammates are general-purpose agents. Specialization is defined entirely through spawn prompts.
> L3 agents (when spawned) are idle during L0~L2 and L4~L5. Pre-spawned because TeamCreate can only be called once.

**Teammate lifecycle (without --workshop — default):**
- L0~L1: gate-keeper idle (L0 uses mirror confirmation, L1 auto-advances after merge)
- L2: gate-keeper active
- L3: gate-keeper active; orchestrator derives sub-requirements directly (no L3 agents)
- L4~L5: gate-keeper only

**Teammate lifecycle (with --workshop):**
- L0~L1: all teammates idle (L0 uses mirror confirmation, L1 auto-advances after merge)
- L2: gate-keeper active, L3 agents idle
- L3: all 4 active
- L3 complete → shutdown L3 agents via `SendMessage(to="L3-user-advocate", message={type: "shutdown_request"})` (repeat for L3-requirement-writer and L3-devil's-advocate). Gate-keeper excluded.
- L4~L5: gate-keeper only

**gate-keeper return contract:**
- `PASS` — layer transition proceeds
- `REVIEW_NEEDED` + numbered items — orchestrator classifies each as DRIFT/GAP/CONFLICT/BACKTRACK and routes accordingly. Gate-keeper does NOT return these types directly.

**gate-keeper information sufficiency checks:**
- `EXTERNAL_REF_UNVERIFIED` — spec references external API with behavioral claims but no verification evidence
- `CODEBASE_CLAIM_UNVERIFIED` — spec references existing code patterns without evidence from L1 research
- `ASSUMPTION_LOAD` — 3+ unverified assumptions about external systems accumulated in the current layer

### Intent Classification (internal, not merged)

After `spec init`, classify the task intent internally to guide layer execution:

| Intent Type | Keywords | Strategy |
|-------------|----------|----------|
| **Refactoring** | "refactoring", "cleanup", "improve", "migrate" | Safety first, regression prevention |
| **New Feature** | "add", "new", "implement" | Pattern exploration, integration points |
| **Bug Fix** | "bug", "error", "broken", "fix" | Reproduce → Root cause → Fix |
| **Architecture** | "design", "structure", "architecture" | Trade-off analysis |
| **Research** | "investigate", "analyze", "understand" | Investigation only, NO implementation |
| **Migration** | "migration", "upgrade", "transition" | Phased approach, rollback plan, infra interview |
| **Infrastructure** | "infra", "database", "deploy", "server" | Infra interview, pre/post-work, constraints |
| **Performance** | "performance", "optimize", "slow" | Measure first, profile → optimize |

Do NOT merge intent_classification into spec.json (not in schema).

---

## Gate Protocol

Each layer ends with a gate before advancing to the next layer.

### Gate Steps (standard mode)

1. Run `hoyeon-cli spec coverage .dev/specs/{name}/spec.json --layer {layer}` (if applicable)
2. Check exit code — non-zero blocks advancement
3. Send layer artifacts to gate-keeper via SendMessage
4. Gate-keeper returns PASS or REVIEW_NEEDED (with items for user confirmation)

### Gate Failure Handling

> **Mode Gate**: Quick — no gates, no SendMessage. Auto-advance after merge.

When a gate fails:

```
AskUserQuestion(
  question: "Step-back review found items to confirm before advancing:",
  header: "Gate Review at L{n}",
  options: [
    { label: "Apply suggested fix", description: "Apply the gate-keeper's recommendation" },
    { label: "Provide correction", description: "I'll describe the correction needed" },
    { label: "Force proceed (skip gate)", description: "Accept current state and advance" },
    { label: "Abort", description: "Stop specification process" }
  ]
)
```

After user provides correction → re-run gate (both coverage check and step-back). Max 3 retries per gate. After 3 failures, always present force-proceed and abort options.

**Failure type routing:**
- `STRUCTURAL` — auto-fix via spec merge (no user prompt needed), re-run gate
- `DRIFT` — escalate to user (scope has drifted from goal)
- `GAP` — classify further (see below)
- `CONFLICT` — escalate to user (contradictory decisions or requirements)
- `BACKTRACK` — escalate to user (decision gap found in L3 → must go back to L2)

**GAP sub-classification and research dispatch:**

When gate-keeper returns GAP items, orchestrator classifies each:

| GAP Subtype | Signal | Action |
|-------------|--------|--------|
| **Decision gap** | Missing user decision or preference | Escalate to user |
| **Research-resolvable (internal)** | GAP mentions codebase patterns, classes, or CODEBASE_CLAIM_UNVERIFIED | Dispatch `code-explorer` Task subagent |
| **Research-resolvable (external)** | GAP mentions external API, library, or EXTERNAL_REF_UNVERIFIED | Dispatch `external-researcher` Task subagent |
| **Unresolvable** | Ambiguous requirement, scope question | Escalate to user |

**Research dispatch protocol:**
1. Orchestrator extracts the specific question from the GAP item
2. Dispatch Task subagent: `Task(subagent_type="code-explorer"|"external-researcher", prompt="Verify: {specific question}. Report findings with source file:line or URL.")`
3. On result: append findings to the current layer's context (do NOT rewrite layer output)
4. Re-run gate with enriched context
5. If re-gate still fails → escalate to user (do NOT dispatch another researcher for the same GAP)

**Circuit breaker:** Max **4 researcher dispatches per entire specify run**. After 4, all subsequent research-resolvable GAPs escalate to user. Track in session state:
```bash
hoyeon-cli session set --sid $SESSION_ID --json '{"research_dispatch_count": N}'
```

---

## Layer Execution

Execute layers sequentially. Read each layer's reference file just-in-time.

| Layer | When to Read | File |
|-------|-------------|------|
| L0+L1 | After session init | `Read: ${baseDir}/references/L0-L1-context.md` |
| L2 | After L1 completes | `Read: ${baseDir}/references/L2-decisions.md` |
| L3 | After L2 gate passes | `Read: ${baseDir}/references/L3-workshop.md` |
| L4 | After L3 gate passes | `Read: ${baseDir}/references/L4-tasks.md` |
| L5 | After L4 gate passes | `Read: ${baseDir}/references/L5-review.md` |

At each layer:
1. Read the reference file
2. Follow instructions in the reference file
3. Apply Gate Protocol
4. Advance to next layer

---

## Rules

- **spec.json is the ONLY output** — no DRAFT.md, no PLAN.md, no state.json
- **Always use cli** — `hoyeon-cli spec init`, `spec merge`, `spec validate`, `spec check`
- **Never hand-write spec.json** — always go through `spec merge` for auto-validation
- **Read guide before EVERY merge** — run `hoyeon-cli spec guide <section>` before constructing merge JSON. **Guide output is the SINGLE SOURCE OF TRUTH** — if any example in this file or your own knowledge conflicts with guide output, the guide wins. Field names, types (especially `verify` which must be an object `{type, run}`, not a string), and allowed properties vary per section. Also run `hoyeon-cli spec guide merge` to choose the right mode. **Never truncate guide output** (`head`, `tail` are forbidden) — always read the full output. Cache mentally per section: once you've read a section's guide in this session, you may skip re-reading for subsequent merges of the same section.
- **Never change schema_version after spec init** — the version set by `spec init` governs all subsequent validations. Patching `meta.schema_version` mid-spec breaks all previously merged sections. If you need a different version, re-run `spec init`.
- **Sequential CLI validation** — never run `spec validate`, `spec check`, `spec coverage`, or `spec plan` as separate parallel Bash calls. When one fails, parallel siblings are auto-cancelled with no error output. Always chain with `&&`: `spec validate && spec check && spec coverage`.
- **File-based JSON passing** — never pass JSON directly as `--json '...'` argument. Always write to `/tmp/spec-merge.json` via heredoc with quoted EOF (`<< 'EOF'`), pass via `--json "$(cat /tmp/spec-merge.json)"`, clean up with `rm /tmp/spec-merge.json`.
- **Merge failure recovery** — when `spec merge` fails: (1) run `hoyeon-cli spec guide <failed-section>`, (2) fix JSON to match schema, (3) retry. Do NOT attempt multiple blind retries.
- **One merge per section** — call `spec merge` once per top-level key. Never merge multiple sections in parallel.
- **Coverage fix: all gaps at once** — when `spec coverage` fails, read the ENTIRE gap list, then fix ALL gaps in a single `--patch` merge. Never fix one gap, re-run coverage, fix the next. This avoids O(n) coverage loops.
- **--append for arrays** — use `--append` when adding to existing arrays (decisions, assumptions, known_gaps)
- **--patch for updates** — use `--patch` when updating specific items by id
- **verify abstraction** — verify fields must describe observable behavior (API contracts, input/output relations), NOT implementation details (file paths, function names, code patterns). Self-check: "If implementation files were renamed, would this verify still hold?"
- **Every task needs must_not_do** — at minimum `["Do not run git commands"]`
- **Every task needs acceptance_criteria** — `checks` (runnable commands). Behavior verification via `fulfills[]` (requirement ID refs)
- **Requirements = single source of truth** — all verification lives in `requirements[].sub[]` with required `verify` fields (type adapts to sandbox capability: command/assertion/instruction)
- **Incremental merge** — merge after every layer and every user response; do not batch
- **confirmed_goal in context** — NEVER move `confirmed_goal` to `meta`
- **gate-keeper** — teammate spawned via TeamCreate, role defined by spawn prompt (not a custom agent file)
- **Team mode members** — disallowed-tools MUST include Task and Skill
- **L3-user-advocate** — teammate for user journey mapping + gap severity judgment (only with `--workshop`; spawned at session start, active during L3, shutdown after L3)
- **L3-requirement-writer** — teammate for requirements + sub-requirements structuring from journeys (only with `--workshop`; spawned at session start, active during L3, shutdown after L3)
- **L3-devil's-advocate** — teammate for adversarial completeness testing + research requests (only with `--workshop`; spawned at session start, active during L3, shutdown after L3)
- **Team mode members** — disallowed-tools MUST include Task and Skill (C3)

---

## Checklist Before Stopping

### Common (all modes)
- [ ] spec.json exists at `.dev/specs/{name}/spec.json`
- [ ] `hoyeon-cli spec validate` passes
- [ ] `hoyeon-cli spec check` passes
- [ ] All tasks have `status: "pending"`
- [ ] All tasks have `must_not_do` and `acceptance_criteria` (`checks`) and `fulfills` (requirement ID refs)
- [ ] All tasks have `inputs` field
- [ ] Every requirement has at least 1 sub-requirement in `sub[]`
- [ ] `context.confirmed_goal` populated (NOT `meta.confirmed_goal`)
- [ ] `meta.non_goals` populated (use empty array `[]` if none)
- [ ] `meta.mode` is set
- [ ] Plan Approval Summary presented (including Breaking Changes scan)
- [ ] Breaking Changes section shows detected signals or "(none detected)"
- [ ] `meta.approved_by` and `meta.approved_at` written after approval

### Always (additional)
- [ ] TeamCreate called at session start with at least gate-keeper
- [ ] Gate-keeper defined via spawn prompt (DRIFT/GAP/CONFLICT/BACKTRACK review, read-only)
- [ ] SendMessage called at each layer gate (L2, L3, L4) — L0 and L1 have no gate-keeper review
- [ ] `context.research` populated (check `spec guide context` for accepted types)
- [ ] AC Quality Gate passed (L5 Step 5)
- [ ] `context.decisions[]` populated from interview
- [ ] `constraints` populated (L2.7 — merge empty array explicitly if none apply)
- [ ] `external_dependencies` populated (L4.5 — merge empty pre_work/post_work explicitly if none apply)
- [ ] plan-reviewer returned OKAY
- [ ] `spec coverage` passes (full chain + per-layer at each transition)

### With --workshop flag (additional)
- [ ] TeamCreate called with 4 teammates: gate-keeper, L3-user-advocate, L3-requirement-writer, L3-devil's-advocate
- [ ] L3 workshop ran (L3-user-advocate → L3-requirement-writer → L3-devil's-advocate, max 3 cycles)
- [ ] L3 agents shutdown after L3 merge (gate-keeper excluded)

### Interactive mode (additional)
- [ ] User explicitly triggered plan generation ("proceed to planning") — not auto-transitioned
- [ ] Plan Approval Summary presented (L5 Step 6)
- [ ] All HIGH risk decision_points resolved with user

### Autopilot mode (overrides)
- [ ] No AskUserQuestion calls (except HIGH risk)
- [ ] All autonomous decisions logged in assumptions
- [ ] Decision Summary logged to spec.json only (not presented to user)
