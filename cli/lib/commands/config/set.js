import { lockTimeoutMs, requireTier } from '../../args.js';
import { notImplemented } from './shared.js';

/** `config set`'s own flags, beyond the global ones. */
export const options = { string: { type: 'boolean' }, force: { type: 'boolean' }, 'lock-timeout': { type: 'string' } };

/** `config set`'s positionals, in order. */
export const positionals = ['key', 'value'];

/** Whether `config set` accepts the tier flags. */
export const acceptsTier = true;

/**
 * `arcanum config set`: Writes a key to one tier.
 * @param {object} context - the parsed invocation.
 * @returns {Promise<number>} the exit code.
 */
export async function run(context) {
  requireTier('set', context.tier);
  lockTimeoutMs(context.values['lock-timeout']);

  return notImplemented('set', context);
}

export default { name: 'set', options, positionals, acceptsTier, run };
