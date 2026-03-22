import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdirSync, rmSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CLI = resolve(import.meta.dirname, '../dist/cli.js');
const TMP = resolve(import.meta.dirname, '../.tmp-v7-test');
const SPEC = resolve(TMP, 'spec.json');

function run(cmd) {
  return execSync(`node ${CLI} ${cmd}`, { encoding: 'utf8', cwd: TMP });
}

function runFail(cmd) {
  try {
    execSync(`node ${CLI} ${cmd}`, { encoding: 'utf8', cwd: TMP, stdio: 'pipe' });
    assert.fail('Expected command to fail');
  } catch (e) {
    return e.stderr || e.stdout || '';
  }
}

function readSpec() {
  return JSON.parse(readFileSync(SPEC, 'utf8'));
}

describe('v7 schema', () => {
  before(() => {
    mkdirSync(TMP, { recursive: true });
  });

  after(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it('spec init with --schema v7 creates valid spec', () => {
    run(`spec init test-v7 --goal "Test v7" --schema v7 --type dev ${SPEC}`);
    const spec = readSpec();
    assert.equal(spec.meta.schema_version, 'v7');
    assert.equal(spec.meta.name, 'test-v7');
  });

  it('spec validate passes on fresh v7 spec', () => {
    const out = run(`spec validate ${SPEC}`);
    assert.match(out, /Coverage passed/);
  });

  it('spec merge --stdin works', () => {
    execSync(
      `echo '{"context":{"confirmed_goal":"Build a test system"}}' | node ${CLI} spec merge ${SPEC} --stdin`,
      { encoding: 'utf8', cwd: TMP }
    );
    const spec = readSpec();
    assert.equal(spec.context.confirmed_goal, 'Build a test system');
  });

  it('spec merge --stdin --append adds decisions', () => {
    execSync(
      `echo '{"context":{"decisions":[{"id":"D1","decision":"Use v7","rationale":"Simpler"}]}}' | node ${CLI} spec merge ${SPEC} --stdin --append`,
      { encoding: 'utf8', cwd: TMP }
    );
    const spec = readSpec();
    assert.equal(spec.context.decisions.length, 1);
    assert.equal(spec.context.decisions[0].id, 'D1');
  });

  it('spec merge appends second decision', () => {
    execSync(
      `echo '{"context":{"decisions":[{"id":"D2","decision":"TBD","rationale":"User unsure"}]}}' | node ${CLI} spec merge ${SPEC} --stdin --append`,
      { encoding: 'utf8', cwd: TMP }
    );
    const spec = readSpec();
    assert.equal(spec.context.decisions.length, 2);
    assert.equal(spec.context.decisions[1].id, 'D2');
  });

  it('spec merge constraints with v7 simplified schema', () => {
    execSync(
      `echo '{"constraints":[{"id":"C1","rule":"No breaking changes"}]}' | node ${CLI} spec merge ${SPEC} --stdin`,
      { encoding: 'utf8', cwd: TMP }
    );
    const spec = readSpec();
    assert.equal(spec.constraints[0].rule, 'No breaking changes');
  });

  it('spec merge requirements works', () => {
    execSync(
      `echo '{"requirements":[{"id":"R1","behavior":"Use v7 schema","sub":[{"id":"R1.1","behavior":"All specs use v7"}]},{"id":"R2","behavior":"JSON storage","sub":[{"id":"R2.1","behavior":"Valid JSON output"}]}]}' | node ${CLI} spec merge ${SPEC} --stdin`,
      { encoding: 'utf8', cwd: TMP }
    );
    const spec = readSpec();
    assert.equal(spec.requirements.length, 2);
    assert.equal(spec.requirements[0].sub.length, 1);
  });

  it('spec derive-tasks creates stubs from requirements', () => {
    const out = run(`spec derive-tasks ${SPEC}`);
    assert.match(out, /Derived 3 tasks/); // T1 + T2 + TF
    const spec = readSpec();
    assert.equal(spec.tasks.length, 3);
    assert.equal(spec.tasks[2].id, 'TF');
    assert.equal(spec.tasks[2].type, 'verification');
    assert.deepEqual(spec.tasks[2].depends_on, ['T1', 'T2']);
  });

  it('spec validate passes after derive-tasks', () => {
    const out = run(`spec validate ${SPEC}`);
    assert.match(out, /Coverage passed/);
  });

  it('spec guide --schema v7 shows simplified schema', () => {
    const out = run('spec guide constraints --schema v7');
    assert.match(out, /required: id, rule/);
    assert.doesNotMatch(out, /verified_by/); // v6 field not in v7
  });

  it('known_gaps is string array in v7', () => {
    execSync(
      `echo '{"context":{"known_gaps":["Performance TBD","Mobile layout undecided"]}}' | node ${CLI} spec merge ${SPEC} --stdin --append`,
      { encoding: 'utf8', cwd: TMP }
    );
    const spec = readSpec();
    assert.equal(spec.context.known_gaps.length, 2);
    assert.equal(typeof spec.context.known_gaps[0], 'string');
  });
});
