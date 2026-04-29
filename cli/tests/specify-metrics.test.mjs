import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('../../scripts/specify-metrics.mjs', import.meta.url);

async function run(args) {
  const { stdout } = await execFileAsync(process.execPath, [script.pathname, ...args], {
    env: { ...process.env, SPECIFY_METRICS_NOW_MS: '1000' },
  });
  return stdout;
}

test('mark appends JSONL events under spec_dir metrics directory', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'specify-metrics-'));

  await run(['mark', dir, 'phase0.5', 'phase_start', '--label', 'Context Research']);
  await run(['mark', dir, 'phase0.5', 'phase_end', '--label', 'Context Research']);

  const raw = await readFile(join(dir, 'metrics', 'specify-events.jsonl'), 'utf8');
  const events = raw.trim().split('\n').map((line) => JSON.parse(line));

  assert.equal(events.length, 2);
  assert.equal(events[0].phase, 'phase0.5');
  assert.equal(events[0].event, 'phase_start');
  assert.equal(events[0].label, 'Context Research');
  assert.equal(events[0].ts_ms, 1000);
});

test('report ranks phase durations and suggests bottleneck-specific improvements', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'specify-metrics-'));
  const events = [
    { ts_ms: 0, phase: 'phase0.5', event: 'phase_start', label: 'Context Research' },
    { ts_ms: 10000, phase: 'phase0.5', event: 'phase_end', label: 'Context Research' },
    { ts_ms: 10000, phase: 'phase1', event: 'phase_start', label: 'Interview' },
    { ts_ms: 11000, phase: 'phase1', event: 'gap_audit_start', label: 'business' },
    { ts_ms: 12000, phase: 'phase1', event: 'gap_audit_end', label: 'business' },
    { ts_ms: 13000, phase: 'phase1', event: 'gap_audit_start', label: 'tech' },
    { ts_ms: 14000, phase: 'phase1', event: 'gap_audit_end', label: 'tech' },
    { ts_ms: 40000, phase: 'phase1', event: 'phase_end', label: 'Interview' },
    { ts_ms: 40000, phase: 'phase2', event: 'phase_start', label: 'Extraction' },
    { ts_ms: 48000, phase: 'phase2', event: 'phase_end', label: 'Extraction' },
  ];

  for (const event of events) {
    const args = ['mark', dir, event.phase, event.event, '--label', event.label, '--at-ms', String(event.ts_ms)];
    await execFileAsync(process.execPath, [script.pathname, ...args]);
  }

  const report = await execFileAsync(process.execPath, [script.pathname, 'report', dir]);

  assert.match(report.stdout, /Top Bottlenecks/);
  assert.match(report.stdout, /\| phase1 \| 30\.0s \| 62\.5% \| Interview \|/);
  assert.match(report.stdout, /\| gap_audit \| phase1 \| business \| 1\.0s \|/);
  assert.match(report.stdout, /gap-auditor loops were observed \(2\)/);
});
