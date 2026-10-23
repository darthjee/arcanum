// Helpers shared by the `arcanum config` subcommand modules.

import { EXIT_ERROR } from '../../exitCodes.js';

/**
 * Placeholder for a subcommand whose behaviour is not implemented yet.
 * @param {string} name - the subcommand name.
 * @param {object} context - the parsed invocation.
 * @param {{stderr: {write: (text: string) => void}}} context.io - output streams.
 * @returns {number} `EXIT_ERROR`.
 */
export function notImplemented(name, { io }) {
  io.stderr.write(`arcanum: config ${name} is not implemented yet\n`);

  return EXIT_ERROR;
}
