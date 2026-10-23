// `config set`'s value parsing (see the Value parsing table in
// docs/agents/specs/arcanum-cli/command-surface.md#value-parsing).

const NUMBER_PATTERN = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/;
const INTEGER_PATTERN = /^-?\d+$/;
const LITERALS = { true: true, false: false, null: null };

/**
 * Parses a `set` value as typed. `true`, `false`, `null`, numbers and
 * anything that looks like JSON (starts with `[`, `{` or `"`) are tried
 * as JSON; everything else, and everything with `--string`, is a
 * string. Values are never trimmed. A value that looks like JSON but is
 * not falls back to the string, and reports the parse error so a caller
 * validating an array key can refuse it.
 * @param {string} raw - the value as typed.
 * @param {object} [options] - parsing options.
 * @param {boolean} [options.string] - `--string`: always a string.
 * @returns {{value: unknown, jsonError: (string|null), precisionLoss: boolean}}
 *   the parsed value; `jsonError` is the JSON parse error of a value
 *   that looks like JSON but is not; `precisionLoss` is true for a
 *   number that JSON cannot represent exactly (an integer beyond
 *   `Number.MAX_SAFE_INTEGER`, or an overflow to infinity).
 */
export function parseValue(raw, { string = false } = {}) {
  const result = { value: raw, jsonError: null, precisionLoss: false };

  if (string) {
    return result;
  }

  if (Object.hasOwn(LITERALS, raw)) {
    return { ...result, value: LITERALS[raw] };
  }

  if (NUMBER_PATTERN.test(raw)) {
    const value = Number(raw);
    const precisionLoss = !Number.isFinite(value) ||
      (INTEGER_PATTERN.test(raw) && !Number.isSafeInteger(value));

    return { ...result, value, precisionLoss };
  }

  if (looksLikeJson(raw)) {
    try {
      return { ...result, value: JSON.parse(raw) };
    } catch (error) {
      return { ...result, jsonError: error.message };
    }
  }

  return result;
}

/**
 * @param {string} raw - the value as typed.
 * @returns {boolean} whether it starts with `[`, `{` or `"` (no trimming).
 */
export function looksLikeJson(raw) {
  return raw.startsWith('[') || raw.startsWith('{') || raw.startsWith('"');
}
