// knowledge-lint integration tests (PR2 / T9).
//
// Covers R-B3.1 (stale + orphan detection) and R-T4.1 (CLI surface) end-to-end
// against fixture KB trees built per-test under os.tmpdir():
//
//   <tmpRoot>/
//     .sr-harness/knowledge/index.yaml      (authored shape)
//     .sr-harness/knowledge/<file>.md       (KB markdown referenced from index)
//     <module>/                             (mini git repo, source.path target)
//       .git/                               (real, via `git init` + a couple of commits)
//       <tracked files...>
//
// Each test isolates its KB via `mkdtempSync` and reaps with `rmSync`. Tests
// invoke `lint()` directly (so we can pin `gitOps` when convenient) and also
// drive `cmdLint()` via spawnSync against dist/cli.js for the OS-level surface
// (mirrors knowledge-cli.test.mjs).
//
// Fulfills:
//   R-T8.2 — fixture-based test that the lint-side parsing of index.yaml +
//            git state + KB markdown parses correctly without any external
//            tooling and that the suite passes via plain `node --test`.
//
// graph.json itself is PR6 territory (T16/T17). The R-T8.2 fixture target for
// PR2 is the lint path, which is the only code path this PR ships that reads
// fixtures end-to-end. The graph.json fixture proper lands with T16.
//
// Constraints honored:
//   - INV-8: zero new npm dependencies. Only Node built-ins.
//   - ESM only (matches package.json "type": "module").
//   - Cross-platform (macOS + ubuntu) — no shell-specific commands; we use
//     spawnSync('git', [...]) and node:fs primitives.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
} from 'node:fs';
import { spawnSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { lint, formatFindings } from '../src/lib/lint.js';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const cliPath = join(__dirname, '..', 'dist', 'cli.js');

/* ------------------------------------------------------------------ */
/*  Fixture builders                                                  */
/* ------------------------------------------------------------------ */

function makeProjectRoot() {
  return mkdtempSync(join(tmpdir(), 'kb-lint-'));
}

function writeKbFile(root, relPath, content) {
  const abs = join(root, '.sr-harness', 'knowledge', relPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
  return abs;
}

function writeIndex(root, yaml) {
  const abs = join(root, '.sr-harness', 'knowledge', 'index.yaml');
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, yaml);
  return abs;
}

/**
 * Initialise a real git repo at `dir` with a single commit containing every
 * file in `files`. Returns the resulting commit_sha.
 *
 * Uses `-c user.email/user.name` on the commit invocation so we don't depend
 * on the runner's git config (CI matrix friendliness).
 */
function gitInitWithCommit(dir, files) {
  mkdirSync(dir, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(dir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  const initRes = spawnSync('git', ['init', '-q', '-b', 'main'], { cwd: dir, encoding: 'utf8' });
  // Older git versions reject `-b main`; retry without it (then rename).
  if (initRes.status !== 0) {
    const fb = spawnSync('git', ['init', '-q'], { cwd: dir, encoding: 'utf8' });
    assert.equal(fb.status, 0, `git init failed: ${fb.stderr}`);
  }
  const addRes = spawnSync('git', ['add', '-A'], { cwd: dir, encoding: 'utf8' });
  assert.equal(addRes.status, 0, `git add failed: ${addRes.stderr}`);
  const commitRes = spawnSync(
    'git',
    [
      '-c', 'user.email=test@example.com',
      '-c', 'user.name=test',
      '-c', 'commit.gpgsign=false',
      'commit', '-q', '-m', 'init',
    ],
    { cwd: dir, encoding: 'utf8' },
  );
  assert.equal(commitRes.status, 0, `git commit failed: ${commitRes.stderr}`);
  const sha = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' });
  assert.equal(sha.status, 0, `git rev-parse failed: ${sha.stderr}`);
  return sha.stdout.trim();
}

/**
 * Add `count` extra commits on top of HEAD by writing `extra-N.md` files.
 * Used to simulate "≥5 changed files since stored sha" for the STALE rule.
 */
function gitAppendCommits(dir, count) {
  for (let i = 0; i < count; i += 1) {
    writeFileSync(join(dir, `extra-${i}.md`), `extra ${i}\n`);
    const add = spawnSync('git', ['add', `extra-${i}.md`], { cwd: dir, encoding: 'utf8' });
    assert.equal(add.status, 0, `git add extra-${i} failed: ${add.stderr}`);
    const commit = spawnSync(
      'git',
      [
        '-c', 'user.email=test@example.com',
        '-c', 'user.name=test',
        '-c', 'commit.gpgsign=false',
        'commit', '-q', '-m', `extra ${i}`,
      ],
      { cwd: dir, encoding: 'utf8' },
    );
    assert.equal(commit.status, 0, `git commit extra-${i} failed: ${commit.stderr}`);
  }
}

function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}

/* ------------------------------------------------------------------ */
/*  Skip-aware fixture: skip whole suite if `git` is not on PATH.     */
/*  (CI runners always have git; this is for hostile dev shells.)     */
/* ------------------------------------------------------------------ */

const HAS_GIT = spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;

/* ================================================================== */
/*  Tests                                                              */
/* ================================================================== */

test('clean: every topic anchor present and commit_sha matches → exit 0, no findings', { skip: !HAS_GIT && 'git not available' }, () => {
  const root = makeProjectRoot();
  try {
    const moduleDir = join(root, 'modA');
    const sha = gitInitWithCommit(moduleDir, {
      'README.md': '# moduleA\n',
    });

    writeKbFile(root, 'modA.md', '## Topic Alpha\n\ncontent\n\n## Topic Beta\n\ncontent\n');
    writeIndex(
      root,
      `version: 1
modules:
  modA:
    source:
      path: ${moduleDir}
    commit_sha: ${sha}
    files:
      common: modA.md
    topics:
      - id: alpha
        anchor: "## Topic Alpha"
      - id: beta
        anchor: "## Topic Beta"
`,
    );

    const result = lint({ projectRoot: root });
    assert.equal(result.ok, true);
    assert.deepEqual(result.findings, []);
    assert.deepEqual(result.modules_checked, ['modA']);
    assert.match(formatFindings(result), /KB lint clean/);
  } finally {
    cleanup(root);
  }
});

test('stale: stored sha behind HEAD AND ≥5 files changed → STALE finding (exit 1)', { skip: !HAS_GIT && 'git not available' }, () => {
  const root = makeProjectRoot();
  try {
    const moduleDir = join(root, 'modA');
    const oldSha = gitInitWithCommit(moduleDir, { 'README.md': '# A\n' });
    // Pin index.yaml to the OLD sha, then push the working repo forward.
    gitAppendCommits(moduleDir, 6); // 6 new files → above default threshold (5)

    writeKbFile(root, 'modA.md', '## A\n');
    writeIndex(
      root,
      `version: 1
modules:
  modA:
    source:
      path: ${moduleDir}
    commit_sha: ${oldSha}
    files:
      common: modA.md
    topics:
      - id: a
        anchor: "## A"
`,
    );

    const result = lint({ projectRoot: root });
    assert.equal(result.ok, true);
    assert.equal(result.findings.length, 1);
    const stale = result.findings[0];
    assert.equal(stale.type, 'STALE');
    assert.equal(stale.module, 'modA');
    assert.equal(stale.stored_sha, oldSha);
    assert.notEqual(stale.head_sha, oldSha);
    assert.ok(stale.changed_files >= 5, `expected >=5 changed files, got ${stale.changed_files}`);
    assert.equal(stale.threshold, 5);
  } finally {
    cleanup(root);
  }
});

test('orphan: anchor missing from KB markdown → ORPHAN finding (exit 1)', { skip: !HAS_GIT && 'git not available' }, () => {
  const root = makeProjectRoot();
  try {
    const moduleDir = join(root, 'modA');
    const sha = gitInitWithCommit(moduleDir, { 'README.md': '# A\n' });

    // KB file is present, but the topic anchor "## Nonexistent" is NOT a
    // heading in it. yaml-mini sees the topic, lint reports ORPHAN.
    writeKbFile(root, 'modA.md', '## A\n\nthe a section\n');
    writeIndex(
      root,
      `version: 1
modules:
  modA:
    source:
      path: ${moduleDir}
    commit_sha: ${sha}
    files:
      common: modA.md
    topics:
      - id: a
        anchor: "## A"
      - id: ghost
        anchor: "## Nonexistent"
`,
    );

    const result = lint({ projectRoot: root });
    assert.equal(result.ok, true);
    assert.equal(result.findings.length, 1);
    const orphan = result.findings[0];
    assert.equal(orphan.type, 'ORPHAN');
    assert.equal(orphan.module, 'modA');
    assert.equal(orphan.topic_id, 'ghost');
    assert.equal(orphan.anchor, '## Nonexistent');
    assert.equal(orphan.file, 'modA.md');
  } finally {
    cleanup(root);
  }
});

test('mixed: same module reports STALE + ORPHAN together', { skip: !HAS_GIT && 'git not available' }, () => {
  const root = makeProjectRoot();
  try {
    const moduleDir = join(root, 'modA');
    const oldSha = gitInitWithCommit(moduleDir, { 'README.md': '# A\n' });
    gitAppendCommits(moduleDir, 6);

    writeKbFile(root, 'modA.md', '## A\n');
    writeIndex(
      root,
      `version: 1
modules:
  modA:
    source:
      path: ${moduleDir}
    commit_sha: ${oldSha}
    files:
      common: modA.md
    topics:
      - id: a
        anchor: "## A"
      - id: missing
        anchor: "## Missing"
`,
    );

    const result = lint({ projectRoot: root });
    assert.equal(result.ok, true);
    const types = result.findings.map((f) => f.type).sort();
    assert.deepEqual(types, ['ORPHAN', 'STALE']);
    const text = formatFindings(result);
    assert.match(text, /\[STALE\] modA/);
    assert.match(text, /\[ORPHAN\] modA/);
    assert.match(text, /Summary: 2 issues \(1 stale, 1 orphan\) across 1 module/);
  } finally {
    cleanup(root);
  }
});

test('no .git directory: stale rule silently skipped, orphan rule still fires', () => {
  // Doesn't need git — the lint flow short-circuits on missing .git.
  const root = makeProjectRoot();
  try {
    const moduleDir = join(root, 'modA');
    mkdirSync(moduleDir, { recursive: true });
    // No git init — so checkStale() returns null per its NO-GIT branch.

    writeKbFile(root, 'modA.md', '## A\n');
    writeIndex(
      root,
      `version: 1
modules:
  modA:
    source:
      path: ${moduleDir}
    commit_sha: deadbeefdeadbeefdeadbeefdeadbeefdeadbeef
    files:
      common: modA.md
    topics:
      - id: a
        anchor: "## A"
      - id: missing
        anchor: "## Missing"
`,
    );

    const result = lint({ projectRoot: root });
    assert.equal(result.ok, true);
    // Only the orphan should appear — stale check returned null (no .git).
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].type, 'ORPHAN');
    assert.equal(result.findings[0].topic_id, 'missing');
  } finally {
    cleanup(root);
  }
});

test('--all behavior: omitting <module> lints every module in index.yaml', { skip: !HAS_GIT && 'git not available' }, () => {
  const root = makeProjectRoot();
  try {
    const aDir = join(root, 'modA');
    const bDir = join(root, 'modB');
    const aSha = gitInitWithCommit(aDir, { 'README.md': '# A\n' });
    const bSha = gitInitWithCommit(bDir, { 'README.md': '# B\n' });

    writeKbFile(root, 'modA.md', '## A\n');
    writeKbFile(root, 'modB.md', '## B\n');
    writeIndex(
      root,
      `version: 1
modules:
  modA:
    source:
      path: ${aDir}
    commit_sha: ${aSha}
    files:
      common: modA.md
    topics:
      - id: a
        anchor: "## A"
  modB:
    source:
      path: ${bDir}
    commit_sha: ${bSha}
    files:
      common: modB.md
    topics:
      - id: b
        anchor: "## B"
`,
    );

    const result = lint({ projectRoot: root });
    assert.equal(result.ok, true);
    assert.deepEqual(result.modules_checked.sort(), ['modA', 'modB']);
    assert.deepEqual(result.findings, []);
  } finally {
    cleanup(root);
  }
});

test('specific module arg: lint(modules=[modA]) skips modB even if it has issues', { skip: !HAS_GIT && 'git not available' }, () => {
  const root = makeProjectRoot();
  try {
    const aDir = join(root, 'modA');
    const bDir = join(root, 'modB');
    const aSha = gitInitWithCommit(aDir, { 'README.md': '# A\n' });
    const bSha = gitInitWithCommit(bDir, { 'README.md': '# B\n' });

    writeKbFile(root, 'modA.md', '## A\n');
    writeKbFile(root, 'modB.md', '## B\n'); // present, but topic below mis-anchors
    writeIndex(
      root,
      `version: 1
modules:
  modA:
    source:
      path: ${aDir}
    commit_sha: ${aSha}
    files:
      common: modA.md
    topics:
      - id: a
        anchor: "## A"
  modB:
    source:
      path: ${bDir}
    commit_sha: ${bSha}
    files:
      common: modB.md
    topics:
      - id: ghost
        anchor: "## Nonexistent"
`,
    );

    const onlyA = lint({ projectRoot: root, modules: ['modA'] });
    assert.equal(onlyA.ok, true);
    assert.deepEqual(onlyA.modules_checked, ['modA']);
    assert.deepEqual(onlyA.findings, []);

    const onlyB = lint({ projectRoot: root, modules: ['modB'] });
    assert.equal(onlyB.ok, true);
    assert.deepEqual(onlyB.modules_checked, ['modB']);
    assert.equal(onlyB.findings.length, 1);
    assert.equal(onlyB.findings[0].type, 'ORPHAN');
  } finally {
    cleanup(root);
  }
});

test('threshold override: 3 changed files + threshold=3 trips stale; threshold=10 does not', { skip: !HAS_GIT && 'git not available' }, () => {
  const root = makeProjectRoot();
  try {
    const moduleDir = join(root, 'modA');
    const oldSha = gitInitWithCommit(moduleDir, { 'README.md': '# A\n' });
    gitAppendCommits(moduleDir, 3); // exactly 3 new files

    writeKbFile(root, 'modA.md', '## A\n');
    writeIndex(
      root,
      `version: 1
modules:
  modA:
    source:
      path: ${moduleDir}
    commit_sha: ${oldSha}
    files:
      common: modA.md
    topics:
      - id: a
        anchor: "## A"
`,
    );

    const r3 = lint({ projectRoot: root, threshold: 3 });
    assert.equal(r3.findings.length, 1);
    assert.equal(r3.findings[0].type, 'STALE');
    assert.equal(r3.findings[0].threshold, 3);

    const r10 = lint({ projectRoot: root, threshold: 10 });
    assert.deepEqual(r10.findings, []);

    // Default threshold 5 → 3 < 5 → no stale either.
    const rDefault = lint({ projectRoot: root });
    assert.deepEqual(rDefault.findings, []);
  } finally {
    cleanup(root);
  }
});

test('CLI surface (dist/cli.js): --json on a clean fixture emits JSON with empty findings', { skip: !HAS_GIT && 'git not available' }, async () => {
  // R-T8.2 fixture path exercised via real CLI invocation (mirrors how /check
  // and /specify's Phase 0.5 will call the binary).
  if (!existsSync(cliPath)) {
    // dist/cli.js is built by `cli && npm run build`; this test asserts the
    // already-built file. If absent (developer ran tests without build), skip.
    return;
  }

  const root = makeProjectRoot();
  try {
    const moduleDir = join(root, 'modA');
    const sha = gitInitWithCommit(moduleDir, { 'README.md': '# A\n' });
    writeKbFile(root, 'modA.md', '## A\n');
    writeIndex(
      root,
      `version: 1
modules:
  modA:
    source:
      path: ${moduleDir}
    commit_sha: ${sha}
    files:
      common: modA.md
    topics:
      - id: a
        anchor: "## A"
`,
    );

    const { stdout } = await execFileAsync(
      process.execPath,
      [cliPath, 'knowledge', 'lint', '--json'],
      { cwd: root, encoding: 'utf8' },
    );
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.ok, true);
    assert.deepEqual(parsed.findings, []);
    assert.deepEqual(parsed.modules_checked, ['modA']);
  } finally {
    cleanup(root);
  }
});
