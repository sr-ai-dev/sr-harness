import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateKnowledgeIndex } from '../src/lib/json-io.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(__dirname, 'fixtures');

// Helper: wrap a single module entry into the full index.yaml shape.
function wrap(name, entry) {
  return { modules: { [name]: entry } };
}

test('validateKnowledgeIndex accepts minimal module without topics (legacy)', () => {
  // R-T5.1 / R-B6.3 — pre-migration module, no topics or hub_by_profile, MUST validate.
  const obj = wrap('spx/legacy-module', {
    file: 'spx/legacy-module.md',
    commit_sha: 'abc123',
  });
  const { ok, errors } = validateKnowledgeIndex(obj);
  assert.equal(ok, true, JSON.stringify(errors));
});

test('validateKnowledgeIndex accepts module with no optional fields at all', () => {
  // R-T5.1 — bare-minimum module; only `modules` key required at top level.
  const obj = wrap('spx/bare', {});
  const { ok, errors } = validateKnowledgeIndex(obj);
  assert.equal(ok, true, JSON.stringify(errors));
});

test('validateKnowledgeIndex accepts module with flat topics array', () => {
  const obj = wrap('spx/core-driver', {
    file: 'spx/core-driver.md',
    commit_sha: 'abc123',
    topics: [
      {
        id: 'motor-can-protocol',
        anchor: '## Motor CAN Protocol',
        summary: '8-byte CAN frame layout, 100Hz cycle',
        sr_profile: 'driver',
      },
      {
        id: 'encoder-calibration',
        anchor: '## Encoder Calibration',
        summary: 'Quadrature zero-offset routine',
      },
    ],
  });
  const { ok, errors } = validateKnowledgeIndex(obj);
  assert.equal(ok, true, JSON.stringify(errors));
});

test('validateKnowledgeIndex accepts module with topics_common + topics_ros1', () => {
  // R-T5.2 — ROS variant separation
  const obj = wrap('spx/core-driver', {
    files: {
      ros1: 'spx/core-driver.ros1.md',
      ros2: 'spx/core-driver.ros2.md',
    },
    topics_common: [
      { id: 'encoder-calibration', anchor: '## Encoder Calibration', summary: 'Common calibration' },
    ],
    topics_ros1: [
      { id: 'rosserial-bridge', anchor: '## rosserial Bridge', summary: 'ROS1 serial bridge mapping' },
    ],
  });
  const { ok, errors } = validateKnowledgeIndex(obj);
  assert.equal(ok, true, JSON.stringify(errors));
});

test('validateKnowledgeIndex rejects module with both topics AND topics_common (mutual exclusion)', () => {
  const obj = wrap('spx/conflict', {
    file: 'spx/conflict.md',
    topics: [
      { id: 'foo', anchor: '## Foo', summary: 'foo summary' },
    ],
    topics_common: [
      { id: 'bar', anchor: '## Bar', summary: 'bar summary' },
    ],
  });
  const { ok } = validateKnowledgeIndex(obj);
  assert.equal(ok, false);
});

test('validateKnowledgeIndex rejects topic missing required id field', () => {
  const obj = wrap('spx/missing-id', {
    file: 'spx/missing-id.md',
    topics: [
      { anchor: '## Section', summary: 'no id present' },
    ],
  });
  const { ok } = validateKnowledgeIndex(obj);
  assert.equal(ok, false);
});

test('validateKnowledgeIndex rejects topic id with uppercase (kebab-case enforced)', () => {
  const obj = wrap('spx/bad-id', {
    file: 'spx/bad-id.md',
    topics: [
      { id: 'MotorCANProtocol', anchor: '## Motor', summary: 'capitalized id' },
    ],
  });
  const { ok } = validateKnowledgeIndex(obj);
  assert.equal(ok, false);
});

test('validateKnowledgeIndex rejects topic summary > 80 chars', () => {
  const longSummary = 'x'.repeat(81);
  const obj = wrap('spx/long-summary', {
    file: 'spx/long-summary.md',
    topics: [
      { id: 'long', anchor: '## Long', summary: longSummary },
    ],
  });
  const { ok } = validateKnowledgeIndex(obj);
  assert.equal(ok, false);
});

test('validateKnowledgeIndex accepts module with valid hub_by_profile', () => {
  const obj = wrap('spx/core-driver', {
    file: 'spx/core-driver.md',
    hub_by_profile: {
      driver: { file: 'src/hardware/can_bus.cpp', in_refs: 14, out_refs: 3 },
      'ros-node': { file: 'src/ros_bridge/driver_node.cpp', in_refs: 8, out_refs: 11 },
      'cross-product': { file: 'src/integration/contracts.h', in_refs: 22, out_refs: 5 },
    },
  });
  const { ok, errors } = validateKnowledgeIndex(obj);
  assert.equal(ok, true, JSON.stringify(errors));
});

test('validateKnowledgeIndex rejects hub_by_profile entry missing in_refs', () => {
  // Defensive: ensures hub entries are also validated.
  const obj = wrap('spx/bad-hub', {
    file: 'spx/bad-hub.md',
    hub_by_profile: {
      driver: { file: 'src/foo.cpp', out_refs: 3 },
    },
  });
  const { ok } = validateKnowledgeIndex(obj);
  assert.equal(ok, false);
});

test('validateKnowledgeIndex accepts the canonical fixture (legacy + new modules)', async () => {
  // T4 — canonical fixture demonstrating R-T5.1 (legacy module without topics) +
  // R-T5.2 (multi-ROS module with topics_common/topics_ros1/topics_ros2 +
  // hub_by_profile keyed by sr_profile). Loaded as JSON because INV-8 forbids
  // new npm deps (no js-yaml available); the .yaml sibling is human reference.
  const raw = await readFile(join(FIXTURE_DIR, 'knowledge-index-with-topics.json'), 'utf8');
  const obj = JSON.parse(raw);
  const { ok, errors } = validateKnowledgeIndex(obj);
  assert.equal(ok, true, JSON.stringify(errors));
  // Sanity-check the fixture covers all three module shapes we care about.
  assert.ok(obj.modules['spx/legacy-module'], 'fixture must include a legacy module');
  assert.ok(Array.isArray(obj.modules['sarics-nx/backend'].topics), 'fixture must include a flat-topics module');
  assert.ok(Array.isArray(obj.modules['spx/core-driver'].topics_common), 'fixture must include a multi-ROS module');
});
