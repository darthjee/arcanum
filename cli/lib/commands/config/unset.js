import { lockTimeoutMs, requireTier } from '../../args.js';
import { notImplemented } from './shared.js';

/** `config unset`'s own flags, beyond the global ones. */
export const options = { force: { type: 'boolean' }, 'lock-timeout': { type: 'string' } };

/** `config unset`'s positionals, in order. */
export const positionals = ['key'];

/** Whether `config unset` accepts the tier flags. */
export const acceptsTier = true;

/**
 * `arcanum config unset`: Removes a key from one tier.
 * @param {object} context - the parsed invocation.
 * @returns {Promise<number>} the exit code.
 */
export async function run(context) {
  requireTier('unset', context.tier);
  lockTimeoutMs(context.values['lock-timeout']);

  return notImplemented('unset', context);
}

export default { name: 'unset', options, positionals, acceptsTier, run };
