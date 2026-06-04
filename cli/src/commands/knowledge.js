// knowledge command group — scaffold (T2 / PR1)
//
// Subcommand IMPLEMENTATIONS land in later PRs:
//   - lint          → PR2 (T7)   — stale + orphan detection
//   - index-update  → PR1 (T4)   — partial index.yaml update via AJV-validated JSON
//   - graph-link    → PR6 (T17)  — write hub_by_profile from .meta.json
//   - graph-build   → PR6 (T16)  — invoke scripts/graphify-run.sh
//   - graph-clean   → PR6 (T17)  — delete ~/.sr-harness/graph/<slug>/ entries
//
// This file currently provides:
//   1. CLI surface (subcommand dispatch + --help) so callers can wire integrations early.
//   2. A reachable reference to validateKnowledgeIndex from json-io.js (T1) so esbuild
//      bundles the knowledge-index.schema.json into dist/cli.js (R-T3.3).

import { validateKnowledgeIndex } from '../lib/json-io.js';

const HELP = `
Usage:
  hoyeon-cli knowledge <subcommand> [options]

Subcommands:
  lint <module>                 Detect stale + orphan entries in a module's KB index (PR2, not yet implemented)
  index-update <module>         Apply partial update to index.yaml for a module (PR1 follow-up T4, not yet implemented)
                                JSON payload via --json "$(cat /tmp/...)" — file-based to avoid zsh glob expansion (R-T3.2)
  graph-link <module>           Write hub_by_profile entries for a module from .meta.json (PR6, not yet implemented)
  graph-build                   Invoke scripts/graphify-run.sh to build/refresh the graph cache (PR6, not yet implemented)
  graph-clean [--project <slug>] Delete graph cache directories under ~/.sr-harness/graph/ (PR6, not yet implemented)

Options:
  --help, -h    This help.

Notes:
  - All JSON payloads MUST be passed via --json "$(cat /tmp/...)" to avoid zsh glob expansion (R-T3.2).
  - After modifying cli/src/commands/knowledge.js, run \`cd cli && npm run build\` so dist/cli.js stays in sync (R-T3.3).
`;

function die(msg, code = 1) { process.stderr.write(msg + '\n'); process.exit(code); }

function stub(subName, ownerPr) {
  process.stdout.write(`[knowledge ${subName}] not yet implemented (lands in ${ownerPr})\n`);
}

// ---------------- lint ----------------

async function cmdLint(_args) {
  stub('lint', 'PR2');
}

// ---------------- index-update ----------------

async function cmdIndexUpdate(_args) {
  // Pull validateKnowledgeIndex into the reachable graph so esbuild bundles
  // knowledge-index.schema.json (T1) into dist/cli.js (R-T3.3). Once PR1 follow-up T4
  // ships the real implementation, this no-op assignment is replaced by an actual call.
  const _validator = validateKnowledgeIndex;
  void _validator;
  stub('index-update', 'PR1 (T4)');
}

// ---------------- graph-link ----------------

async function cmdGraphLink(_args) {
  stub('graph-link', 'PR6');
}

// ---------------- graph-build ----------------

async function cmdGraphBuild(_args) {
  stub('graph-build', 'PR6');
}

// ---------------- graph-clean ----------------

async function cmdGraphClean(_args) {
  stub('graph-clean', 'PR6');
}

// ---------------- dispatcher ----------------

const COMMANDS = {
  lint: cmdLint,
  'index-update': cmdIndexUpdate,
  'graph-link': cmdGraphLink,
  'graph-build': cmdGraphBuild,
  'graph-clean': cmdGraphClean,
};

export default async function knowledge(args) {
  const sub = args[0];
  if (!sub || sub === '--help' || sub === '-h') {
    process.stdout.write(HELP);
    return;
  }
  const fn = COMMANDS[sub];
  if (!fn) die(`Error: unknown knowledge subcommand '${sub}'. Run 'hoyeon-cli knowledge --help'.`);
  await fn(args.slice(1));
}
