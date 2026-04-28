import reqHandler from '../src/commands/req.js';
import planHandler from '../src/commands/plan.js';
import learningHandler from '../src/commands/learning.js';
import issueHandler from '../src/commands/issue.js';
import sessionHandler from '../src/commands/session.js';

const USAGE = `
sr-harness-cli — CLI for specify + blueprint + execute workflow

Usage:
  sr-harness-cli <group> <command> [options]

Groups:
  req       requirements.md scaffolding (init only — cli does not parse .md)
  plan      plan.json operations (init, merge, get, list, task, validate)
  learning  Add structured learning entries to context/learnings.json
  issue     Add structured issue entries to context/issues.json
  session   Session state management (set/get key-value in ~/.sr-harness/<sid>/state.json)

Options:
  --help, -h    Show this help message
  --version     Show version

Examples:
  sr-harness-cli req init .sr-harness/specs/my-spec --type greenfield
  sr-harness-cli plan init .sr-harness/specs/my-spec --type greenfield
  sr-harness-cli plan merge .sr-harness/specs/my-spec --json '{"tasks":[...]}'
  sr-harness-cli plan task .sr-harness/specs/my-spec --status T1=running
  sr-harness-cli learning --task T1 --json '{"problem":"..."}' .sr-harness/specs/my-spec
  sr-harness-cli issue --task T1 --json '{"type":"blocker","description":"..."}' .sr-harness/specs/my-spec
  sr-harness-cli session set --sid abc123 --key spec_dir --value .sr-harness/specs/foo
`;

const GROUPS = {
  req: reqHandler,
  plan: planHandler,
  learning: learningHandler,
  issue: issueHandler,
  session: sessionHandler,
};

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    process.stdout.write(USAGE);
    process.exit(0);
  }

  if (args[0] === '--version') {
    const version = typeof __CLI_VERSION__ !== 'undefined' ? __CLI_VERSION__ : 'dev';
    process.stdout.write(`sr-harness-cli v${version}\n`);
    process.exit(0);
  }

  const group = args[0];

  if (!Object.prototype.hasOwnProperty.call(GROUPS, group)) {
    process.stderr.write(`Error: unknown group '${group}'\n`);
    process.stderr.write(`Run 'sr-harness-cli --help' for usage.\n`);
    process.exit(1);
  }

  await GROUPS[group](args.slice(1));
}

main().catch((err) => {
  process.stderr.write(`Unexpected error: ${err.message}\n`);
  process.exit(1);
});
