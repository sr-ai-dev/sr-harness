import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SPEC_HELP = `
Usage:
  dev-cli spec validate <path>             Validate a spec.json file against the schema
  dev-cli spec plan <path> [--format text|mermaid|json]  Show execution plan with parallel groups
  dev-cli spec amend --reason <feedback-id> --spec <path>  Amend spec.json based on feedback

Options:
  --help, -h    Show this help message

Examples:
  dev-cli spec validate ./spec.json
  dev-cli spec plan ./spec.json
  dev-cli spec plan ./spec.json --format mermaid
  dev-cli spec amend --reason fb-001 --spec ./spec.json
`;

function loadSchema() {
  const schemaPath = resolve(__dirname, '../../schemas/dev-spec-v4.schema.json');
  const raw = readFileSync(schemaPath, 'utf8');
  return JSON.parse(raw);
}

async function handleValidate(args) {
  const filePath = args[0];

  if (!filePath) {
    process.stderr.write('Error: missing <path> argument\n');
    process.stderr.write('Usage: dev-cli spec validate <path>\n');
    process.exit(1);
  }

  let data;
  try {
    const raw = readFileSync(filePath, 'utf8');
    data = JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') {
      process.stderr.write(`Error: file not found: ${filePath}\n`);
    } else if (err instanceof SyntaxError) {
      process.stderr.write(`Error: invalid JSON in ${filePath}: ${err.message}\n`);
    } else {
      process.stderr.write(`Error: could not read file: ${err.message}\n`);
    }
    process.exit(1);
  }

  let schema;
  try {
    schema = loadSchema();
  } catch (err) {
    process.stderr.write(`Error: could not load schema: ${err.message}\n`);
    process.exit(1);
  }

  const ajv = new Ajv2020({ allErrors: true });
  addFormats(ajv);

  const validate = ajv.compile(schema);
  const valid = validate(data);

  if (valid) {
    process.stdout.write(JSON.stringify({ valid: true, errors: [] }) + '\n');
    process.exit(0);
  } else {
    const errors = validate.errors.map((e) => ({
      instancePath: e.instancePath,
      schemaPath: e.schemaPath,
      keyword: e.keyword,
      message: e.message,
      params: e.params,
    }));

    process.stdout.write(JSON.stringify({ valid: false, errors }) + '\n');
    process.stderr.write('Validation failed:\n');
    for (const e of validate.errors) {
      const path = e.instancePath || '(root)';
      process.stderr.write(`  ${path}: ${e.message}\n`);
    }
    process.exit(1);
  }
}

function loadSpec(filePath) {
  try {
    const raw = readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') {
      process.stderr.write(`Error: file not found: ${filePath}\n`);
    } else if (err instanceof SyntaxError) {
      process.stderr.write(`Error: invalid JSON in ${filePath}: ${err.message}\n`);
    } else {
      process.stderr.write(`Error: could not read file: ${err.message}\n`);
    }
    process.exit(1);
  }
}

/**
 * Build execution plan from spec.json tasks using topological sort.
 * Groups tasks into parallel rounds based on depends_on.
 */
function buildPlan(tasks) {
  const taskMap = new Map();
  for (const t of tasks) {
    taskMap.set(t.id, { ...t, depends_on: t.depends_on || [] });
  }

  // Validate dependency references
  for (const t of taskMap.values()) {
    for (const dep of t.depends_on) {
      if (!taskMap.has(dep)) {
        process.stderr.write(`Warning: task ${t.id} depends on unknown task ${dep}\n`);
      }
    }
  }

  // Kahn's algorithm — topological sort into rounds
  const inDegree = new Map();
  for (const t of taskMap.values()) {
    if (!inDegree.has(t.id)) inDegree.set(t.id, 0);
    for (const dep of t.depends_on) {
      // dep → t.id edge
      inDegree.set(t.id, (inDegree.get(t.id) || 0));
    }
  }
  // Count in-degrees
  for (const t of taskMap.values()) {
    inDegree.set(t.id, t.depends_on.filter(d => taskMap.has(d)).length);
  }

  const rounds = [];
  const done = new Set();

  while (done.size < taskMap.size) {
    const round = [];
    for (const t of taskMap.values()) {
      if (done.has(t.id)) continue;
      const allDepsDone = t.depends_on.every(d => done.has(d) || !taskMap.has(d));
      if (allDepsDone) round.push(t.id);
    }

    if (round.length === 0) {
      // Cycle detection
      const remaining = [...taskMap.keys()].filter(id => !done.has(id));
      process.stderr.write(`Error: circular dependency detected among: ${remaining.join(', ')}\n`);
      process.exit(1);
    }

    rounds.push(round);
    for (const id of round) done.add(id);
  }

  return rounds;
}

/**
 * Find the critical path (longest path through the DAG).
 */
function findCriticalPath(tasks) {
  const taskMap = new Map();
  for (const t of tasks) {
    taskMap.set(t.id, { ...t, depends_on: t.depends_on || [] });
  }

  // longest path to each node + predecessor
  const dist = new Map();
  const pred = new Map();
  for (const id of taskMap.keys()) {
    dist.set(id, 0);
    pred.set(id, null);
  }

  // Process in topological order
  const rounds = buildPlan(tasks);
  for (const round of rounds) {
    for (const id of round) {
      const t = taskMap.get(id);
      for (const dep of t.depends_on) {
        if (!taskMap.has(dep)) continue;
        if (dist.get(dep) + 1 > dist.get(id)) {
          dist.set(id, dist.get(dep) + 1);
          pred.set(id, dep);
        }
      }
    }
  }

  // Find the node with max distance
  let maxDist = -1;
  let endNode = null;
  for (const [id, d] of dist) {
    if (d > maxDist) {
      maxDist = d;
      endNode = id;
    }
  }

  // Trace back
  const path = [];
  let cur = endNode;
  while (cur) {
    path.unshift(cur);
    cur = pred.get(cur);
  }

  return path;
}

function formatText(spec, rounds, criticalPath) {
  const taskMap = new Map();
  for (const t of spec.tasks) taskMap.set(t.id, t);

  const lines = [];
  lines.push(`Plan: ${spec.meta.name}`);
  lines.push(`Goal: ${spec.meta.goal}`);
  lines.push('');

  const totalTasks = spec.tasks.length;
  const parallelTasks = rounds.filter(r => r.length > 1).reduce((sum, r) => sum + r.length, 0);
  lines.push(`Tasks: ${totalTasks}  Rounds: ${rounds.length}  Max parallel: ${Math.max(...rounds.map(r => r.length))}`);
  lines.push('');

  for (let i = 0; i < rounds.length; i++) {
    const round = rounds[i];
    const parallel = round.length > 1;
    lines.push(`Round ${i + 1}${parallel ? ' (parallel)' : ''}:`);
    for (const id of round) {
      const t = taskMap.get(id);
      const type = t.type === 'verification' ? 'verify' : 'work';
      const risk = t.risk ? ` [${t.risk}]` : '';
      const deps = (t.depends_on || []).length > 0 ? ` ← ${t.depends_on.join(', ')}` : '';
      const cp = criticalPath.includes(id) ? ' *' : '';
      lines.push(`  ${id}: ${t.action} (${type}${risk})${deps}${cp}`);
    }
    lines.push('');
  }

  lines.push(`Critical path: ${criticalPath.join(' → ')}`);

  // Show fulfills summary if any task has it
  const hasFulfills = spec.tasks.some(t => t.fulfills && t.fulfills.length > 0);
  if (hasFulfills) {
    lines.push('');
    lines.push('Requirement coverage:');
    const reqMap = new Map();
    for (const t of spec.tasks) {
      for (const r of (t.fulfills || [])) {
        if (!reqMap.has(r)) reqMap.set(r, []);
        reqMap.get(r).push(t.id);
      }
    }
    for (const [r, tasks] of reqMap) {
      lines.push(`  ${r} ← ${tasks.join(', ')}`);
    }
  }

  return lines.join('\n');
}

function formatMermaid(spec, rounds, criticalPath) {
  const taskMap = new Map();
  for (const t of spec.tasks) taskMap.set(t.id, t);
  const cpSet = new Set(criticalPath);

  const lines = ['graph LR'];

  for (const t of spec.tasks) {
    const label = `${t.id}[${t.id}: ${t.action}]`;
    lines.push(`  ${label}`);
  }

  for (const t of spec.tasks) {
    for (const dep of (t.depends_on || [])) {
      if (taskMap.has(dep)) {
        lines.push(`  ${dep} --> ${t.id}`);
      }
    }
  }

  // Style critical path
  if (criticalPath.length > 0) {
    lines.push(`  style ${criticalPath.join(',')} stroke:#f66,stroke-width:3px`);
  }

  // Style verification tasks
  const verifyTasks = spec.tasks.filter(t => t.type === 'verification').map(t => t.id);
  if (verifyTasks.length > 0) {
    lines.push(`  style ${verifyTasks.join(',')} stroke:#6a6,stroke-dasharray: 5 5`);
  }

  return lines.join('\n');
}

function formatJson(spec, rounds, criticalPath) {
  const taskMap = new Map();
  for (const t of spec.tasks) taskMap.set(t.id, t);

  return JSON.stringify({
    name: spec.meta.name,
    goal: spec.meta.goal,
    total_tasks: spec.tasks.length,
    total_rounds: rounds.length,
    max_parallel: Math.max(...rounds.map(r => r.length)),
    critical_path: criticalPath,
    rounds: rounds.map((round, i) => ({
      round: i + 1,
      parallel: round.length > 1,
      tasks: round.map(id => {
        const t = taskMap.get(id);
        return {
          id: t.id,
          action: t.action,
          type: t.type,
          risk: t.risk || null,
          depends_on: t.depends_on || [],
        };
      }),
    })),
  }, null, 2);
}

async function handlePlan(args) {
  const parsed = parseArgs(args);
  const filePath = parsed._[0] || parsed.spec;

  if (!filePath) {
    process.stderr.write('Error: missing <path> argument\n');
    process.stderr.write('Usage: dev-cli spec plan <path> [--format text|mermaid|json]\n');
    process.exit(1);
  }

  const spec = loadSpec(filePath);

  if (!spec.tasks || spec.tasks.length === 0) {
    process.stderr.write('Error: spec has no tasks\n');
    process.exit(1);
  }

  const rounds = buildPlan(spec.tasks);
  const criticalPath = findCriticalPath(spec.tasks);
  const format = parsed.format || 'text';

  let output;
  if (format === 'mermaid') {
    output = formatMermaid(spec, rounds, criticalPath);
  } else if (format === 'json') {
    output = formatJson(spec, rounds, criticalPath);
  } else {
    output = formatText(spec, rounds, criticalPath);
  }

  process.stdout.write(output + '\n');
}

function parseArgs(args) {
  const result = { _: [] };
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        result[key] = next;
        i += 2;
      } else {
        result[key] = true;
        i += 1;
      }
    } else {
      result._.push(arg);
      i += 1;
    }
  }
  return result;
}

async function handleAmend(args) {
  const parsed = parseArgs(args);

  if (!parsed.reason) {
    process.stderr.write('Error: --reason <feedback-id> is required\n');
    process.stderr.write('Usage: dev-cli spec amend --reason <feedback-id> --spec <path>\n');
    process.exit(1);
  }

  if (!parsed.spec) {
    process.stderr.write('Error: --spec <path> is required\n');
    process.stderr.write('Usage: dev-cli spec amend --reason <feedback-id> --spec <path>\n');
    process.exit(1);
  }

  const specPath = resolve(parsed.spec);
  const feedbackId = parsed.reason;

  // Derive feedback file path relative to spec directory
  const specDir = dirname(specPath);
  const feedbackPath = resolve(specDir, 'feedback', `${feedbackId}.json`);

  let feedbackData;
  try {
    const raw = readFileSync(feedbackPath, 'utf8');
    feedbackData = JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') {
      process.stderr.write(`Error: feedback file not found: ${feedbackPath}\n`);
    } else if (err instanceof SyntaxError) {
      process.stderr.write(`Error: invalid JSON in feedback file: ${err.message}\n`);
    } else {
      process.stderr.write(`Error: could not read feedback file: ${err.message}\n`);
    }
    process.exit(1);
  }

  let specData;
  try {
    const raw = readFileSync(specPath, 'utf8');
    specData = JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') {
      process.stderr.write(`Error: spec file not found: ${specPath}\n`);
    } else if (err instanceof SyntaxError) {
      process.stderr.write(`Error: invalid JSON in spec file: ${err.message}\n`);
    } else {
      process.stderr.write(`Error: could not read spec file: ${err.message}\n`);
    }
    process.exit(1);
  }

  // Display the feedback message
  process.stdout.write(`Feedback (${feedbackId}): ${feedbackData.message}\n`);

  // Phase 1: update meta.updated_at as a placeholder for future amendment logic
  if (!specData.meta) {
    specData.meta = {};
  }
  specData.meta.updated_at = new Date().toISOString();

  try {
    writeFileSync(specPath, JSON.stringify(specData, null, 2), 'utf8');
  } catch (err) {
    process.stderr.write(`Error: could not write spec file: ${err.message}\n`);
    process.exit(1);
  }

  process.stdout.write(`Spec amended: ${specPath}\n`);
  process.stdout.write(`Note: actual spec modification logic will be added in later phases\n`);
  process.exit(0);
}

export default async function spec(args) {
  const subcommand = args[0];

  if (!subcommand || subcommand === '--help' || subcommand === '-h') {
    process.stdout.write(SPEC_HELP);
    process.exit(0);
  }

  if (subcommand === 'validate') {
    await handleValidate(args.slice(1));
  } else if (subcommand === 'plan') {
    await handlePlan(args.slice(1));
  } else if (subcommand === 'amend') {
    await handleAmend(args.slice(1));
  } else {
    process.stderr.write(`Error: unknown spec subcommand '${subcommand}'\n`);
    process.stderr.write(`Run 'dev-cli spec --help' for usage.\n`);
    process.exit(1);
  }
}
