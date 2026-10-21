import { parseArgs } from 'node:util';
import configCommand from './commands/config.js';
import { EXIT_OK, EXIT_USAGE, UsageError, exitCodeForError } from './exitCodes.js';
import { topLevelUsage } from './help.js';

/** The CLI's command registry: top-level command name → module. */
export const COMMANDS = {
  config: configCommand
};

/** Flags accepted everywhere, before or after the command. */
export const GLOBAL_OPTIONS = {
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean' },
  json: { type: 'boolean' }
};

/**
 * The CLI version, injected by the build through `define`; a source
 * (unbundled) run, as in the specs, has no define and reports `0.0.0-dev`.
 */
export const CLI_VERSION = typeof __ARCANUM_CLI_VERSION__ === 'undefined'
  ? '0.0.0-dev'
  : __ARCANUM_CLI_VERSION__;

/**
 * The per-scope list of arcanum versions that shipped migrations,
 * injected by the build through `define` (see
 * docs/agents/specs/arcanum-cli/packaging-and-release.md#embedded-migration-version-list).
 * A source run has no define and sees empty lists.
 */
export const MIGRATION_VERSIONS = typeof __ARCANUM_MIGRATION_VERSIONS__ === 'undefined'
  ? { repo: [], local: [], global: [] }
  : __ARCANUM_MIGRATION_VERSIONS__;

const DEFAULT_IO = { stdout: process.stdout, stderr: process.stderr };

/**
 * Runs the CLI for one argv and returns its exit code. Never throws:
 * every error goes through `exitCodeForError`.
 * @param {string[]} argv - the arguments after the program name.
 * @param {object} [options] - injectable dependencies.
 * @param {{stdout: {write: (text: string) => void}, stderr: {write: (text: string) => void}}} [options.io] - output streams.
 * @param {string} [options.version] - the version `--version` reports.
 * @returns {Promise<number>} the exit code.
 */
export async function run(argv, { io = DEFAULT_IO, version = CLI_VERSION } = {}) {
  try {
    return await dispatch(argv, io, version);
  } catch (error) {
    io.stderr.write(`arcanum: ${error && error.message ? error.message : String(error)}\n`);

    const code = exitCodeForError(error);

    if (code === EXIT_USAGE) {
      io.stderr.write('Run \'arcanum --help\' for usage.\n');
    }

    return code;
  }
}

/**
 * The bundle's entry point, called by `cli/bin/arcanum` once the Node
 * floor check has passed. Sets `process.exitCode` from `run`.
 * @param {string[]} argv - the arguments after the program name.
 * @returns {Promise<void>} resolves once the command has finished.
 */
export async function main(argv) {
  process.exitCode = await run(argv);
}

/**
 * @param {string[]} argv - the arguments after the program name.
 * @param {object} io - output streams.
 * @param {string} version - the CLI version.
 * @returns {Promise<number>} the exit code.
 * @throws {Error} on a usage error or a command failure.
 */
async function dispatch(argv, io, version) {
  const name = argv.find((arg) => !arg.startsWith('-'));
  const command = name === undefined ? undefined : COMMANDS[name];

  if (name !== undefined && !command) {
    throw new UsageError(`unknown command '${name}'`);
  }

  const { values, positionals } = parseArgs({
    args: argv,
    options: { ...GLOBAL_OPTIONS, ...(command ? command.options : {}) },
    allowPositionals: true,
    strict: true
  });

  if (values.version) {
    io.stdout.write(values.json ? `${JSON.stringify({ version })}\n` : `arcanum-cli ${version}\n`);

    return EXIT_OK;
  }

  if (!command) {
    if (values.help) {
      io.stdout.write(topLevelUsage());

      return EXIT_OK;
    }

    io.stderr.write(topLevelUsage());

    return EXIT_USAGE;
  }

  return command.run({ positionals: positionals.slice(1), values, io });
}
