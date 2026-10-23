import { lockTimeoutMs, requireTier } from '../../args.js';
import { EXIT_OK } from '../../exitCodes.js';
import { lookupKey } from '../../tierFiles.js';
import { prepareWrite, validateUnset, wasText, writeKey } from '../../writeTier.js';
import { displayFile } from './shared.js';

/** `config unset`'s own flags, beyond the global ones. */
export const options = { force: { type: 'boolean' }, 'lock-timeout': { type: 'string' } };

/** `config unset`'s positionals, in order. */
export const positionals = ['key'];

/** Whether `config unset` accepts the tier flags. */
export const acceptsTier = true;

/**
 * `arcanum config unset <key> <tier>`: removes one key from one tier
 * through the shared writer and its lock, after the target, file,
 * registry and skew checks. A key that is not there is a no-op (exit
 * `0`, `"changed": false`); an emptied parent object is kept.
 * @param {object} context - the subcommand context.
 * @param {string[]} context.args - `[key]`.
 * @param {(string|undefined)} context.tier - the tier flag.
 * @param {object} context.values - the parsed flags.
 * @param {object} context.output - the output helpers.
 * @param {object} context.registry - the key registry.
 * @param {object} context.deps - injectable collaborators.
 * @returns {Promise<number>} the exit code.
 */
export async function run(context) {
  const { args: [key], values, output, registry, deps } = context;
  const tier = requireTier('unset', context.tier);
  const timeoutMs = lockTimeoutMs(values['lock-timeout']);
  const force = Boolean(values.force);
  const { targets, file, read, known, forced } = await prepareWrite(context, force, () => (
    validateUnset({ registry, key, tier, force })
  ));
  const previous = lookupKey(read.data, key);
  const changed = hasPath(read.data, key);

  if (changed) {
    await writeKey({ op: 'unset', file, key, known, timeoutMs, timeoutLabel: values['lock-timeout'] || '10', deps });
  }

  const where = `(${tier}: ${displayFile(tier, file, targets)}`;

  output.result(
    changed ? `unset ${key}   ${where}, was: ${wasText(previous)})` : `${key} was not set   ${where})`,
    { key, tier, file, changed, previous, value: null, forced }
  );

  return EXIT_OK;
}

/**
 * @param {object} data - a tier's parsed content.
 * @param {string} key - the dotted key.
 * @returns {boolean} whether the key is present (even holding `null`).
 */
export function hasPath(data, key) {
  let current = data;

  for (const segment of key.split('.')) {
    if (current === null || typeof current !== 'object' || Array.isArray(current) || !Object.hasOwn(current, segment)) {
      return false;
    }

    current = current[segment];
  }

  return true;
}

export default { name: 'unset', options, positionals, acceptsTier, run };
