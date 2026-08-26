/**
 * Small `JSON.parse` wrapper that never throws — returns a result
 * object instead, so callers can branch on success/failure without a
 * try/catch of their own.
 */
class JsonParser {
  /**
   * @param {string} jsonValue - the raw JSON text to parse.
   * @returns {{ok: boolean, value: *}} `{ ok: true, value }` on success,
   *   `{ ok: false }` on invalid JSON.
   */
  parse(jsonValue) {
    try {
      return { ok: true, value: JSON.parse(jsonValue) };
    } catch {
      return { ok: false };
    }
  }
}

export default JsonParser;
