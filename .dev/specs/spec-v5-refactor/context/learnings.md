# Learnings

## T1
- v5 schema changes only `taskAcceptanceCriteria` and adds a new `taskCheck` def — all other defs from v4 are preserved verbatim
- `taskAcceptanceCriteria` now has `scenarios` (string[]) + `checks` (array of `taskCheck` objects with `type` and `run` fields)
- `taskCheck.type` enum is `["static", "build", "lint", "format"]`
- `scenarios` items are plain strings referencing `requirements[].scenarios[].id` — the referential integrity is not enforced at schema level (JSON Schema has no cross-reference constraint), so downstream CLI code (T2) must validate it
- The `acceptanceCriterionItem` def from v4 is removed in v5 since it's no longer used

## T2
- v5 schema import (`specSchemaV5`) is added to spec.js but the CLI still validates against v4 for backwards compatibility — the v5 schema is imported and available for future use
- `spec check` does NOT call `validateSpec` (no schema validation) — it only checks logical consistency at the JSON level, so v5 `acceptance_criteria.scenarios+checks` structures work without schema conflicts
- Referential integrity check iterates `requirements[].scenarios[].id` to build a Set, then checks each `task.acceptance_criteria?.scenarios[]` entry against it
- `spec guide acceptance-criteria` outputs the v5 AC structure guide via a new `formatAcceptanceCriteriaGuide()` function; the section key uses a hyphen (`acceptance-criteria`) to match CLI arg convention
- `formatMergeGuide` already had `--patch` description before this task — no change needed
- Tests 9 and 10 added to `spec-merge-patch.test.mjs` to verify referential integrity (broken ref exits 1 with message, valid refs pass)

## T3
- TESTING.md rename to VERIFICATION.md: use `cp` to create the new file (TESTING.md deletion handled separately or via git)
- The acceptance criteria says "grep -r TESTING.md 결과 0개 (references 제외)" — `.references/` directory is explicitly excluded from the check
- Symlink path `../../VERIFICATION.md` from `.claude/skills/specify/references/VERIFICATION_GUIDE.md` resolves correctly to plugin root VERIFICATION.md
- bugfix/SKILL.md had "Do not inline TESTING.md" as meta-instruction — updated to VERIFICATION.md for naming consistency
- verification-planner.md had multiple inlined TESTING.md references (section header, standalone guard note, mission step, inline content marker, guidelines) — all required individual edits
- specify/SKILL.md phase pre-read path changed from `${baseDir}/../../../TESTING.md` to `${baseDir}/references/VERIFICATION_GUIDE.md` (symlink approach)

## T4
- specify/SKILL.md Phase 4 AC categories table (Functional/Static/Runtime/Cleanup) replaced with v5 `scenarios` + `checks` structure
- S-item sandbox infra auto-task (T_SANDBOX) logic added to Phase 4: checks for existing docker-compose.yml or sandbox/features/*.feature; if absent and S-items exist, auto-inserts a T_SANDBOX task and requires TF to depend on it
- checklist updated: `acceptance_criteria` item now reads `scenarios + checks`; new entry for T_SANDBOX auto-task
- PLAN_TEMPLATE.md TODO examples updated from `*Functional:*/*Static:*/*Runtime:*` to `*Scenarios:*/*Checks:*` format with `[static]`/`[build]`/`[lint]` type tags
- Worker Output Protocol in PLAN_TEMPLATE.md intentionally left with `functional/static/runtime/cleanup` categories — those describe the Worker's reporting JSON, not the spec.json task structure
- quick-plan SKILL.md task template AC changed from `functional/static/runtime` to `scenarios+checks`
- Map comment in quick-plan updated: "Done condition → `acceptance_criteria.scenarios` + `acceptance_criteria.checks`"

## T5
- WORKER_DESCRIPTION and VERIFY_DESCRIPTION in dev.md were updated to explain v5 AC schema: scenarios[] (referencing requirements[].scenarios[].id) + checks[] (automated static/build/lint/format commands)
- Workers must skip `execution_env: "sandbox"` scenarios — those are delegated to sandbox worker agents by the final-verify step
- final-verify.md Step 3 (AC) now uses scenarios[]+checks[] pattern matching v5 schema; old functional/static/runtime/cleanup categories removed
- final-verify.md Step 4 (new): sandbox scenario collection + per-scenario worker agent delegation; results reported under `sandbox_scenarios` in output
- final-verify.md original "Step 4: Requirements Scenarios" renumbered to Step 5
- OUTPUT FORMAT updated with new `sandbox_scenarios` field alongside existing `acceptance_criteria`

## T6
- worker.md AC verification section updated from functional/static/runtime/cleanup categories to v5 scenarios+checks pattern
- worker.md Output Format JSON example updated: acceptance_criteria now has `scenarios[]` (with id, verified_by, command/detail, status) and `checks[]` (with type, run, status) arrays
- ac-quality-gate.md Task-Level ACs section updated: checks for `acceptance_criteria.scenarios[]` referential integrity and `acceptance_criteria.checks[]` executability instead of old functional/static/runtime items
- ac-quality-gate.md output example updated from `T2.functional.1` to `T2.checks.0` pattern
- verification-planner.md Guidelines: added "H→S conversion — be aggressive" directive to actively convert H-items to S-items where agent/command can verify; only keep H-items for genuine human judgment
- bugfix/SKILL.md Phase 2.2: `acceptance_criteria.functional` → `acceptance_criteria.scenarios` + added `acceptance_criteria.checks` mention
- The `static` word still appears in worker.md/ac-quality-gate.md but only as `checks[].type = "static"` enum value, not as an AC category — this is correct v5 schema usage

