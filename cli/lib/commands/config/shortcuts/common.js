// What every `arcanum config` shortcut shares (see
// docs/agents/architecture/arcanum-cli.md#design-rules): the strict flag
// set, the delegation to the generic get/set/unset (so the output, JSON
// and exit codes are the generic ones) and the shadowed-tier note.

import { selectedTier } from '../../../args.js';
import { UsageError } from '../../../exitCodes.js';
import { formatValue } from '../../../output.js';
import { TIERS, lookupKey, readTier, tierFile } from '../../../tierFiles.js';
import get from '../get.js';
import set from '../set.js';
import unset from '../unset.js';

/** The generic subcommands the shortcuts delegate to. */
export const GENERIC = { get, set, unset };

/** The flags no shortcut accepts: shortcuts only target known keys with known types. */
export const REFUSED_FLAGS = ['force', 'string'];

/**
 * Enforces a shortcut's flag set: never `--force` or `--string`;
 * `--all-tiers` only on a read; `--lock-timeout` only on a write; at most
 * one tier flag.
 * @param {string} name - the shortcut, as typed (e.g. `git safe-branch`).
 * @param {object} values - the parsed flags.
 * @param {object} mode - what the invocation does.
 * @param {boolean} mode.write - whether it writes.
 * @returns {(string|undefined)} the tier flag given, if any.
 * @throws {UsageError} on a flag the shortcut does not accept.
 */
export function checkShortcutFlags(name, values, { write }) {
  for (const flag of REFUSED_FLAGS) {
    if (values[flag]) {
      throw new UsageError(`--${flag} is not accepted by shortcuts (${name})`, {
        hint: `use arcanum config set/unset <key> --${flag} instead`
      });
    }
  }

  if (write && values['all-tiers']) {
    throw new UsageError(`--all-tiers is only accepted when reading, not by a ${name} write`);
  }

  if (!write && values['lock-timeout'] !== undefined) {
    throw new UsageError(`--lock-timeout is only accepted when writing, not by a ${name} read`);
  }

  return selectedTier(values);
}

/**
 * Refuses positionals beyond the ones a shortcut takes.
 * @param {string} name - the shortcut, as typed.
 * @param {string[]} args - its positionals.
 * @param {number} max - how many it takes at most.
 * @throws {UsageError} on an extra positional.
 */
export function checkMaxArity(name, args, max) {
  if (args.length > max) {
    throw new UsageError(`${name}: unexpected argument '${args[max]}'`);
  }
}

/**
 * @param {() => Promise<object>} resolve - resolves the targets.
 * @returns {() => Promise<object>} the same, resolved at most once, so
 *   a delegated command and the shortcut share one `git rev-parse` (and
 *   its warnings).
 */
export function memoizeTargets(resolve) {
  let pending;

  return () => {
    pending = pending || resolve();

    return pending;
  };
}

/**
 * Runs a generic subcommand on the shortcut's behalf.
 * @param {object} context - the shortcut's context.
 * @param {string} subcommand - `get`, `set` or `unset`.
 * @param {string[]} args - the subcommand's positionals.
 * @param {(string|undefined)} tier - the tier.
 * @param {object} [extra] - further context fields (e.g. `parseValue`).
 * @returns {Promise<number>} the exit code.
 */
export function delegate(context, subcommand, args, tier, extra = {}) {
  return GENERIC[subcommand].run({ ...context, ...extra, args, tier });
}

/**
 * Writes a key through the generic `set` and, when a higher-precedence
 * tier still holds a value for it, prints a stderr note naming that tier.
 * @param {object} context - the shortcut's context.
 * @param {object} write - the write.
 * @param {string} write.key - the key.
 * @param {string} write.raw - the value as typed.
 * @param {string} write.tier - the target tier.
 * @param {(raw: string) => object} [write.parseValue] - the value parser.
 * @returns {Promise<number>} the exit code.
 */
export async function writeValue(context, { key, raw, tier, parseValue }) {
  const resolveTargets = memoizeTargets(context.resolveTargets);
  const shared = { ...context, resolveTargets };
  const code = await delegate(shared, 'set', [key, raw], tier, parseValue ? { parseValue } : {});

  await noteShadowing(shared, key, tier);

  return code;
}

/**
 * Finds the first higher-precedence tier than `tier` holding a value for
 * `key`. Unreadable or malformed files are skipped silently.
 * @param {object} context - the command's context (`resolveTargets`).
 * @param {string} key - the key.
 * @param {string} tier - the tier written (or about to be).
 * @returns {Promise<({tier: string, value: unknown}|null)>} the
 *   overriding tier and its value, or `null`.
 */
export async function findShadowing(context, key, tier) {
  const targets = await context.resolveTargets();

  for (const higher of TIERS.slice(0, TIERS.indexOf(tier))) {
    const file = tierFile(higher, targets);

    if (file === null) {
      continue;
    }

    const read = await readTier(file);
    const found = read.state === 'ok' ? lookupKey(read.data, key) : { set: false };

    if (found.set) {
      return { tier: higher, value: found.value };
    }
  }

  return null;
}

/**
 * Prints `arcanum: note: <tier> still overrides <key> (value: …)` for the
 * first higher-precedence tier holding a value (see `findShadowing`).
 * @param {object} context - the shortcut's context.
 * @param {string} key - the key written.
 * @param {string} tier - the tier written.
 * @returns {Promise<void>} resolves once checked.
 */
export async function noteShadowing(context, key, tier) {
  const shadowing = await findShadowing(context, key, tier);

  if (shadowing !== null) {
    context.output.note(`${shadowing.tier} still overrides ${key} (value: ${formatValue(shadowing.value)})`);
  }
}
