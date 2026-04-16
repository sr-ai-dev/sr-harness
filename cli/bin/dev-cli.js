import specHandler from '../src/handlers/spec.js';
import stateHandler from '../src/handlers/state.js';
import sessionHandler from '../src/handlers/session.js';
import feedbackHandler from '../src/handlers/feedback.js';
import settingsHandler from '../src/handlers/settings-validate.js';

const USAGE = `
sr-harness-cli — Developer workflow CLI

Usage:
  sr-harness-cli <subcommand> [options]

Subcommands:
  spec      Manage spec/plan state
  state     Read or update workflow state
  session   Manage session state (~/.sr-harness/{sid}/)
  feedback  Manage feedback files

Options:
  --help, -h    Show this help message
  --version     Show version

Examples:
  sr-harness-cli spec --help
  sr-harness-cli state --help
  sr-harness-cli feedback --help
`;

const SUBCOMMANDS = {
  spec: specHandler,
  state: stateHandler,
  session: sessionHandler,
  feedback: feedbackHandler,
  settings: settingsHandler,
};

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    process.stdout.write(USAGE);
    process.exit(0);
  }

  if (args[0] === '--version') {
    // VERSION is injected by esbuild --define at build time
    // Falls back to 'dev' when running directly from source
    const version = typeof __CLI_VERSION__ !== 'undefined' ? __CLI_VERSION__ : 'dev';
    process.stdout.write(`sr-harness-cli v${version}\n`);
    process.exit(0);
  }

  const subcommand = args[0];

  if (!Object.prototype.hasOwnProperty.call(SUBCOMMANDS, subcommand)) {
    process.stderr.write(`Error: unknown subcommand '${subcommand}'\n`);
    process.stderr.write(`Run 'sr-harness-cli --help' for usage.\n`);
    process.exit(1);
  }

  const handler = SUBCOMMANDS[subcommand];
  await handler(args.slice(1));
}

main().catch((err) => {
  process.stderr.write(`Unexpected error: ${err.message}\n`);
  process.exit(1);
});
