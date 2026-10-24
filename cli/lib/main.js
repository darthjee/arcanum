import { parseArgs } from 'node:util';
import { extractRepoTarget, firstPositional, valueOptionNames } from './args.js';
import configCommand from './commands/config.js';
import { EXIT_OK, EXIT_USAGE, UsageError } from './exitCodes.js';
import { topLevelUsage } from './help.js';
import { createOutput, reportError, wantsJson } from './output.js';
import { resolveTargets } from './target.js';

/** The CLI's command registry: top-level command name → module. */
export const COMMANDS = {
  config: configCommand
};

/** Flags accepted everywhere, before or after the command. */
export const GLOBAL_OPTIONS = {
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean' },
  json: { type: 'boolean' },
  'claude-config-dir': { type: 'string' }
};

/**
 * The long names of every option, global or command-level, that takes
 * a value; their values are never mistaken for the command name.
 */
const VALUE_OPTIONS = [GLOBAL_OPTIONS, ...Object.values(COMMANDS).map((command) => command.options)]
  .flatMap(valueOptionNames);

/**
 * The CLI version, injected by the build through `define`; a source
 * (unbundled) run, as in the specs, has no define and reports `0.0.0-dev`.
 */
export const CLI_VERSION = typeof __ARCANUM_CLI_VERSION__ === 'undefined'
  ? '0.0.0-dev'
  : __ARCANUM_CLI_VERSION__;

/**
 * The Node.js floor (`engines.node`), injected by the build through
 * `define`; a source run falls back to the literal below, which a spec
 * keeps equal to `cli/package.json`'s `engines.node`.
 */
export const NODE_FLOOR = typeof __ARCANUM_NODE_FLOOR__ === 'undefined'
  ? '>=22.13.0'
  : __ARCANUM_NODE_FLOOR__;

/**
 * The per-scope list of arcanum versions that shipped migrations,
 * injected by the build through `define` (see
 * docs/agents/architecture/install-and-release.md#build-output).
 * A source run has no define and sees empty lists.
 */
export const MIGRATION_VERSIONS = typeof __ARCANUM_MIGRATION_VERSIONS__ === 'undefined'
  ? { repo: [], local: [], global: [] }
  : __ARCANUM_MIGRATION_VERSIONS__;

const DEFAULT_IO = { stdout: process.stdout, stderr: process.stderr, stdin: process.stdin };

/**
 * Runs the CLI for one argv and returns its exit code. Never throws:
 * every error goes through `reportError` (and so `exitCodeForError`).
 * @param {string[]} argv - the arguments after the program name.
 * @param {object} [options] - injectable dependencies.
 * @param {{stdout: {write: (text: string) => void}, stderr: {write: (text: string) => void}, stdin: (object|undefined)}} [options.io] -
 *   the streams: output, and the input `config setup` prompts on.
 * @param {string} [options.version] - the version `--version` reports.
 * @param {object} [options.env] - the environment (`CLAUDE_CONFIG_DIR`, `HOME`).
 * @param {string} [options.cwd] - the working directory.
 * @param {object} [options.migrationVersions] - the per-scope migration
 *   versions the version-skew checks use.
 * @param {object} [options.deps] - further injectable collaborators,
 *   forwarded to the command (e.g. `execFileAsync`, `lock`,
 *   `nodeVersion`).
 * @returns {Promise<number>} the exit code.
 */
export async function run(argv, {
  io = DEFAULT_IO,
  version = CLI_VERSION,
  env = process.env,
  cwd = process.cwd(),
  migrationVersions = MIGRATION_VERSIONS,
  deps = {}
} = {}) {
  try {
    return await dispatch(argv, { io, version, env, cwd, migrationVersions, deps });
  } catch (error) {
    return reportError(io, error, { json: wantsJson(argv), env });
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
 * @param {object} invocation - the invocation's streams, version,
 *   environment and collaborators (see `run`).
 * @returns {Promise<number>} the exit code.
 * @throws {Error} on a usage error or a command failure.
 */
async function dispatch(argv, invocation) {
  const { io, version, env, cwd, migrationVersions, deps } = invocation;
  const { args, repoPath } = extractRepoTarget(argv);
  const name = firstPositional(args, VALUE_OPTIONS);
  const command = name === undefined || !Object.hasOwn(COMMANDS, name) ? undefined : COMMANDS[name];

  if (name !== undefined && !command) {
    throw new UsageError(`unknown command '${name}'`);
  }

  const { values, positionals } = parseArgs({
    args,
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

  const output = createOutput(io, { json: Boolean(values.json) });
  const { warn } = output;
  const targeting = { repo: repoPath, claudeConfigDir: values['claude-config-dir'] };

  return command.run({
    positionals: positionals.slice(1),
    values,
    io,
    env,
    cwd,
    version,
    nodeVersion: deps.nodeVersion || process.versions.node,
    nodeFloor: NODE_FLOOR,
    migrationVersions,
    deps,
    output,
    warn,
    targeting,
    resolveTargets: () => resolveTargets({ ...targeting, env, cwd, warn, execFileAsync: deps.execFileAsync })
  });
}
