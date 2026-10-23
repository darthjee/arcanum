import { notImplemented } from './shared.js';

/** `config list`'s own flags, beyond the global ones. */
export const options = {};

/** `config list`'s positionals, in order. */
export const positionals = [];

/** Whether `config list` accepts the tier flags. */
export const acceptsTier = true;

/**
 * `arcanum config list`: Lists every configured key, flattened, for every tier or one.
 * @param {object} context - the parsed invocation.
 * @returns {Promise<number>} the exit code.
 */
export async function run(context) {
  return notImplemented('list', context);
}

export default { name: 'list', options, positionals, acceptsTier, run };
