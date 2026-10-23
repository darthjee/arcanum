import { notImplemented } from './shared.js';

/** `config get`'s own flags, beyond the global ones. */
export const options = { 'all-tiers': { type: 'boolean' } };

/** `config get`'s positionals, in order. */
export const positionals = ['key'];

/** Whether `config get` accepts the tier flags. */
export const acceptsTier = true;

/**
 * `arcanum config get`: Prints a key's value: resolved, from one tier, or per tier.
 * @param {object} context - the parsed invocation.
 * @returns {Promise<number>} the exit code.
 */
export async function run(context) {
  return notImplemented('get', context);
}

export default { name: 'get', options, positionals, acceptsTier, run };
