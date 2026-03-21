## L4: Tasks

**Who**: Orchestrator
**Output**: `tasks[]` with `fulfills[]` referencing requirement IDs and `acceptance_criteria.checks[]`
**Merge**: `spec merge tasks`
**Gate**: `spec coverage --layer tasks` + gate-keeper via SendMessage

### Task Structure Guidelines

- Task IDs: `T1`, `T2`, ... with final `TF` (type: `verification`)
- **T1 must include dependency install + build verification** when scaffolding a new project.
  Include explicit steps: install dependencies, verify build passes, verify dev server starts.
  T1 acceptance_criteria.checks should include: `{type: "build", run: "npm run build"}` (or pnpm/yarn equivalent).
  This ensures subsequent workers have a working baseline — do NOT assume "scaffold" implicitly means "install + build verified".
- Every task: `must_not_do: ["Do not run git commands"]`
- Every task: `fulfills` (requirement ID refs) + `acceptance_criteria` with `checks` (runnable commands)
- Every task: `inputs` listing dependencies from previous tasks (use task output IDs)
- HIGH risk tasks: include rollback steps in `steps`
- **Migration/Infrastructure intent tasks**: DB migration tasks MUST include:
  - Idempotency check (`IF NOT EXISTS`, `IF EXISTS` patterns)
  - Rollback steps (e.g., "Rollback: DROP COLUMN IF EXISTS embedding")
  - `risk: "medium"` or `"high"` (never "low" for schema changes)
  - Corresponding rollback constraint from L2.7 must be referenced
- **Sub-req load guideline**: If a task's `fulfills[]` references requirements with >10 total sub-requirements combined, consider splitting the task. Workers must report on each sub-req individually — excessive load increases reporting overhead and verification time.
- Map `research.patterns` → `tasks[].references`
- Map `research.commands` → `TF.acceptance_criteria.checks` (type: build/lint/static)
- TF checks MUST always include at minimum: `{type: "build", run: "<build command>"}`. Typecheck and lint are also expected when available.

#### file_scope = hint, not constraint

`file_scope` lists the **most likely files** to be modified based on L1 research. Workers MAY touch additional files discovered during implementation. The field helps workers know where to start, NOT where to stop.

- Write as: `["src/auth/middleware.ts", "src/config/auth.json"]` — likely starting points
- Do NOT write exhaustive lists. Workers will discover additional files from imports, tests, etc.
- If two tasks have overlapping `file_scope`, they MUST have a `depends_on` relationship

#### steps = strategy, not prescription

`steps` describes the **approach and intent** (why), not line-by-line instructions (what). Workers read the actual code and adapt. Steps that are too prescriptive become wrong the moment code differs from expectation.

- Good: `"Add rate limiting middleware to auth endpoints using existing RateLimiter class"`
- Bad: `"Open src/auth/middleware.ts, go to line 42, add import for RateLimiter"`
- Good: `"Write integration tests covering the 3 sub-requirements referenced in acceptance_criteria"`
- Bad: `"Create file tests/auth.test.ts with exactly 3 test cases"`

#### Task Type Field

| Type | Retry on Fail | Edit/Write Tools | Failure Handling |
|------|---------------|------------------|------------------|
| `work` | Up to 2x | Yes | Analyze → Fix Task or halt |
| `verification` | No | Forbidden | Analyze → Fix Task or halt |

#### Acceptance Criteria Structure (v5)

| Field | Required | Description |
|-------|----------|-------------|
| `fulfills` | Yes | Requirement IDs from `requirements[].id` this task fulfills (task-level field, sibling of `id`) |
| `checks` | Yes | Automated checks: `[{type: "static"|"build"|"lint"|"format", run: "<command>"}]` (inside `acceptance_criteria`) |

**Worker completion condition**: All checks pass. Behavior verification via `fulfills[]` → `requirements[].sub[]`

### Merge tasks

> **Merge flag**: Use NO flag (default deep-merge) on first-time write — this replaces the placeholder `tasks[]`.
> On backtrack re-run (L4 re-runs after rejection), use `--patch` to update existing tasks by ID without duplicating.

Follow the Mandatory Merge Protocol (SKILL.md):

```bash
# STEP 1: GUIDE (MANDATORY) — check BOTH schemas before constructing
hoyeon-cli spec guide tasks
hoyeon-cli spec guide acceptance-criteria

# STEP 2+3: CONSTRUCT + WRITE
# ⚠️ checks[] must be [{type, run}] OBJECTS, not ["command"] strings
# ⚠️ every task needs: must_not_do, fulfills (req ID refs), acceptance_criteria (checks), inputs
cat > /tmp/spec-merge.json << 'EOF'
{
  "tasks": [
    {
      "id": "T1",
      "action": "task description",
      "type": "work",
      "status": "pending",
      "risk": "low",
      "file_scope": ["src/example.ts"],
      "steps": ["Approach description (strategy, not prescription)"],
      "inputs": [],
      "must_not_do": ["Do not run git commands"],
      "fulfills": ["R1"],
      "acceptance_criteria": {
        "checks": [{"type": "build", "run": "npm run build"}]
      }
    }
  ]
}
EOF

# STEP 4: MERGE (no flag — replaces placeholder)
hoyeon-cli spec merge .dev/specs/{name}/spec.json --json "$(cat /tmp/spec-merge.json)" && rm /tmp/spec-merge.json

# STEP 5: VERIFY
hoyeon-cli spec validate .dev/specs/{name}/spec.json
```

If merge fails → follow Merge Failure Recovery (SKILL.md). Do NOT proceed to L4.5 with a broken merge.

> Requirements and sub-requirements were confirmed in L3 (by orchestrator directly or via the 3-agent workshop). Do NOT merge requirements again here.

### L4.5: External Dependencies Derivation (non-interactive)

> **Mode Gate**: Quick — SKIP. No external dependencies derived.

After tasks are merged, scan tasks and decisions for actions that happen **outside of code** — things a human or separate process must do before or after `/execute`.

**Detection heuristics** (scan `tasks[].action`, `tasks[].steps`, `context.decisions[]`):

| Signal | Category | Example |
|--------|----------|---------|
| DB extension, migration on managed DB | pre_work | "Enable pgvector on Supabase dashboard" |
| New environment variable, secret, API key | pre_work | "Add GEMINI_API_KEY to Cloud Run env (Terraform)" |
| Infrastructure provisioning | pre_work | "Create S3 bucket", "Enable Cloud Run service" |
| One-time scripts (backfill, data migration) | post_work | "Run backfill-embeddings.ts on production DB" |
| CLI/tool deprecation | post_work | "Mark tools/content-search as deprecated" |
| DNS, CDN, or routing changes | pre_work | "Update CDN origin to new endpoint" |
| Monitoring/alerting setup | post_work | "Add search latency alert to Grafana" |

**Also check:** infra interview seeds from L2 (provisional external_deps in session state).

**Merge external dependencies.** Follow the Mandatory Merge Protocol (SKILL.md):

```bash
# STEP 1: GUIDE (MANDATORY)
hoyeon-cli spec guide external

# STEP 2+3: CONSTRUCT + WRITE
cat > /tmp/spec-merge.json << 'EOF'
{
  "external_dependencies": {
    "pre_work": [
      {"action": "Enable pgvector extension on Supabase", "owner": "human", "blocking": true}
    ],
    "post_work": [
      {"action": "Run backfill script: npx ts-node scripts/backfill-embeddings.ts", "owner": "human", "blocking": false}
    ]
  }
}
EOF

# STEP 4: MERGE
hoyeon-cli spec merge .dev/specs/{name}/spec.json --json "$(cat /tmp/spec-merge.json)" && rm /tmp/spec-merge.json

# STEP 5: VERIFY
hoyeon-cli spec validate .dev/specs/{name}/spec.json
```

If merge fails → follow Merge Failure Recovery (SKILL.md).

> If no external dependencies detected, merge `"external_dependencies": {"pre_work": [], "post_work": []}` explicitly. An empty section is better than a missing one.

**Migration/Infrastructure intent auto-derive:**
- Migration intent → at minimum: pre_work "backup database" (if destructive), post_work "verify migration in production"
- Infrastructure intent → at minimum: pre_work "verify infrastructure prerequisites"

### L4 Gate

```bash
hoyeon-cli spec coverage .dev/specs/{name}/spec.json --layer tasks
```

Then call gate-keeper via SendMessage with tasks + sub-requirement coverage summary + external dependencies + **L4-specific review checklist**:

```
SendMessage(to="gate-keeper", message="
Review the following tasks for L4 gate.

{tasks summary with sub-requirement mappings}

## L4-Specific Review Checklist (in addition to standard DRIFT/GAP/CONFLICT/BACKTRACK)

**Task granularity:**
- Each work task should be completable in a single worker session (1-3 files, clear scope)
- If a task touches 5+ files or has 5+ steps, suggest splitting
- TF (verification) task should depend on ALL work tasks

**Dependency DAG quality:**
- No circular dependencies in depends_on chains
- Tasks with overlapping file_scope MUST have depends_on relationship
- Identify parallelizable tasks (disjoint file_scope + no depends_on) — flag if unnecessarily serialized

**file_scope as hint:**
- file_scope should list likely starting points, not exhaustive file lists
- Flag any task where file_scope has 6+ files (likely needs splitting)

**steps as strategy:**
- Steps should describe intent/approach, not line-level instructions
- Flag steps that reference specific line numbers or exact code to write (these will be stale at execution)

**Acceptance criteria completeness:**
- Every requirement ID in `fulfills[]` should be traceable to a requirement in requirements[]
- checks[] should have at least one runnable command per work task
")
```

**Quick**: No gate. Auto-advance after tasks merge.
**Standard**: Run coverage check + gate-keeper SendMessage. PASS → advance to Plan Approval.

---

### Plan Approval Summary

After L4 gate passes, present the Plan Approval Summary. This is the user's last chance to review the full spec before execution.

> **Mode Gate**:
> - **Interactive**: Print summary + `AskUserQuestion`
> - **Autopilot**: Print summary and spec path, then stop (no `AskUserQuestion`)

Run `hoyeon-cli spec plan` to get the DAG visualization.

The summary follows a logical derivation order: Goal → Scope → Decisions → Requirements → Gaps → Tasks → Human work.

```
spec.json ready! .dev/specs/{name}/spec.json
Mode: {interaction}

Goal
────────────────────────────────────────
{context.confirmed_goal}
────────────────────────────────────────

Non-goals (explicitly out of scope)
────────────────────────────────────────
  - {non_goal_1}
  - {non_goal_2}
────────────────────────────────────────

Key Decisions ({n} total)
────────────────────────────────────────
  D1: {decision} — {rationale (1-line)}
  D2: {decision} — {rationale (1-line)}
  ...
────────────────────────────────────────

Requirements ({n} total, {m} sub-requirements)
────────────────────────────────────────
  R1: {behavior} [priority:{1|2|3}] ← {source.type}:{source.ref}
    Sub-requirements: {sub_count} ({R1.1}, {R1.2}, ...)
  R2: {behavior} [priority:{1|2|3}] ← {source.type}:{source.ref}
    Sub-requirements: {sub_count} ({R2.1}, ...)
  ...
────────────────────────────────────────

Known Gaps
────────────────────────────────────────
  {IF known_gaps exist:}
  - [{severity}] {gap} → mitigation: {mitigation} {IF auto_merged: "(auto-merged)"}
  {ELSE:}
  (none)
────────────────────────────────────────

Pre-work (human actions — must complete before /execute)
────────────────────────────────────────
{pre_work items or "(none)"}
────────────────────────────────────────

Breaking Changes
────────────────────────────────────────
{Scan tasks and decisions for breaking change signals. For each match, show:
  [category] description ← T{id} or D{id}

Categories and detection heuristics:
  [DB]    — file_scope matches **/migrations/**, **/schema/**, prisma/schema.prisma,
             or action contains: migration, schema change, alter table, add column, drop, rename table
  [ENV]   — file_scope matches .env*, or action contains: environment variable, env var, new secret
  [API]   — action contains: breaking change, remove endpoint, rename route, change response format,
             API version, deprecate
  [INFRA] — file_scope matches docker-compose*, Dockerfile, terraform/**, k8s/**, .github/workflows/**,
             or action contains: infrastructure, deploy, container, CI/CD, pipeline
  [DEPS]  — action contains: upgrade major, replace library, remove dependency, migrate from X to Y

If no signals detected: "(none detected)"
If signals found, also append: "Review these before /execute — they may require coordination, backups, or rollback plans."
}
────────────────────────────────────────

Task Overview
────────────────────────────────────────
T1: {action}                             [work|{risk}] — pending
T2: {action}                             [work|{risk}] — pending
  depends on: T1
TF: Full verification                    [verification] — pending
────────────────────────────────────────

DAG: {output from hoyeon-cli spec plan}

Post-work (human actions after completion)
────────────────────────────────────────
{post_work items or "(none)"}
────────────────────────────────────────

Constraints: {n} items
Sub-requirements: {total_sub_count} total across {n} requirements
```

Then ask (interactive only):

```
AskUserQuestion(
  question: "Review the plan above. Select the next step.",
  options: [
    { label: "/execute", description: "Start implementation immediately" },
    { label: "Revise requirements (L3)", description: "Go back to refine requirements and sub-requirements" },
    { label: "Revise tasks (L4)", description: "Go back to refine task breakdown" }
  ]
)
```

**On user rejection or selecting revision:**
- "Revise requirements (L3)" → route back to L3 Round 1 (with current decisions preserved)
- "Revise tasks (L4)" → route back to L4 with reason

**On approval or `/execute`:**

Follow the Mandatory Merge Protocol (SKILL.md):

```bash
# STEP 1: GUIDE (MANDATORY)
hoyeon-cli spec guide meta

# STEP 2+3: CONSTRUCT + WRITE
cat > /tmp/spec-merge.json << 'EOF'
{
  "approved_by": "user",
  "approved_at": "{ISO_TIMESTAMP}"
}
EOF

# STEP 4: MERGE
hoyeon-cli spec merge .dev/specs/{name}/spec.json meta --json "$(cat /tmp/spec-merge.json)" && rm /tmp/spec-merge.json

# STEP 5: VERIFY
hoyeon-cli spec validate .dev/specs/{name}/spec.json
```

If merge fails → follow Merge Failure Recovery (SKILL.md).

Shut down the Team:

```
SendMessage(to="gate-keeper", message={type: "shutdown_request", reason: "Specify session complete"})
TeamDelete()
```

If user selected `/execute`:

```
Skill("execute", args="{name}")
```
