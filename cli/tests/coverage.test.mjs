/**
 * Integration tests for hoyeon-cli spec validate (merged schema + coverage).
 *
 * Run: node --test cli/tests/coverage.test.mjs
 *
 * Tests:
 *  1. spec validate passes schema + coverage on valid spec (--json)
 *  2. spec validate --layer decisions checks decision-requirement traceability
 *  3. spec validate --layer scenarios checks scenario coverage completeness
 *  4. spec validate detects coverage gaps (uncovered decisions) on schema-valid spec
 *  5. spec validate detects orphaned requirement references in tasks
 *  6. spec validate --json returns unified { valid, errors, coverage, gaps } shape
 *  7. spec validate schema failure skips coverage (coverage: null)
 *  8. spec coverage legacy alias still works
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFixture, createTempSpec, runCli } from './helpers.js';

// ============================================================
// Test 1: spec validate passes schema + coverage on valid spec
// ============================================================
test('spec validate passes schema + coverage on valid spec (--json)', () => {
  const { path, cleanup } = createTempSpec(loadFixture('coverage-valid.json'));

  try {
    const { stdout, status } = runCli(['spec', 'validate', path, '--json']);
    assert.equal(status, 0, `exit code should be 0, got: ${status}`);
    const result = JSON.parse(stdout);
    assert.equal(result.valid, true, 'valid should be true');
    assert.deepEqual(result.errors, [], 'errors should be empty');
    assert.equal(result.coverage, 'pass', 'coverage should be "pass"');
    assert.deepEqual(result.gaps, [], 'gaps should be empty');
  } finally {
    cleanup();
  }
});

// ============================================================
// Test 2: spec validate --layer decisions checks decision-requirement traceability
// ============================================================
test('spec validate --layer decisions checks decision-requirement traceability', () => {
  const { path, cleanup } = createTempSpec(loadFixture('coverage-valid.json'));

  try {
    const { stdout, status } = runCli(['spec', 'validate', path, '--layer', 'decisions', '--json']);
    assert.equal(status, 0, `exit code should be 0, got: ${status}`);
    const result = JSON.parse(stdout);
    assert.equal(result.valid, true, 'schema should be valid');
    assert.equal(result.coverage, 'pass', 'decisions layer should pass on valid spec');
    assert.ok(
      result.gaps.filter(g => g.layer === 'decisions').length === 0,
      'no decision gaps expected',
    );
  } finally {
    cleanup();
  }
});

// ============================================================
// Test 3: spec validate --layer scenarios checks scenario coverage completeness
// ============================================================
test('spec validate --layer scenarios checks scenario coverage completeness', () => {
  const { path, cleanup } = createTempSpec(loadFixture('coverage-valid.json'));

  try {
    const { stdout, status } = runCli(['spec', 'validate', path, '--layer', 'scenarios', '--json']);
    assert.equal(status, 0, `exit code should be 0, got: ${status}`);
    const result = JSON.parse(stdout);
    assert.equal(result.valid, true, 'schema should be valid');
    assert.equal(result.coverage, 'pass', 'scenarios layer should pass on valid spec');
  } finally {
    cleanup();
  }
});

// ============================================================
// Test 4: spec validate detects uncovered decisions (coverage gaps on schema-valid spec)
// ============================================================
test('spec validate detects uncovered decisions (coverage gap, schema valid)', () => {
  const { path, cleanup } = createTempSpec(loadFixture('coverage-missing-decision.json'));

  try {
    const { stdout, status } = runCli(['spec', 'validate', path, '--json'], { expectFail: true });
    assert.notEqual(status, 0, 'exit code should be non-zero when coverage gaps exist');
    const result = JSON.parse(stdout);
    assert.equal(result.valid, true, 'schema should still be valid');
    assert.equal(result.coverage, 'fail', 'coverage should be "fail"');
    assert.ok(result.gaps.length > 0, 'gaps should be non-empty');

    const decisionGaps = result.gaps.filter(g => g.layer === 'decisions');
    assert.ok(decisionGaps.length > 0, 'should have decision-layer gaps');

    const hasSourceRefError = decisionGaps.some(g => g.check === 'source.ref-integrity');
    const hasCoverageError = decisionGaps.some(g => g.check === 'decision-coverage');
    assert.ok(
      hasSourceRefError || hasCoverageError,
      `gaps should include source.ref-integrity or decision-coverage check, got: ${JSON.stringify(decisionGaps)}`,
    );
  } finally {
    cleanup();
  }
});

// ============================================================
// Test 5: spec validate detects orphaned requirement references in tasks
// ============================================================
test('spec validate detects orphaned requirement references in tasks', () => {
  const { path, cleanup } = createTempSpec(loadFixture('coverage-orphan-sub.json'));

  try {
    const { stdout, status } = runCli(['spec', 'validate', path, '--json'], { expectFail: true });
    assert.notEqual(status, 0, 'exit code should be non-zero when orphan requirements exist');
    const result = JSON.parse(stdout);
    assert.equal(result.valid, true, 'schema should still be valid');
    assert.equal(result.coverage, 'fail', 'coverage should be "fail"');

    const orphanGaps = result.gaps.filter(g => g.check === 'orphan-requirement' || g.check === 'orphan-scenario');
    assert.ok(orphanGaps.length > 0, 'should detect at least one orphaned requirement');
    assert.ok(
      orphanGaps.some(g => g.message.includes('R2')),
      `orphan gap should mention R2, got: ${JSON.stringify(orphanGaps)}`,
    );
  } finally {
    cleanup();
  }
});

// ============================================================
// Test 6: spec validate --json returns unified output shape
// ============================================================
test('spec validate --json returns unified { valid, errors, coverage, gaps } shape', () => {
  const { path, cleanup } = createTempSpec(loadFixture('coverage-valid.json'));

  try {
    const { stdout, status } = runCli(['spec', 'validate', path, '--json']);
    assert.equal(status, 0);
    const result = JSON.parse(stdout);
    assert.ok('valid' in result, 'result should have valid field');
    assert.ok('errors' in result, 'result should have errors field');
    assert.ok('coverage' in result, 'result should have coverage field');
    assert.ok('gaps' in result, 'result should have gaps field');
  } finally {
    cleanup();
  }
});

// ============================================================
// Test 7: spec validate schema failure skips coverage (coverage: null)
// ============================================================
test('spec validate schema failure skips coverage (coverage: null in --json)', () => {
  const { path, cleanup } = createTempSpec({
    meta: { name: 'test', goal: 'test goal' },
    tasks: [
      {
        id: 'T1',
        action: 'some task',
        type: 'work',
        status: 'INVALID_STATUS',
      },
    ],
  });

  try {
    const { stdout, status } = runCli(['spec', 'validate', path, '--json'], { expectFail: true });
    assert.notEqual(status, 0, 'exit code should be non-zero on schema failure');
    const result = JSON.parse(stdout);
    assert.equal(result.valid, false, 'valid should be false');
    assert.ok(result.errors.length > 0, 'errors should be non-empty');
    assert.equal(result.coverage, null, 'coverage should be null when schema fails');
    assert.deepEqual(result.gaps, [], 'gaps should be empty when schema fails');
  } finally {
    cleanup();
  }
});

// ============================================================
// Test 8: spec coverage legacy alias still works
// ============================================================
test('spec coverage legacy alias still works', () => {
  const { path, cleanup } = createTempSpec(loadFixture('coverage-valid.json'));

  try {
    const { stdout, status } = runCli(['spec', 'coverage', path, '--json']);
    assert.equal(status, 0, `exit code should be 0, got: ${status}`);
    const result = JSON.parse(stdout);
    assert.equal(result.coverage, 'pass', 'coverage should be "pass"');
    assert.deepEqual(result.gaps, [], 'gaps should be empty');
  } finally {
    cleanup();
  }
});
