import KeyRegistry from '../../../core/lib/utils/config/KeyRegistry.js';
import { EXIT_ERROR, EXIT_OK, EXIT_USAGE, UsageError } from '../exitCodes.js';
import { configUsage } from '../help.js';

const SUBCOMMANDS = ['get', 'set', 'unset', 'list', 'info'];

/** The command's own `parseArgs` options (none yet, see #780). */
export const options = {};

/**
 * The `arcanum config` namespace. Only its help is implemented; the
 * `get/set/unset/list/info` subcommands arrive with #780.
 * @param {object} context - the parsed invocation.
 * @param {string[]} context.positionals - the arguments after `config`.
 * @param {object} context.values - the parsed flags.
 * @param {{stdout: {write: (text: string) => void}, stderr: {write: (text: string) => void}}} context.io - output streams.
 * @param {KeyRegistry} [context.registry] - the key registry, injectable for testing.
 * @returns {number} the exit code.
 * @throws {UsageError} on an unknown subcommand.
 */
export function run({ positionals, values, io, registry = new KeyRegistry() }) {
  const [subcommand] = positionals;
  const usage = configUsage(registry.entries());

  if (values.help) {
    io.stdout.write(usage);

    return EXIT_OK;
  }

  if (subcommand === undefined) {
    io.stderr.write(usage);

    return EXIT_USAGE;
  }

  if (!SUBCOMMANDS.includes(subcommand)) {
    throw new UsageError(`unknown config subcommand '${subcommand}'`);
  }

  io.stderr.write(`arcanum: config ${subcommand} is not implemented yet\n`);

  return EXIT_ERROR;
}

export default { options, run };
