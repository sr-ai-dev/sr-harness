import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SPEC_HELP = `
Usage:
  dev-cli spec validate <path>    Validate a spec.json file against the schema

Options:
  --help, -h    Show this help message

Examples:
  dev-cli spec validate ./spec.json
  dev-cli spec validate /path/to/spec.json
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

export default async function spec(args) {
  const subcommand = args[0];

  if (!subcommand || subcommand === '--help' || subcommand === '-h') {
    process.stdout.write(SPEC_HELP);
    process.exit(0);
  }

  if (subcommand === 'validate') {
    await handleValidate(args.slice(1));
  } else {
    process.stderr.write(`Error: unknown spec subcommand '${subcommand}'\n`);
    process.stderr.write(`Run 'dev-cli spec --help' for usage.\n`);
    process.exit(1);
  }
}
