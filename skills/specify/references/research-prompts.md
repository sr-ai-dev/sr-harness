# Phase 0.5 Research Prompts

Use these prompts during `/specify` Phase 0.5 for brownfield-extension,
brownfield-refactor, and hybrid specs.

## Common Inputs

Substitute:
- `{goal}`: one-line goal from `qa-log.md` frontmatter
- `{remaining_modules}`: modules not already loaded from KB
- `{kb_loaded_modules}`: modules already loaded from KB
- `{refactor_area}`: concrete area being refactored, when known

When some modules were loaded from KB, append this constraint to every prompt:

```text
Already handled by KB: {kb_loaded_modules}. Do not scan these modules.
Research only these remaining modules: {remaining_modules}.
```

## Relevant Code Explorer

```text
Goal: {goal}. Find existing patterns, modules, or files relevant to this
change. Report as file:line format with a brief summary.
```

## Toolchain Explorer

```text
Find project structure and toolchain: package manifests, build/test/lint
commands, entry points, and deployment config. Report as file:line format.
```

## Docs Researcher

```text
Goal: {goal}. Search ADRs, READMEs, docs/, CLAUDE.md, and config files for
conventions, architecture decisions, and constraints relevant to this work.
Report as file:line format.
```

## Refactor Impact Explorer

Use only for `brownfield-refactor`.

```text
Find all call sites and dependents of {refactor_area}. Report impact surface
as file:line format.
```
