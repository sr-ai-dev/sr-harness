# Audit

## T3 — Verify ADAPT
Decision: ADAPT
Reason: Symlink .claude/skills/specify/references/VERIFICATION_GUIDE.md uses ../../VERIFICATION.md (resolves to .claude/skills/VERIFICATION.md) — should be deeper relative path to reach project root.
Details: 1/2 AC pass, symlink_resolves FAIL. suggested_adaptation: fix symlink with correct relative path.

