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

/** Exit code → its stable snake-case identifier, for the JSON error object. */
export const EXIT_IDENTIFIERS = {
  [EXIT_ERROR]: 'error',
  [EXIT_USAGE]: 'usage',
  [EXIT_VALIDATION]: 'validation',
  [EXIT_TARGET_UNAVAILABLE]: 'target_unavailable',
  [EXIT_VERSION_SKEW]: 'version_skew',
  [EXIT_LOCK_TIMEOUT]: 'lock_timeout',
  [EXIT_FILE]: 'file'
};

/**
 * Base class of the CLI's own refusals: an error carrying its exit code
 * and an optional `hint` line.
 */
export class CliError extends Error {
  /**
   * @param {string} message - what failed (lowercase, no trailing period).
   * @param {object} [options] - extra details.
   * @param {number} [options.exit] - the exit code (default `EXIT_ERROR`).
   * @param {string} [options.code] - the stable error code.
   * @param {(string|null)} [options.hint] - an optional `hint: ` line.
   */
  constructor(message, { exit = EXIT_ERROR, code = 'ERROR', hint = null } = {}) {
    super(message);
    this.name = 'CliError';
    this.exit = exit;
    this.code = code;
    this.hint = hint;
  }
}

/**
 * A command-line usage error (exit `2`): unknown command or
 * subcommand, missing arguments, conflicting flags.
 */
export class UsageError extends CliError {
  /**
   * @param {string} message - what was wrong with the invocation.
   * @param {object} [options] - extra details.
   * @param {(string|null)} [options.hint] - an optional hint.
   */
  constructor(message, { hint = null } = {}) {
    super(message, { exit: EXIT_USAGE, code: 'USAGE', hint });
    this.name = 'UsageError';
  }
}

/** A key registry refusal (exit `3`): unknown key, type, enum, tier, read-only. */
export class ValidationError extends CliError {
  /**
   * @param {string} message - what failed validation.
   * @param {object} [options] - extra details.
   * @param {(string|null)} [options.hint] - an optional hint.
   */
  constructor(message, { hint = null } = {}) {
    super(message, { exit: EXIT_VALIDATION, code: 'VALIDATION', hint });
    this.name = 'ValidationError';
  }
}

/** Nowhere to read or write the tier (exit `4`). */
export class TargetUnavailableError extends CliError {
  /**
   * @param {string} message - what target is unavailable.
   * @param {object} [options] - extra details.
   * @param {(string|null)} [options.hint] - an optional hint.
   */
  constructor(message, { hint = null } = {}) {
    super(message, { exit: EXIT_TARGET_UNAVAILABLE, code: 'TARGET_UNAVAILABLE', hint });
    this.name = 'TargetUnavailableError';
  }
}

/** A write to a tier ahead of the CLI, without `--force` (exit `5`). */
export class VersionSkewError extends CliError {
  /**
   * @param {string} message - which tier is ahead.
   * @param {object} [options] - extra details.
   * @param {(string|null)} [options.hint] - an optional hint.
   */
  constructor(message, { hint = null } = {}) {
    super(message, { exit: EXIT_VERSION_SKEW, code: 'VERSION_SKEW', hint });
    this.name = 'VersionSkewError';
  }
}

/** The write lock was not acquired within `--lock-timeout` (exit `6`). */
export class LockTimeoutRefusal extends CliError {
  /**
   * @param {string} message - which lock timed out.
   * @param {object} [options] - extra details.
   * @param {(string|null)} [options.hint] - an optional hint.
   */
  constructor(message, { hint = null } = {}) {
    super(message, { exit: EXIT_LOCK_TIMEOUT, code: 'LOCK_TIMEOUT', hint });
    this.name = 'LockTimeoutRefusal';
  }
}

/** A malformed tier file the CLI refuses to overwrite, or an I/O error (exit `7`). */
export class FileError extends CliError {
  /**
   * @param {string} message - which file and why.
   * @param {object} [options] - extra details.
   * @param {(string|null)} [options.hint] - an optional hint.
   */
  constructor(message, { hint = null } = {}) {
    super(message, { exit: EXIT_FILE, code: 'FILE', hint });
    this.name = 'FileError';
  }
}

/**
 * Maps any error thrown while running a command to the CLI's exit code.
 * This is the single mapping point (see
 * docs/agents/specs/arcanum-cli/shared-config-logic.md#configerror):
 * the CLI's own refusals carry their code (usage `2`, validation `3`,
 * target `4`, skew `5`, lock `6`, file `7`); `node:util` `parseArgs`
 * errors → `2`; `LOCK_TIMEOUT` → `6`; `NOT_AN_OBJECT`, `INVALID_JSON`
 * and any Node errno error → `7`; anything else, `UNREGISTERED_KEY`
 * included → `1`.
 * @param {unknown} error - the thrown value.
 * @returns {number} the exit code.
 */
export function exitCodeForError(error) {
  if (error instanceof CliError) {
    return error.exit;
  }

  const code = error && typeof error === 'object' ? error.code : undefined;

  if (typeof code === 'string' && code.startsWith('ERR_PARSE_ARGS_')) {
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
