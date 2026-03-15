# Learnings

## T1
- v5 schema changes only `taskAcceptanceCriteria` and adds a new `taskCheck` def — all other defs from v4 are preserved verbatim
- `taskAcceptanceCriteria` now has `scenarios` (string[]) + `checks` (array of `taskCheck` objects with `type` and `run` fields)
- `taskCheck.type` enum is `["static", "build", "lint", "format"]`
- `scenarios` items are plain strings referencing `requirements[].scenarios[].id` — the referential integrity is not enforced at schema level (JSON Schema has no cross-reference constraint), so downstream CLI code (T2) must validate it
- The `acceptanceCriterionItem` def from v4 is removed in v5 since it's no longer used

## T3
- TESTING.md rename to VERIFICATION.md: use `cp` to create the new file (TESTING.md deletion handled separately or via git)
- The acceptance criteria says "grep -r TESTING.md 결과 0개 (references 제외)" — `.references/` directory is explicitly excluded from the check
- Symlink path `../../VERIFICATION.md` from `.claude/skills/specify/references/VERIFICATION_GUIDE.md` resolves correctly to plugin root VERIFICATION.md
- bugfix/SKILL.md had "Do not inline TESTING.md" as meta-instruction — updated to VERIFICATION.md for naming consistency
- verification-planner.md had multiple inlined TESTING.md references (section header, standalone guard note, mission step, inline content marker, guidelines) — all required individual edits
- specify/SKILL.md phase pre-read path changed from `${baseDir}/../../../TESTING.md` to `${baseDir}/references/VERIFICATION_GUIDE.md` (symlink approach)

