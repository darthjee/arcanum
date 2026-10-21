// The CLI's exit codes, see the Exit codes table in
// docs/agents/specs/arcanum-cli/command-surface.md.

/** Success. */
export const EXIT_OK = 0;
/** Generic error, including a Node.js below the floor. */
export const EXIT_ERROR = 1;
/** Usage error: unknown flag or command, bad arity, conflicting flags. */
export const EXIT_USAGE = 2;
/** Validation error against the key registry. */
export const EXIT_VALIDATION = 3;
/** No repo, an unconfigured repo, or no Claude config directory. */
export const EXIT_TARGET_UNAVAILABLE = 4;
/** A write to a tier whose pointer is ahead of the CLI, without `--force`. */
export const EXIT_VERSION_SKEW = 5;
/** The write lock could not be acquired in time. */
export const EXIT_LOCK_TIMEOUT = 6;
/** Malformed tier file, or an I/O error. */
export const EXIT_FILE = 7;

const FILE_ERROR_CODES = ['NOT_AN_OBJECT', 'INVALID_JSON'];

/**
 * A command-line usage error (exit `2`): unknown command or
 * subcommand, missing arguments, conflicting flags.
 */
export class UsageError extends Error {
  /**
   * @param {string} message - what was wrong with the invocation.
   */
  constructor(message) {
    super(message);
    this.name = 'UsageError';
    this.code = 'USAGE';
  }
}

/**
 * Maps any error thrown while running a command to the CLI's exit code.
 * This is the single mapping point (see
 * docs/agents/specs/arcanum-cli/shared-config-logic.md#configerror):
 * usage errors (the CLI's own and `node:util` `parseArgs`'s) → `2`;
 * `LOCK_TIMEOUT` → `6`; `NOT_AN_OBJECT`, `INVALID_JSON` and any Node
 * errno error → `7`; anything else, `UNREGISTERED_KEY` included → `1`.
 * @param {unknown} error - the thrown value.
 * @returns {number} the exit code.
 */
export function exitCodeForError(error) {
  const code = error && typeof error === 'object' ? error.code : undefined;

  if (error instanceof UsageError || (typeof code === 'string' && code.startsWith('ERR_PARSE_ARGS_'))) {
    return EXIT_USAGE;
  }

  if (code === 'LOCK_TIMEOUT') {
    return EXIT_LOCK_TIMEOUT;
  }

  if (FILE_ERROR_CODES.includes(code) || isErrnoError(error)) {
    return EXIT_FILE;
  }

  return EXIT_ERROR;
}

/**
 * @param {unknown} error - the thrown value.
 * @returns {boolean} whether it is a Node.js system (errno) error such
 *   as `EACCES`, `ENOSPC` or `EISDIR`.
 */
function isErrnoError(error) {
  return Boolean(error) && typeof error === 'object' &&
    typeof error.errno === 'number' && typeof error.syscall === 'string';
}
