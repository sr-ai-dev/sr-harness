// Knowledge lint MVP — stale + orphan detection.
//
// PR2 / T7 — fulfills R-B3.1 (stale + orphan reporting) and R-T4.1 (CLI surface
// usable by /check skill in T8). Contradiction-mode (PR5 / T13, R-B3.2) is NOT
// implemented here.
//
// Stale rule (per design.md §4.2):
//   1. module.commit_sha !== git rev-parse HEAD (run in module.source.path)
//   2. git diff --name-only <stored_sha>..HEAD changed-file-count >= threshold
//      (default 5; tunable via the `kb_lint_stale_threshold` settings flag)
//   Both conditions must hold to flag STALE.
//
// Orphan rule:
//   - For every topic in {topics, topics_common, topics_ros1, topics_ros2}, the
//     `topic.anchor` text must appear verbatim as a line in the corresponding
//     KB markdown file. The mapping is:
//       topics        → files.common  (or legacy `file`)
//       topics_common → files.common
//       topics_ros1   → files.ros1
//       topics_ros2   → files.ros2
//   - Missing KB files are reported as orphans on every topic that should have
//     resolved to them (caller can grep for the cause).
//
// Output:
//   - Structured findings array with type ∈ {STALE, ORPHAN, ERROR}.
//   - When run from the CLI, exit 0 if findings is empty, else exit 1.
//
// `kb_lint` settings flag is NOT consulted here — gating happens at the caller
// (Phase 0.5 / /check). This module is the underlying detector usable directly
// or from the CLI sub-command.

import { readFileSync, existsSync } from 'node:fs';
import { resolve, join, isAbsolute, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse as parseYaml, YamlMiniParseError } from './yaml-mini.js';
import { getFlag } from './settings.js';

const DEFAULT_STALE_THRESHOLD = 5;

/**
 * @typedef {Object} StaleFinding
 * @property {'STALE'} type
 * @property {string} module
 * @property {string} stored_sha
 * @property {string} head_sha
 * @property {number} changed_files
 * @property {number} threshold
 *
 * @typedef {Object} OrphanFinding
 * @property {'ORPHAN'} type
 * @property {string} module
 * @property {string} topic_id
 * @property {string} anchor
 * @property {string} file
 * @property {string} reason
 *
 * @typedef {Object} ErrorFinding
 * @property {'ERROR'} type
 * @property {string} module
 * @property {string} reason
 *
 * @typedef {StaleFinding | OrphanFinding | ErrorFinding} Finding
 */

/**
 * Read and parse `.sr-harness/knowledge/index.yaml` rooted at projectRoot.
 *
 * @param {string} projectRoot - absolute path of the project containing the KB.
 * @returns {{ ok: true, index: object, indexPath: string, kbDir: string } |
 *           { ok: false, error: string, indexPath: string }}
 */
export function loadKnowledgeIndex(projectRoot) {
  const kbDir = join(projectRoot, '.sr-harness', 'knowledge');
  const indexPath = join(kbDir, 'index.yaml');
  if (!existsSync(indexPath)) {
    return { ok: false, error: `index.yaml not found at ${indexPath}`, indexPath };
  }
  let raw;
  try {
    raw = readFileSync(indexPath, 'utf8');
  } catch (err) {
    return { ok: false, error: `read failed: ${err.message}`, indexPath };
  }
  try {
    const index = parseYaml(raw);
    if (!index || typeof index !== 'object' || !index.modules) {
      return { ok: false, error: 'index.yaml has no `modules` key', indexPath };
    }
    return { ok: true, index, indexPath, kbDir };
  } catch (err) {
    const detail = err instanceof YamlMiniParseError ? err.message : err.message;
    return { ok: false, error: `parse failed: ${detail}`, indexPath };
  }
}

/* ------------------------------------------------------------------ */
/*  Stale detection                                                   */
/* ------------------------------------------------------------------ */

function gitRevParseHead(sourcePath) {
  if (!sourcePath || !existsSync(join(sourcePath, '.git'))) return null;
  const r = spawnSync('git', ['-C', sourcePath, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  return r.stdout.trim() || null;
}

function gitChangedFileCount(sourcePath, storedSha) {
  if (!sourcePath || !existsSync(join(sourcePath, '.git'))) return null;
  // Use double-dot range so commits-only diff is what we count.
  const r = spawnSync(
    'git',
    ['-C', sourcePath, 'diff', '--name-only', `${storedSha}..HEAD`],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) return null;
  return r.stdout.split('\n').filter((l) => l.trim() !== '').length;
}

/**
 * @param {string} moduleName
 * @param {object} entry - parsed index.yaml module entry
 * @param {{ threshold: number, gitOps?: { revParseHead: Function, changedFiles: Function } }} opts
 * @returns {StaleFinding | ErrorFinding | null}
 */
export function checkStale(moduleName, entry, opts) {
  const threshold = opts.threshold ?? DEFAULT_STALE_THRESHOLD;
  const gitOps = opts.gitOps ?? { revParseHead: gitRevParseHead, changedFiles: gitChangedFileCount };
  const sourcePath = entry?.source?.path;
  const storedSha = entry?.commit_sha;
  if (!storedSha) return null; // module has no stored sha → cannot be stale (legacy)

  if (!sourcePath) {
    return {
      type: 'ERROR',
      module: moduleName,
      reason: `cannot evaluate stale: module entry has no source.path`,
    };
  }
  const headSha = gitOps.revParseHead(sourcePath);
  if (!headSha) {
    // .git missing or git failed → not a hard error per R-U3.4 (file-mtime
    // fallback is a Phase 0.5 concern, not lint's). Return null so we silently
    // skip the stale rule for this module.
    return null;
  }
  if (storedSha === headSha) return null;

  const changedFiles = gitOps.changedFiles(sourcePath, storedSha);
  if (changedFiles === null) return null;
  if (changedFiles < threshold) return null;
  return {
    type: 'STALE',
    module: moduleName,
    stored_sha: storedSha,
    head_sha: headSha,
    changed_files: changedFiles,
    threshold,
  };
}

/* ------------------------------------------------------------------ */
/*  Orphan detection                                                  */
/* ------------------------------------------------------------------ */

function topicGroupsForEntry(entry) {
  // Returns array of { groupName, topics, kbFile? }. Each topic is mapped to the
  // KB file it expects to anchor into.
  const out = [];
  if (Array.isArray(entry.topics)) {
    out.push({ group: 'topics', topics: entry.topics, kbFile: entry?.files?.common ?? entry?.file });
  }
  if (Array.isArray(entry.topics_common)) {
    out.push({ group: 'topics_common', topics: entry.topics_common, kbFile: entry?.files?.common });
  }
  if (Array.isArray(entry.topics_ros1)) {
    out.push({ group: 'topics_ros1', topics: entry.topics_ros1, kbFile: entry?.files?.ros1 });
  }
  if (Array.isArray(entry.topics_ros2)) {
    out.push({ group: 'topics_ros2', topics: entry.topics_ros2, kbFile: entry?.files?.ros2 });
  }
  return out;
}

function readKbFile(kbDir, kbFile) {
  if (!kbFile) return null;
  const abs = isAbsolute(kbFile) ? kbFile : join(kbDir, kbFile);
  if (!existsSync(abs)) return { absent: true, path: abs };
  try {
    return { absent: false, path: abs, content: readFileSync(abs, 'utf8') };
  } catch (err) {
    return { absent: true, path: abs, error: err.message };
  }
}

function anchorMatchesContent(anchor, content) {
  // The anchor as authored is the heading line itself (e.g. "## Motor CAN
  // Protocol"). We accept exact-line matches with optional trailing whitespace.
  // We do NOT do fuzzy slug matching — design.md §4.2 says grep semantics.
  const target = anchor.trim();
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.trim() === target) return true;
  }
  return false;
}

/**
 * @param {string} moduleName
 * @param {object} entry
 * @param {string} kbDir
 * @returns {(OrphanFinding | ErrorFinding)[]}
 */
export function checkOrphan(moduleName, entry, kbDir) {
  const findings = [];
  const groups = topicGroupsForEntry(entry);
  for (const g of groups) {
    if (g.topics.length === 0) continue;
    if (!g.kbFile) {
      findings.push({
        type: 'ERROR',
        module: moduleName,
        reason: `topics group '${g.group}' has no corresponding files.* entry`,
      });
      continue;
    }
    const kb = readKbFile(kbDir, g.kbFile);
    if (!kb) continue;
    if (kb.absent) {
      // Every topic in this group is structurally orphaned.
      for (const topic of g.topics) {
        findings.push({
          type: 'ORPHAN',
          module: moduleName,
          topic_id: topic.id ?? '<unknown>',
          anchor: topic.anchor ?? '',
          file: g.kbFile,
          reason: `KB file missing at ${kb.path}`,
        });
      }
      continue;
    }
    for (const topic of g.topics) {
      if (!topic || !topic.anchor) continue;
      if (!anchorMatchesContent(topic.anchor, kb.content)) {
        findings.push({
          type: 'ORPHAN',
          module: moduleName,
          topic_id: topic.id ?? '<unknown>',
          anchor: topic.anchor,
          file: g.kbFile,
          reason: 'anchor not found as a heading line',
        });
      }
    }
  }
  return findings;
}

/* ------------------------------------------------------------------ */
/*  Top-level lint                                                    */
/* ------------------------------------------------------------------ */

/**
 * Lint one or more modules in a KB.
 *
 * @param {{
 *   projectRoot: string,
 *   modules?: string[],          // when omitted/empty → lint every module
 *   threshold?: number,
 *   gitOps?: { revParseHead: Function, changedFiles: Function },
 * }} options
 * @returns {{
 *   ok: boolean,
 *   findings: Finding[],
 *   modules_checked: string[],
 *   indexPath: string,
 *   error?: string,
 * }}
 */
export function lint(options) {
  const projectRoot = resolve(options.projectRoot);
  const loaded = loadKnowledgeIndex(projectRoot);
  if (!loaded.ok) {
    return {
      ok: false,
      findings: [],
      modules_checked: [],
      indexPath: loaded.indexPath,
      error: loaded.error,
    };
  }

  const allModuleNames = Object.keys(loaded.index.modules ?? {});
  let names;
  if (options.modules && options.modules.length > 0) {
    names = options.modules;
    const missing = names.filter((n) => !allModuleNames.includes(n));
    if (missing.length > 0) {
      return {
        ok: false,
        findings: [],
        modules_checked: [],
        indexPath: loaded.indexPath,
        error: `module(s) not in index.yaml: ${missing.join(', ')}`,
      };
    }
  } else {
    names = allModuleNames;
  }

  const findings = [];
  for (const name of names) {
    const entry = loaded.index.modules[name];
    if (!entry || typeof entry !== 'object') continue;

    const stale = checkStale(name, entry, {
      threshold: options.threshold,
      gitOps: options.gitOps,
    });
    if (stale) findings.push(stale);

    const orphans = checkOrphan(name, entry, loaded.kbDir);
    findings.push(...orphans);
  }

  return {
    ok: true,
    findings,
    modules_checked: names,
    indexPath: loaded.indexPath,
  };
}

/* ------------------------------------------------------------------ */
/*  Output formatting                                                 */
/* ------------------------------------------------------------------ */

export function formatFindings(result) {
  if (!result.ok) {
    return `Error: ${result.error} (${result.indexPath})\n`;
  }
  if (result.findings.length === 0) {
    const n = result.modules_checked.length;
    return `KB lint clean (${n} module${n === 1 ? '' : 's'} checked)\n`;
  }
  const lines = [];
  let stale = 0;
  let orphan = 0;
  let errors = 0;
  for (const f of result.findings) {
    if (f.type === 'STALE') {
      stale += 1;
      lines.push(
        `[STALE] ${f.module}\n` +
          `  commit_sha: ${shortSha(f.stored_sha)} (HEAD: ${shortSha(f.head_sha)})\n` +
          `  changed files: ${f.changed_files} (threshold: ${f.threshold})\n` +
          `  → recommend: hoyeon-cli knowledge index-update ${f.module}`,
      );
    } else if (f.type === 'ORPHAN') {
      orphan += 1;
      lines.push(
        `[ORPHAN] ${f.module}\n` +
          `  topic '${f.topic_id}' (anchor: ${JSON.stringify(f.anchor)})\n` +
          `  not found in ${f.file} — ${f.reason}\n` +
          `  → recommend: remove topic or add heading to KB file`,
      );
    } else if (f.type === 'ERROR') {
      errors += 1;
      lines.push(`[ERROR] ${f.module}\n  ${f.reason}`);
    }
  }
  const moduleSet = new Set(result.findings.map((f) => f.module));
  const total = result.findings.length;
  lines.push(
    `\nSummary: ${total} issue${total === 1 ? '' : 's'} ` +
      `(${stale} stale, ${orphan} orphan${errors ? `, ${errors} error` : ''}) ` +
      `across ${moduleSet.size} module${moduleSet.size === 1 ? '' : 's'}`,
  );
  return lines.join('\n') + '\n';
}

function shortSha(sha) {
  return typeof sha === 'string' && sha.length >= 7 ? sha.slice(0, 7) : String(sha);
}

/* ------------------------------------------------------------------ */
/*  CLI entry                                                         */
/* ------------------------------------------------------------------ */

const CMD_HELP = `\
Usage:
  hoyeon-cli knowledge lint [<module>] [options]

Detects two classes of KB rot defined in requirements R-B3.1:

  STALE   module.commit_sha drifted from git HEAD AND >= N files changed since
          (N defaults to 5; configurable via 'kb_lint_stale_threshold' flag).

  ORPHAN  topic.anchor is not present as a heading line in the corresponding
          KB markdown file (resolved via files.common / files.ros1 / files.ros2).

Arguments:
  <module>       Module name to lint (omit to lint every module — same as --all).

Options:
  --all          Lint every module in index.yaml (implicit when <module> is omitted).
  --threshold N  Override stale changed-file threshold for this run.
  --json         Emit findings as a JSON object instead of human text.
  --help, -h     This help.

Exit codes:
  0   no findings
  1   one or more findings (stale / orphan / error)
  2   index.yaml missing or unreadable
`;

/**
 * CLI handler for `hoyeon-cli knowledge lint`.
 *
 * @param {string[]} args - argv slice after the `lint` subcommand.
 * @param {{ cwd?: string, exit?: (code:number)=>void, stdout?: NodeJS.WritableStream }} [env]
 * @returns {Promise<number>} resolved exit code (also passed to env.exit when provided).
 */
export async function cmdLint(args, env = {}) {
  const cwd = env.cwd ?? process.cwd();
  const stdout = env.stdout ?? process.stdout;
  const exit = env.exit ?? ((code) => { process.exit(code); });

  // Tiny opts parser — we cannot reuse parseArgs() because it eats the next
  // token as a value for any --flag, which collides with `--all`/`--json`.
  let useJson = false;
  let useAll = false;
  let threshold;
  const positional = [];
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--help' || a === '-h') { stdout.write(CMD_HELP); exit(0); return 0; }
    if (a === '--all') { useAll = true; continue; }
    if (a === '--json') { useJson = true; continue; }
    if (a === '--threshold') {
      const v = args[i + 1];
      if (!v || !/^\d+$/.test(v)) {
        process.stderr.write(`Error: --threshold requires a non-negative integer\n`);
        exit(1);
        return 1;
      }
      threshold = parseInt(v, 10);
      i += 1;
      continue;
    }
    if (a.startsWith('--')) {
      process.stderr.write(`Error: unknown option '${a}'. Run 'hoyeon-cli knowledge lint --help'.\n`);
      exit(1);
      return 1;
    }
    positional.push(a);
  }

  const moduleArg = useAll ? null : positional[0] ?? null;
  const modules = moduleArg ? [moduleArg] : [];

  const resolvedThreshold = threshold ?? getFlag('kb_lint_stale_threshold', DEFAULT_STALE_THRESHOLD, { cwd });
  const numericThreshold = typeof resolvedThreshold === 'number' && Number.isFinite(resolvedThreshold)
    ? resolvedThreshold
    : DEFAULT_STALE_THRESHOLD;

  const result = lint({
    projectRoot: cwd,
    modules,
    threshold: numericThreshold,
  });

  if (useJson) {
    stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    stdout.write(formatFindings(result));
  }

  if (!result.ok) { exit(2); return 2; }
  if (result.findings.length === 0) { exit(0); return 0; }
  exit(1);
  return 1;
}

// Resolve a project root for callers (e.g. /check skill in T8) that already
// know the project absolute path. Exposed for symmetry with cmdLint.
export function resolveProjectRoot(maybeAbs) {
  return resolve(maybeAbs);
}

// Allow callers to override the default threshold helper without poking at
// settings.js directly. Keeps lint pure for unit tests.
export const __INTERNAL__ = {
  DEFAULT_STALE_THRESHOLD,
  // The dirname import is otherwise unused; re-export to silence eslint
  // / build complaints if this module is type-checked elsewhere.
  _dirname: dirname,
};
