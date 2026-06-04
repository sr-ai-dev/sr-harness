import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  getFlag,
  getFlags,
  _resetSettingsCache,
} from '../src/lib/settings.js';

function makeFakeHome() {
  const home = mkdtempSync(join(tmpdir(), 'sr-harness-home-'));
  mkdirSync(join(home, '.claude'), { recursive: true });
  return home;
}

function makeFakeCwd() {
  const cwd = mkdtempSync(join(tmpdir(), 'sr-harness-cwd-'));
  mkdirSync(join(cwd, '.claude'), { recursive: true });
  return cwd;
}

function writeSettings(dir, payload) {
  writeFileSync(join(dir, '.claude', 'settings.json'), JSON.stringify(payload));
}

function withFakeHome(home, fn) {
  const orig = process.env.HOME;
  process.env.HOME = home;
  try {
    return fn();
  } finally {
    if (orig === undefined) delete process.env.HOME;
    else process.env.HOME = orig;
  }
}

test('returns default when neither user nor project settings exist', () => {
  _resetSettingsCache();
  const home = makeFakeHome();
  const cwd = mkdtempSync(join(tmpdir(), 'sr-harness-cwd-'));
  try {
    withFakeHome(home, () => {
      assert.equal(getFlag('kb_topics_lookup', false, { cwd }), false);
      assert.equal(getFlag('graphify_hub_n', 10, { cwd }), 10);
    });
  } finally {
    rmSync(home, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('returns user-level value when project settings absent', () => {
  _resetSettingsCache();
  const home = makeFakeHome();
  const cwd = mkdtempSync(join(tmpdir(), 'sr-harness-cwd-'));
  writeSettings(home, { kb_topics_lookup: true, graphify_hub_n: 20 });
  try {
    withFakeHome(home, () => {
      assert.equal(getFlag('kb_topics_lookup', false, { cwd }), true);
      assert.equal(getFlag('graphify_hub_n', 10, { cwd }), 20);
    });
  } finally {
    rmSync(home, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('project settings override user settings', () => {
  _resetSettingsCache();
  const home = makeFakeHome();
  const cwd = makeFakeCwd();
  writeSettings(home, { kb_lint: true });
  writeSettings(cwd, { kb_lint: false });
  try {
    withFakeHome(home, () => {
      assert.equal(getFlag('kb_lint', false, { cwd }), false);
    });
  } finally {
    rmSync(home, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('invalid JSON in user settings falls back to default and warns once', () => {
  _resetSettingsCache();
  const home = makeFakeHome();
  const cwd = mkdtempSync(join(tmpdir(), 'sr-harness-cwd-'));
  writeFileSync(join(home, '.claude', 'settings.json'), '{ this is not json');

  let warnings = 0;
  const origWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk, ...rest) => {
    if (typeof chunk === 'string' && chunk.includes('[sr-harness settings]')) {
      warnings += 1;
      return true;
    }
    return origWrite(chunk, ...rest);
  };

  try {
    withFakeHome(home, () => {
      assert.equal(getFlag('kb_topics_lookup', false, { cwd }), false);
      // Second read must not emit another warning (cache + warned-set).
      assert.equal(getFlag('kb_lint', true, { cwd }), true);
    });
    assert.equal(warnings, 1);
  } finally {
    process.stderr.write = origWrite;
    rmSync(home, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('missing user settings file returns default without throwing', () => {
  _resetSettingsCache();
  const home = makeFakeHome();
  const cwd = mkdtempSync(join(tmpdir(), 'sr-harness-cwd-'));
  // Do not create settings.json under home/.claude
  try {
    withFakeHome(home, () => {
      assert.equal(getFlag('graphify_enabled', false, { cwd }), false);
    });
  } finally {
    rmSync(home, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('non-boolean flag values are returned as-is', () => {
  _resetSettingsCache();
  const home = makeFakeHome();
  const cwd = mkdtempSync(join(tmpdir(), 'sr-harness-cwd-'));
  writeSettings(home, { graphify_hub_n: 25, kb_phase1_provenance: 'experimental' });
  try {
    withFakeHome(home, () => {
      assert.equal(getFlag('graphify_hub_n', 10, { cwd }), 25);
      assert.equal(getFlag('kb_phase1_provenance', false, { cwd }), 'experimental');
    });
  } finally {
    rmSync(home, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('getFlags batch returns map respecting overrides + defaults', () => {
  _resetSettingsCache();
  const home = makeFakeHome();
  const cwd = makeFakeCwd();
  writeSettings(home, { kb_topics_lookup: true, kb_lint: true, graphify_hub_n: 10 });
  writeSettings(cwd, { kb_lint: false });
  try {
    withFakeHome(home, () => {
      const flags = getFlags(
        ['kb_topics_lookup', 'kb_lint', 'graphify_enabled', 'graphify_hub_n'],
        { cwd, defaults: { graphify_hub_n: 5 } },
      );
      assert.deepEqual(flags, {
        kb_topics_lookup: true,
        kb_lint: false,
        graphify_enabled: false,
        graphify_hub_n: 10,
      });
    });
  } finally {
    rmSync(home, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  }
});
