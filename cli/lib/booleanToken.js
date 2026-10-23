// The boolean tokens the shortcuts accept (see the Design rules of
// docs/agents/specs/arcanum-cli/shortcuts-and-setup.md): `on`/`true` and
// `off`/`false`, lowercase only, always stored as JSON booleans.

import { ValidationError } from './exitCodes.js';

/** Token → the JSON boolean it stores. */
export const BOOLEAN_TOKENS = { on: true, off: false, true: true, false: false };

/** The accepted tokens, in the order the hint lists them. */
export const BOOLEAN_TOKEN_NAMES = Object.keys(BOOLEAN_TOKENS);

/**
 * @param {string} key - the key the token is for (named in the error).
 * @param {string} token - the token as typed.
 * @returns {boolean} the JSON boolean the token stands for.
 * @throws {ValidationError} (exit `3`) on any other token, uppercase
 *   variants included, with a hint listing the accepted tokens.
 */
export function parseBooleanToken(key, token) {
  if (Object.hasOwn(BOOLEAN_TOKENS, token)) {
    return BOOLEAN_TOKENS[token];
  }

  throw new ValidationError(`${key} must be on or off, got ${JSON.stringify(token)}`, {
    hint: `accepted: ${BOOLEAN_TOKEN_NAMES.join(', ')} (lowercase)`
  });
}
