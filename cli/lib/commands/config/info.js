import { notImplemented } from './shared.js';

/** `config info`'s own flags, beyond the global ones. */
export const options = {};

/** `config info`'s positionals, in order. */
export const positionals = [];

/** Whether `config info` accepts the tier flags. */
export const acceptsTier = false;

/**
 * `arcanum config info`: Describes the environment: account, repo, tier files and versions.
 * @param {object} context - the parsed invocation.
 * @returns {Promise<number>} the exit code.
 */
export async function run(context) {
  return notImplemented('info', context);
}

export default { name: 'info', options, positionals, acceptsTier, run };
