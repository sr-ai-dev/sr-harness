// yaml-mini parser tests (PR2 / T7).
//
// Verifies the subset documented in cli/src/lib/yaml-mini.js is enough to read
// .sr-harness/knowledge/index.yaml without a YAML npm dependency (INV-8).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parse, YamlMiniParseError } from '../src/lib/yaml-mini.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(__dirname, 'fixtures');

test('parses a simple mapping with bare scalars', () => {
  const out = parse('a: 1\nb: hello\nc: true\nd: null\n');
  assert.deepEqual(out, { a: 1, b: 'hello', c: true, d: null });
});

test('parses single-quoted and double-quoted scalars', () => {
  const out = parse(`a: 'hello: world'\nb: "with #hash"\nc: 'it''s ok'\n`);
  assert.equal(out.a, 'hello: world');
  assert.equal(out.b, 'with #hash');
  assert.equal(out.c, "it's ok");
});

test('parses nested mappings at 2-space indent', () => {
  const src = `parent:
  child:
    grandchild: 42
    other: "x"
`;
  const out = parse(src);
  assert.deepEqual(out, { parent: { child: { grandchild: 42, other: 'x' } } });
});

test('parses block sequence of scalars', () => {
  const src = `items:
  - foo
  - bar
  - 1
`;
  const out = parse(src);
  assert.deepEqual(out, { items: ['foo', 'bar', 1] });
});

test('parses sequence of mappings (dash-inlined first key)', () => {
  const src = `topics:
  - id: motor-can-protocol
    anchor: "## Motor CAN Protocol"
    summary: 8-byte CAN frame layout
  - id: encoder-calibration
    anchor: "## Encoder Calibration"
    summary: zero-offset routine
`;
  const out = parse(src);
  assert.equal(out.topics.length, 2);
  assert.equal(out.topics[0].id, 'motor-can-protocol');
  assert.equal(out.topics[0].anchor, '## Motor CAN Protocol');
  assert.equal(out.topics[1].id, 'encoder-calibration');
});

test('strips full-line and trailing comments outside quotes', () => {
  const src = `# top-level comment
a: 1   # trailing comment
b: "still: # not a comment"
`;
  const out = parse(src);
  assert.deepEqual(out, { a: 1, b: 'still: # not a comment' });
});

test('treats null / ~ / empty value as JS null', () => {
  const out = parse('ros: null\nfoo: ~\nbar:\n');
  assert.equal(out.ros, null);
  assert.equal(out.foo, null);
  assert.equal(out.bar, null);
});

test('rejects tab indentation with a clear error', () => {
  assert.throws(() => parse('a:\n\tb: 1\n'), (err) => err instanceof YamlMiniParseError && /tab/i.test(err.message));
});

test('rejects multi-document marker', () => {
  assert.throws(() => parse('a: 1\n---\nb: 2\n'), (err) => err instanceof YamlMiniParseError);
});

test('round-trips the canonical fixture: yaml.parse(.yaml) == JSON.parse(.json)', async () => {
  // The .yaml is the human-edited shape. The .json is the test/AJV input. The
  // two MUST round-trip — that is the contract of yaml-mini for index.yaml.
  const [yamlSrc, jsonSrc] = await Promise.all([
    readFile(join(FIXTURE_DIR, 'knowledge-index-with-topics.yaml'), 'utf8'),
    readFile(join(FIXTURE_DIR, 'knowledge-index-with-topics.json'), 'utf8'),
  ]);
  const parsedYaml = parse(yamlSrc);
  const parsedJson = JSON.parse(jsonSrc);
  assert.deepEqual(parsedYaml, parsedJson);
});

test('parses cross_modules array form used in real index.yaml', () => {
  const src = `modules:
  sarics-spx-bridge:
    cross_modules:
    - spx-driver
    - backend
    files:
      common: cross/sarics-spx.md
`;
  const out = parse(src);
  assert.deepEqual(out.modules['sarics-spx-bridge'].cross_modules, ['spx-driver', 'backend']);
  assert.equal(out.modules['sarics-spx-bridge'].files.common, 'cross/sarics-spx.md');
});

test('parses ISO-8601 timestamp inside single quotes (real index.yaml shape)', () => {
  const src = `modules:
  backend:
    scanned_at: '2026-04-29T00:00:00+09:00'
    commit_sha: ef8bc3a69e1ad1d215b80eda0e39754b9b9d15f7
`;
  const out = parse(src);
  assert.equal(out.modules.backend.scanned_at, '2026-04-29T00:00:00+09:00');
  assert.equal(out.modules.backend.commit_sha, 'ef8bc3a69e1ad1d215b80eda0e39754b9b9d15f7');
});
