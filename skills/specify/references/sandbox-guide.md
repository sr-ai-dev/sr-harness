# Sandbox Capability Check — Reference Guide

This guide is referenced by L3 (Requirements+Scenarios) when `context.sandbox_capability` is not set.
The main agent reads this file and follows the steps inline.

## When to Trigger

- **Primary**: "Sandbox Capability Check (before pingpong)" section in L3 flow — runs before L3-drafter starts
- **Safety net**: L3-reviewer flags `sandbox_capability_unknown` gap (non-blocking) — if before-pingpong check was somehow skipped, orchestrator runs this guide before next pingpong round (does NOT count as a retry round)
- Condition: `context.sandbox_capability` is NOT set in spec.json

## Phase A: Auto-detect Existing Infrastructure

Scan the project for existing sandbox infra. No user prompt needed if found.

### Detection targets

| Signal | Files to check |
|--------|---------------|
| Playwright | `playwright.config.ts`, `playwright.config.js` |
| Cypress | `cypress.config.ts`, `cypress.config.js`, `cypress.json` |
| Vitest Browser | `@vitest/browser` in package.json devDependencies |
| Docker | `docker-compose.yml`, `docker-compose.yaml`, `Dockerfile` |
| Testcontainers | `testcontainers` in package.json or build files |
| Sandbox env | `.env.sandbox`, `.env.test` |
| BDD/Gherkin | `sandbox/features/*.feature`, `features/*.feature`, `*.feature` |

### If infra detected

Record automatically — no user prompt:

```
capability = {
  "docker": detected.docker OR detected.testcontainers,
  "browser": detected.playwright OR detected.cypress OR detected.vitest_browser,
  "tools": [list of detected tool names],
  "confirmed_at": "{today}",
  "detected": true
}
```

Merge into spec.json context, then:
- If 0 sandbox scenarios in current draft → GOTO L3_DRAFT (restart Round 1 of the pingpong with updated capability in prompt)
- If sandbox scenarios already exist → proceed to merge

## Phase B: No Infra Detected — Classify and Recommend

### Project signal detection

Scan `file_scope`, `meta.goal`, and project files to classify:

| Signal | Heuristics |
|--------|-----------|
| `has_ui` | `*.tsx`, `*.jsx`, `*.vue`, `*.svelte`, `*.css`, `**/components/**`, `**/pages/**`, or goal keywords (canvas, editor, drag, responsive, UI, dashboard) |
| `has_api` | `**/routes/**`, `**/api/**`, `**/controllers/**`, `**/handlers/**`, `*.go`, `**/server.*`, or goal keywords (API, backend, endpoint, REST, GraphQL) |
| `has_db` | `**/migrations/**`, `**/models/**`, `**/schema/**`, `prisma/schema.prisma`, or ORM deps (prisma, typeorm, sequelize, knex, drizzle) |
| `has_cli` | `**/bin/**`, `**/cli/**`, package.json `bin` field |

### Dynamic options based on signals

Build AskUserQuestion options dynamically:

- `has_ui` → offer **Browser (Playwright)** and/or **Browser + Vitest Browser Mode**
- `has_api` or `has_db` → offer **Docker (containers)**
- `has_ui` AND (`has_api` or `has_db`) → offer **Docker + Browser (full stack)**
- Always include → **No sandbox needed**

### User prompt template

```
"No sandbox test infrastructure detected.
Project signals: [detected signals]
Sandbox tests catch issues that unit tests miss (real DB queries, browser rendering, E2E flows).
Which sandbox environment should we set up?"
```

### If "No sandbox needed"

Record `{ "docker": false, "browser": false, "confirmed_at": "{today}" }` and proceed.

## Phase C: Scaffold Tasks (user approved sandbox)

**Only after user selects a sandbox option in Phase B.**

### Browser scaffold task (T-sandbox-browser)

```json
{
  "id": "T-sandbox-browser",
  "action": "Set up Playwright E2E testing infrastructure",
  "type": "work",
  "origin": "auto:sandbox-scaffold",
  "risk": "low",
  "status": "pending",
  "steps": [
    "Install playwright: npm init playwright@latest",
    "Configure playwright.config.ts with webServer (dev server command + port)",
    "Add package.json scripts: test:e2e, test:e2e:ui",
    "Create e2e/smoke.spec.ts — verify app loads",
    "npx playwright install chromium",
    "Verify: npm run test:e2e passes"
  ],
  "depends_on": ["T1"]
}
```

If Vitest Browser Mode also selected, add extra steps:
- Install `@vitest/browser`
- Add vitest workspace config with browser project (provider: playwright)
- Add `test:browser` script

### Docker scaffold task (T-sandbox-docker)

```json
{
  "id": "T-sandbox-docker",
  "action": "Set up Docker-based sandbox for integration testing",
  "type": "work",
  "origin": "auto:sandbox-scaffold",
  "risk": "low",
  "status": "pending",
  "steps": [
    "Create docker-compose.yml with required services (DB, cache, etc.)",
    "Create .env.sandbox with test environment variables",
    "Add package.json scripts: sandbox:up, sandbox:down, test:integration",
    "Create seed data / migration scripts for test DB",
    "Verify: docker compose up -d && npm run test:integration passes"
  ],
  "depends_on": ["T1"]
}
```

### After scaffold tasks added

- Record capability with `"scaffold_required": true`
- All tasks with `execution_env: "sandbox"` scenarios depend on `T-sandbox-*`
- Re-run L3 draft to generate sandbox scenarios: `GOTO L3_DRAFT`
