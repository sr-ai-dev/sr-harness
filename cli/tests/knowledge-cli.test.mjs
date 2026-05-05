// knowledge CLI scaffold tests (T2 / PR1)
//
// Verifies R-T3.1 / R-T3.2 / R-T3.3:
//   - knowledge group is registered and dispatchable via `hoyeon-cli knowledge ...`
//   - `--help` lists all 5 subcommands
//   - each subcommand stub prints "not yet implemented" and exits 0
//   - unknown subcommand exits 1 with an error
//
// Tests invoke the bundled dist/cli.js (R-T3.3) via execFile to mirror real CLI usage.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const cliPath = new URL('../dist/cli.js', import.meta.url).pathname;

async function runCli(args, { allowFailure = false } = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [cliPath, ...args]);
    return { code: 0, stdout, stderr };
  } catch (err) {
    if (!allowFailure) throw err;
    return { code: err.code ?? 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
  }
}

test('knowledge --help lists all 5 subcommands and exits 0', async () => {
  const { code, stdout } = await runCli(['knowledge', '--help']);
  assert.equal(code, 0);
  for (const sub of ['lint', 'index-update', 'graph-link', 'graph-build', 'graph-clean']) {
    assert.match(stdout, new RegExp(sub), `--help output should mention '${sub}'`);
  }
});

test('knowledge (no subcommand) prints help and exits 0', async () => {
  const { code, stdout } = await runCli(['knowledge']);
  assert.equal(code, 0);
  assert.match(stdout, /Usage:\s+hoyeon-cli knowledge/);
});

test('knowledge lint --help advertises stale + orphan detection (PR2 / T7)', async () => {
  const { code, stdout } = await runCli(['knowledge', 'lint', '--help']);
  assert.equal(code, 0);
  assert.match(stdout, /knowledge lint/);
  assert.match(stdout, /STALE/);
  assert.match(stdout, /ORPHAN/);
  // Exit-code contract is part of the public surface — keep it documented.
  assert.match(stdout, /Exit codes/);
});

test("knowledge index-update stub prints 'not yet implemented' and exits 0", async () => {
  const { code, stdout } = await runCli(['knowledge', 'index-update']);
  assert.equal(code, 0);
  assert.match(stdout, /\[knowledge index-update\] not yet implemented/);
});

test("knowledge graph-link stub prints 'not yet implemented' and exits 0", async () => {
  const { code, stdout } = await runCli(['knowledge', 'graph-link']);
  assert.equal(code, 0);
  assert.match(stdout, /\[knowledge graph-link\] not yet implemented \(lands in PR6\)/);
});

test("knowledge graph-build stub prints 'not yet implemented' and exits 0", async () => {
  const { code, stdout } = await runCli(['knowledge', 'graph-build']);
  assert.equal(code, 0);
  assert.match(stdout, /\[knowledge graph-build\] not yet implemented \(lands in PR6\)/);
});

test("knowledge graph-clean stub prints 'not yet implemented' and exits 0", async () => {
  const { code, stdout } = await runCli(['knowledge', 'graph-clean']);
  assert.equal(code, 0);
  assert.match(stdout, /\[knowledge graph-clean\] not yet implemented \(lands in PR6\)/);
});

test('knowledge unknown-sub exits 1 with error message', async () => {
  const { code, stderr } = await runCli(['knowledge', 'unknown-sub'], { allowFailure: true });
  assert.equal(code, 1);
  assert.match(stderr, /unknown knowledge subcommand 'unknown-sub'/);
});

test('top-level --help advertises the knowledge group', async () => {
  // R-T3.x rollup: cli.js USAGE banner must list the new group so users discover it.
  const { code, stdout } = await runCli(['--help']);
  assert.equal(code, 0);
  assert.match(stdout, /knowledge\s+KB index \+ graph operations/);
});
