#!/usr/bin/env node
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const METRICS_FILE = 'specify-events.jsonl';

function usage(exitCode = 1) {
  const out = `Usage:
  specify-metrics.mjs mark <spec_dir> <phase> <event> [--label <text>] [--at-ms <ms>] [--meta <json>]
  specify-metrics.mjs report <spec_dir> [--json]

Events:
  phase_start / phase_end       Pair these per phase to compute phase duration.
  agent_start / agent_end       Optional. Use --label for agent name.
  gap_audit_start / gap_audit_end
  ask_user_start / ask_user_end
`;
  (exitCode === 0 ? console.log : console.error)(out.trimEnd());
  process.exit(exitCode);
}

function parseOptions(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--json') {
      options.json = true;
    } else if (arg === '--label') {
      options.label = args[++i];
    } else if (arg === '--at-ms') {
      options.atMs = Number(args[++i]);
    } else if (arg === '--meta') {
      options.meta = JSON.parse(args[++i]);
    } else if (arg === '--help' || arg === '-h') {
      usage(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return options;
}

function metricsPath(specDir) {
  return join(specDir, 'metrics', METRICS_FILE);
}

function nowMs(options) {
  if (Number.isFinite(options.atMs)) return options.atMs;
  if (process.env.SPECIFY_METRICS_NOW_MS) return Number(process.env.SPECIFY_METRICS_NOW_MS);
  return Date.now();
}

async function mark(args) {
  const [specDir, phase, event, ...rest] = args;
  if (!specDir || !phase || !event) usage();

  const options = parseOptions(rest);
  const tsMs = nowMs(options);
  const record = {
    ts: new Date(tsMs).toISOString(),
    ts_ms: tsMs,
    phase,
    event,
  };
  if (options.label) record.label = options.label;
  if (options.meta) record.meta = options.meta;

  const path = metricsPath(specDir);
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(record)}\n`, 'utf8');
}

async function readEvents(specDir) {
  const path = metricsPath(specDir);
  const raw = await readFile(path, 'utf8');
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .sort((a, b) => a.ts_ms - b.ts_ms);
}

function summarize(events) {
  const phaseStarts = new Map();
  const operationStarts = new Map();
  const phaseDurations = [];
  const operationDurations = [];
  const eventCounts = new Map();

  for (const event of events) {
    eventCounts.set(event.event, (eventCounts.get(event.event) || 0) + 1);

    if (event.event === 'phase_start') {
      phaseStarts.set(event.phase, event);
    } else if (event.event === 'phase_end') {
      const start = phaseStarts.get(event.phase);
      if (start) {
        phaseDurations.push({
          phase: event.phase,
          label: event.label || start.label || event.phase,
          start_ms: start.ts_ms,
          end_ms: event.ts_ms,
          duration_ms: Math.max(0, event.ts_ms - start.ts_ms),
        });
        phaseStarts.delete(event.phase);
      }
    } else if (event.event.endsWith('_start')) {
      const operation = event.event.slice(0, -'_start'.length);
      const key = operationKey(operation, event.phase, event.label);
      const starts = operationStarts.get(key) || [];
      starts.push(event);
      operationStarts.set(key, starts);
    } else if (event.event.endsWith('_end')) {
      const operation = event.event.slice(0, -'_end'.length);
      const key = operationKey(operation, event.phase, event.label);
      const starts = operationStarts.get(key) || [];
      const start = starts.shift();
      if (start) {
        operationDurations.push({
          operation,
          phase: event.phase,
          label: event.label || start.label || '',
          start_ms: start.ts_ms,
          end_ms: event.ts_ms,
          duration_ms: Math.max(0, event.ts_ms - start.ts_ms),
        });
      }
      if (starts.length === 0) operationStarts.delete(key);
    }
  }

  const totalMs = phaseDurations.reduce((sum, item) => sum + item.duration_ms, 0);
  phaseDurations.sort((a, b) => b.duration_ms - a.duration_ms);
  operationDurations.sort((a, b) => b.duration_ms - a.duration_ms);

  const counts = Object.fromEntries([...eventCounts.entries()].sort(([a], [b]) => a.localeCompare(b)));
  return {
    total_ms: totalMs,
    phases: phaseDurations.map((item) => ({
      ...item,
      percent: totalMs > 0 ? (item.duration_ms / totalMs) * 100 : 0,
    })),
    operations: operationDurations,
    counts,
    recommendations: recommendations(phaseDurations, totalMs, counts, operationDurations),
  };
}

function operationKey(operation, phase, label = '') {
  return JSON.stringify([operation, phase, label || '']);
}

function recommendations(phases, totalMs, counts, operations) {
  const notes = [];
  const top = phases[0];
  if (!top || totalMs <= 0) return notes;

  const topPercent = (top.duration_ms / totalMs) * 100;
  if (top.phase === 'phase0.5' && topPercent >= 30) {
    notes.push('Phase 0.5 dominates: prefer KB-first reuse, avoid re-scan unless stale, and narrow code-explorer scope.');
  }
  if (top.phase === 'phase1' && topPercent >= 40) {
    notes.push('Phase 1 dominates: reduce interview turns by batching stable questions and check gap-auditor loop count.');
  }
  if (top.phase === 'phase2' && topPercent >= 30) {
    notes.push('Phase 2 dominates: verify extractor agents actually run in parallel and inspect per-agent durations.');
  }
  if ((counts.gap_audit_start || 0) > 0) {
    notes.push(`gap-auditor loops were observed (${counts.gap_audit_start}); repeated CONTINUE verdicts are a likely latency source.`);
  }
  if ((counts.ask_user_start || 0) >= 4) {
    notes.push(`AskUserQuestion turns were observed (${counts.ask_user_start}); user wait time may dominate wall-clock latency.`);
  }
  const topOperation = operations[0];
  if (topOperation?.operation === 'agent') {
    notes.push(`Slowest measured agent operation: ${topOperation.label || 'unlabeled'} in ${topOperation.phase} (${seconds(topOperation.duration_ms)}).`);
  }
  if (topOperation?.operation === 'ask_user') {
    notes.push(`Slowest measured operation is user wait in ${topOperation.phase} (${seconds(topOperation.duration_ms)}); batch questions before asking.`);
  }
  if (topOperation?.operation === 'gap_audit') {
    notes.push(`Slowest measured gap audit: ${topOperation.label || 'unlabeled'} in ${topOperation.phase} (${seconds(topOperation.duration_ms)}).`);
  }
  return notes;
}

function seconds(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function renderMarkdown(summary) {
  const lines = [];
  lines.push('# /specify Performance Report');
  lines.push('');
  lines.push(`Total measured phase time: ${seconds(summary.total_ms)}`);
  lines.push('');
  lines.push('## Top Bottlenecks');
  lines.push('');
  lines.push('| Phase | Duration | Share | Label |');
  lines.push('|---|---:|---:|---|');
  for (const phase of summary.phases) {
    lines.push(`| ${phase.phase} | ${seconds(phase.duration_ms)} | ${phase.percent.toFixed(1)}% | ${markdownCell(phase.label)} |`);
  }
  lines.push('');
  lines.push('## Operation Durations');
  lines.push('');
  if (summary.operations.length === 0) {
    lines.push('- No paired operation events captured.');
  } else {
    lines.push('| Operation | Phase | Label | Duration |');
    lines.push('|---|---|---|---:|');
    for (const operation of summary.operations) {
      lines.push(
        `| ${operation.operation} | ${operation.phase} | ${markdownCell(operation.label || '-')} | ${seconds(operation.duration_ms)} |`,
      );
    }
  }
  lines.push('');
  lines.push('## Event Counts');
  lines.push('');
  lines.push('| Event | Count |');
  lines.push('|---|---:|');
  for (const [event, count] of Object.entries(summary.counts)) {
    lines.push(`| ${event} | ${count} |`);
  }
  lines.push('');
  lines.push('## Improvement Candidates');
  lines.push('');
  if (summary.recommendations.length === 0) {
    lines.push('- No obvious bottleneck pattern found from the captured events.');
  } else {
    for (const note of summary.recommendations) lines.push(`- ${note}`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function markdownCell(value) {
  return String(value).replaceAll('|', '\\|');
}

async function report(args) {
  const [specDir, ...rest] = args;
  if (!specDir) usage();
  const options = parseOptions(rest);
  const summary = summarize(await readEvents(specDir));
  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    process.stdout.write(renderMarkdown(summary));
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  try {
    if (command === 'mark') await mark(args);
    else if (command === 'report') await report(args);
    else usage(command ? 1 : 0);
  } catch (error) {
    console.error(`specify-metrics: ${error.message}`);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
