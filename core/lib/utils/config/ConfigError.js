/**
 * The shared config surface's error contract: every failure the config
 * read/write code raises on purpose carries a stable `code`, so callers
 * (the `arcanum-cli` exit-code mapping) can branch on it. It extends
 * `Error` and keeps the original messages, so the dispatcher's
 * bare-`Error` path (`arcanum: <message>`, exit 1) is unchanged.
 *
 * Codes: `NOT_AN_OBJECT`, `INVALID_JSON`, `UNREGISTERED_KEY`.
 * Native fs errors are never wrapped (they already carry `error.code`).
 */
class ConfigError extends Error {
  /**
   * @param {string} code - the stable error code.
   * @param {string} message - the human-readable message.
   * @param {object} [options] - extra details.
   * @param {string} [options.file] - the config file involved, if any.
   * @param {unknown} [options.cause] - the underlying error, if any.
   */
  constructor(code, message, { file, cause } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'ConfigError';
    this.code = code;
    this.file = file;
  }
}

export default ConfigError;
