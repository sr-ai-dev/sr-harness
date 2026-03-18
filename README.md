# hoyeon

**All you need is requirements. Agents handle everything else.**

You describe what you want. Hoyeon derives requirements, generates acceptance criteria, plans tasks, implements them with parallel agents, and verifies every step — all from a single `spec.json`.

[![npm](https://img.shields.io/npm/v/@team-attention/hoyeon-cli)](https://www.npmjs.com/package/@team-attention/hoyeon-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## The Idea

Most AI coding tools either ask you to write a detailed plan upfront, or just wing it and hope for the best. Both break down on real work.

Hoyeon takes a different approach: **derive everything from requirements**.

```
You say:    "add dark mode toggle to settings page"

Hoyeon:     Goal → Context → Decisions → Requirements → Tasks → Verified Code
            ─────────────── /specify ───────────────   ─── /execute ───
```

You provide the goal. The system interviews you to fill gaps, derives requirements with acceptance criteria and verification scenarios, generates a task plan, then executes it — with agents running in parallel, quality gates at every step, and full traceability from requirement to committed code.

## How It Works

### 1. Requirements Derivation (`/specify`)

A layer-based derivation chain turns your intent into a structured spec:

```
L0: Goal          "add dark mode toggle"
 ↓
L1: Context       codebase analysis, UX review, docs research
 ↓
L2: Decisions     "manual toggle, CSS variables, persist in localStorage"
 ↓
L3: Requirements  R1: "Toggle switches theme" → scenarios with verify commands
 ↓
L4: Tasks         T1: "Add toggle component" → file_scope, AC, steps
 ↓
L5: Review        AC quality gate, plan approval
```

Each layer has a **merge checkpoint** (validated by CLI) and a **gate-keeper** (step-back review via agent team). Nothing advances without passing both.

### 2. Agent Execution (`/execute`)

The orchestrator reads `spec.json` and dispatches parallel worker agents:

```
Worker T1 ──→ Commit T1
Worker T2 ──→ Commit T2    (parallel if disjoint files)
Worker T3 ──→ Commit T3
         ↓
    Code Review (multi-model: Codex + Gemini + Claude)
         ↓
    Final Verify (holistic: goal + constraints + AC + requirements)
         ↓
    Report
```

Workers self-read their task spec, run verification commands, and report results. If a scope blocker is hit, the system derives a fix task and re-runs — append-only, fully tracked.

### 3. The Spec Contract

`spec.json` is the single source of truth. Everything reads from it, everything writes to it.

```json
{
  "meta": { "goal": "...", "mode": { "depth": "standard" } },
  "context": { "research": {}, "decisions": [], "assumptions": [] },
  "constraints": [{ "rule": "...", "verified_by": "machine" }],
  "requirements": [{
    "behavior": "Toggle switches between light and dark theme",
    "scenarios": [{
      "given": "user is on settings page",
      "when": "user clicks dark mode toggle",
      "then": "theme switches to dark mode",
      "verified_by": "machine",
      "verify": { "type": "command", "run": "npm test -- --grep 'dark mode'" }
    }]
  }],
  "tasks": [{ "id": "T1", "action": "...", "acceptance_criteria": {} }]
}
```

Requirements have scenarios. Scenarios have verification commands. Tasks have acceptance criteria that reference scenarios. Final Verify checks everything holistically. The chain is: **requirement → scenario → verify command → pass/fail**.

## Quick Start

```bash
# Install the plugin
claude plugin marketplace add team-attention/hoyeon
claude plugin install hoyeon
npm install -g @team-attention/hoyeon-cli

# Start
/specify "add dark mode toggle to settings page"
/execute
```

## Skills at a Glance

| Category | What you're doing | Skills |
|----------|------------------|--------|
| **Plan** | Derive requirements, generate specs | `/specify` `/quick-plan` `/discuss` `/deep-interview` `/mirror` |
| **Research** | Analyze codebase, find references | `/deep-research` `/dev-scan` `/reference-seek` `/google-search` `/browser-work` |
| **Decide** | Evaluate tradeoffs, multi-perspective review | `/council` `/tribunal` `/tech-decision` `/stepback` |
| **Build** | Execute specs, fix bugs, iterate | `/execute` `/ralph` `/rulph` `/bugfix` |
| **Verify** | Check changes, extract learnings | `/check` `/compound` `/scope` `/issue` |

24 skills. 20 specialized agents. You interact with skills — agents work behind the scenes.

## Architecture

```
/specify (derive)  ──→  spec.json  ──→  /execute (orchestrate)  ──→  verified result
  L0→L1→L2→L3→L4→L5      │              Worker → Commit (×N)         │
  gate-keeper at each     │              Code Review                   │
  layer transition        │              Final Verify                  │
                          │                                            │
                    requirements +                              traceability:
                    scenarios +                                 every file change
                    verify commands                             → task → requirement
```

- **24 skills** — slash commands you invoke
- **20 agents** — workers, reviewers, debuggers, verifiers orchestrated behind the scenes
- **18 hooks** — automate pipeline transitions, guard writes, enforce quality gates

See [docs/architecture.md](docs/architecture.md) for the full pipeline diagram.

## CLI

`hoyeon-cli` manages spec.json validation and session state:

```bash
hoyeon-cli spec init "project-name"        # Create new spec
hoyeon-cli spec merge spec.json --json ...  # Validated merge
hoyeon-cli spec check spec.json             # Verify completeness
hoyeon-cli spec guide <section>             # Show field structure
```

See [docs/cli.md](docs/cli.md) for the full command reference.

## Contributing

Contributions welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT
