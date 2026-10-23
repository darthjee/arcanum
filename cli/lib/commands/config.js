import KeyRegistry from '../../../shared/lib/config/KeyRegistry.js';
import { TIER_FLAGS, checkArity, checkFlags, checkKey, selectedTier } from '../args.js';
import { EXIT_OK, EXIT_USAGE, UsageError } from '../exitCodes.js';
import { configUsage, shortcutUsage, subcommandUsage } from '../help.js';
import get from './config/get.js';
import info from './config/info.js';
import list from './config/list.js';
import set from './config/set.js';
import setup from './config/setup.js';
import unset from './config/unset.js';
import { isShortcut, runShortcut } from './config/shortcuts/index.js';

/** The `arcanum config` subcommands: name → module. */
export const SUBCOMMANDS = { get, set, unset, list, info, setup };

const TIER_OPTIONS = Object.fromEntries(TIER_FLAGS.map((tier) => [tier, { type: 'boolean' }]));

/**
 * Every subcommand-specific option, each with the `only` list of the
 * subcommands that accept it (used for the "only accepted by" error).
 */
export const SUBCOMMAND_OPTIONS = Object.values(SUBCOMMANDS).reduce((all, subcommand) => {
  for (const [name, option] of Object.entries(subcommand.options)) {
    all[name] = { ...option, only: [...(all[name] ? all[name].only : []), subcommand.name] };
  }

  return all;
}, {});

/**
 * The options only the shortcuts accept (not the generic subcommands),
 * with the same `only` shape as `SUBCOMMAND_OPTIONS`.
 */
export const SHORTCUT_OPTIONS = { unset: { type: 'boolean', only: ['the shortcuts'] } };

/**
 * The namespace's `parseArgs` options: the tier flags plus the union of
 * every subcommand's and shortcut's own flags. Which subcommand accepts
 * which flag is enforced after parsing, so the error can name the flag.
 */
export const options = {
  ...TIER_OPTIONS,
  ...Object.fromEntries(Object.entries({ ...SUBCOMMAND_OPTIONS, ...SHORTCUT_OPTIONS })
    .map(([name, { type }]) => [name, { type }]))
};

/**
 * The `arcanum config` namespace: prints its help, runs a shortcut
 * (see `./config/shortcuts/`), or runs the subcommand after the checks
 * every subcommand shares (flags it accepts, tier-flag exclusivity,
 * arity and key syntax).
 * @param {object} context - the parsed invocation.
 * @param {string[]} context.positionals - the arguments after `config`.
 * @param {object} context.values - the parsed flags.
 * @param {{stdout: {write: (text: string) => void}, stderr: {write: (text: string) => void}}} context.io - output streams.
 * @param {KeyRegistry} [context.registry] - the key registry, injectable for testing.
 * @returns {Promise<number>} the exit code.
 * @throws {UsageError} on an unknown subcommand or a usage error.
 */
export async function run(context) {
  const { positionals, values, io, registry = new KeyRegistry() } = context;
  const [name, ...args] = positionals;
  const usage = configUsage(registry.entries());

  if (values.help) {
    if (isShortcut(name)) {
      io.stdout.write(shortcutUsage(name, args[0]));
    } else {
      io.stdout.write(Object.hasOwn(SUBCOMMANDS, name || '') ? subcommandUsage(name) : usage);
    }

    return EXIT_OK;
  }

  if (name === undefined) {
    io.stderr.write(usage);

    return EXIT_USAGE;
  }

  if (isShortcut(name)) {
    return runShortcut({ ...context, registry });
  }

  if (!Object.hasOwn(SUBCOMMANDS, name)) {
    throw new UsageError(`unknown config subcommand '${name}'`);
  }

  const subcommand = SUBCOMMANDS[name];

  checkFlags(name, values, subcommand.options, { ...SUBCOMMAND_OPTIONS, ...SHORTCUT_OPTIONS });

  const tier = selectedTier(values);

  if (!subcommand.acceptsTier && tier !== undefined) {
    throw new UsageError(`--${tier} is not accepted by ${name}`);
  }

  checkArity(name, args, subcommand.positionals);

  if (subcommand.positionals[0] === 'key') {
    checkKey(args[0]);
  }

  return subcommand.run({ ...context, registry, args, tier });
}

export default { options, run };
