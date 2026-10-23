// The write path shared by `config set` and `config unset` (see
// docs/agents/specs/arcanum-cli/command-surface.md). Refusals run in the
// spec's precedence order — usage (already checked), then target (`4`),
// file (`7`), registry (`3`), skew (`5`) and lock (`6`) — so the first
// failing check wins. Writes go through the shared `RepoConfigWriter`
// and its `Lock`, with a bounded wait.

import RepoConfigWriter from '../../shared/lib/config/RepoConfigWriter.js';
import Lock from '../../shared/lib/file/Lock.js';
import {
  CliError, FileError, LockTimeoutRefusal, TargetUnavailableError, ValidationError
} from './exitCodes.js';
import { formatValue } from './output.js';
import { checkWriteSkew, tierSkew } from './skew.js';
import { REPO_CONFIG_FILE, readTierForWrite, tierFile } from './tierFiles.js';

/** The exit code after a Ctrl-C (128 + SIGINT). */
export const EXIT_SIGINT = 130;

const UNKNOWN_HINT = 'check the spelling, or pass --force for a key newer than this CLI';
const SHORT_VALUE = 40;

/**
 * Refuses a write to a tier with nowhere to write (exit `4`): an
 * unresolved, missing or non-directory Claude config dir for the global
 * tier; no repo, or a repo that is not arcanum-configured, for the repo
 * and local tiers. `--force` never bypasses this.
 * @param {string} tier - the target tier.
 * @param {{account: object, repo: object}} targets - the resolved targets.
 * @throws {TargetUnavailableError} when the tier has no usable target.
 */
export function checkWriteTarget(tier, { account, repo }) {
  if (tier === 'global') {
    if (account.state === 'unresolved') {
      throw new TargetUnavailableError('no claude config dir resolved (CLAUDE_CONFIG_DIR and HOME are unset)', {
        hint: 'set CLAUDE_CONFIG_DIR or pass --claude-config-dir'
      });
    }

    if (account.state === 'missing') {
      throw new TargetUnavailableError(`claude config dir ${account.dir} does not exist`);
    }

    if (account.state === 'not_directory') {
      throw new TargetUnavailableError(`claude config dir ${account.dir} is not a directory`);
    }

    return;
  }

  if (repo.root === null) {
    throw new TargetUnavailableError(`no repo at ${repo.path}; --repo and --local need a git repo`);
  }

  if (!repo.configured) {
    throw new TargetUnavailableError(`${repo.root} is not arcanum-configured (no ${REPO_CONFIG_FILE})`, {
      hint: 'run /init-claude in that repo'
    });
  }
}

/**
 * @param {unknown} value - a value the user just typed.
 * @returns {string} its JSON, when short enough to echo back.
 */
function shown(value) {
  const text = JSON.stringify(value);

  return text !== undefined && text.length <= SHORT_VALUE ? text : `a ${text === undefined ? 0 : text.length}-character value`;
}

/**
 * Turns a failed `KeyRegistry#check` into the CLI's validation error.
 * @param {string} key - the key.
 * @param {string} tier - the target tier.
 * @param {object} failure - the `check` result (`ok: false`).
 * @param {unknown} value - the parsed value (for `set`).
 * @returns {ValidationError} the exit-`3` refusal.
 */
export function validationError(key, tier, failure, value) {
  const at = failure.index === undefined ? key : `${key}[${failure.index}]`;
  const element = failure.index === undefined ? value : value[failure.index];

  switch (failure.reason) {
  case 'unknown':
    return new ValidationError(`unknown key '${key}'`, { hint: UNKNOWN_HINT });
  case 'read_only':
    return new ValidationError(`${key} is read-only; it is managed by migrations`);
  case 'tier':
    return new ValidationError(failure.allowed.length === 1
      ? `${key} is ${failure.allowed[0]}-only`
      : `${key} cannot be written to the ${tier} tier (allowed: ${failure.allowed.join(', ')})`);
  case 'null':
    return new ValidationError(`${key} must be a ${failure.expected}, got null`, { hint: failure.hint });
  case 'type': {
    const expected = failure.index === undefined ? failure.expected : failure.expected.replace(/^array of /, '');

    return new ValidationError(`${at} must be a ${expected}, got ${failure.got} ${shown(element)}`);
  }
  case 'enum':
    return new ValidationError(`${key} must be one of ${failure.values.join(', ')}, got ${shown(value)}`);
  case 'empty':
    return new ValidationError(`${key} may not be empty`);
  case 'integer':
    return new ValidationError(`${key} must be an integer, got ${failure.got}`);
  case 'min':
    return new ValidationError(`${key} must be at least ${failure.min}, got ${failure.got}`);
  case 'max':
    return new ValidationError(`${key} must be at most ${failure.max}, got ${failure.got}`);
  case 'format':
    return new ValidationError(`${at} is not a valid regex: ${failure.error}`);
  default:
    return new ValidationError(`${key} is not a valid value`);
  }
}

/**
 * Validates a `set` against the registry (exit `3`). An unknown key is
 * refused unless `--force`, which then skips the value checks; a known
 * key's checks are never bypassed.
 * @param {object} args - the check inputs.
 * @param {object} args.registry - the key registry.
 * @param {string} args.key - the key.
 * @param {string} args.tier - the target tier.
 * @param {{value: unknown, jsonError: (string|null), precisionLoss: boolean}} args.parsed - the `parseValue` result.
 * @param {string} args.raw - the value as typed.
 * @param {boolean} args.force - `--force`.
 * @param {boolean} args.string - `--string`.
 * @returns {{known: boolean, forced: boolean}} whether the key is known,
 *   and whether `--force` bypassed the unknown-key refusal.
 * @throws {ValidationError} on any refusal.
 */
export function validateSet({ registry, key, tier, parsed, raw, force, string }) {
  if (parsed.precisionLoss) {
    throw new ValidationError(`${key}: ${raw} cannot be stored as a number without losing precision`, {
      hint: 'pass --string to store it as text'
    });
  }

  const entry = registry.lookup(key);

  if (entry === null) {
    if (!force) {
      throw validationError(key, tier, { reason: 'unknown' });
    }

    return { known: false, forced: true };
  }

  if (entry.type === 'array' && parsed.jsonError !== null) {
    throw new ValidationError(`${key} must be a JSON array: ${parsed.jsonError}`);
  }

  const result = registry.check('set', key, tier, parsed.value);

  if (!result.ok) {
    const error = validationError(key, tier, result, parsed.value);

    if (string && result.reason === 'type' && error.hint === null) {
      error.hint = 'drop --string';
    }

    throw error;
  }

  return { known: true, forced: false };
}

/**
 * Validates an `unset` against the registry (exit `3`): unknown keys
 * unless `--force`, read-only keys and wrong tiers.
 * @param {object} args - the check inputs.
 * @param {object} args.registry - the key registry.
 * @param {string} args.key - the key.
 * @param {string} args.tier - the target tier.
 * @param {boolean} args.force - `--force`.
 * @returns {{known: boolean, forced: boolean}} as for `validateSet`.
 * @throws {ValidationError} on any refusal.
 */
export function validateUnset({ registry, key, tier, force }) {
  const result = registry.check('unset', key, tier);

  if (result.ok) {
    return { known: true, forced: false };
  }

  if (result.reason === 'unknown' && force) {
    return { known: false, forced: true };
  }

  throw validationError(key, tier, result);
}

/**
 * Runs the checks before a write, in precedence order: target, file,
 * registry (through `validate`), then skew.
 * @param {object} context - the subcommand context.
 * @param {string} context.tier - the target tier.
 * @param {() => Promise<object>} context.resolveTargets - resolves the account and repo.
 * @param {string} context.version - the CLI's version.
 * @param {object} context.migrationVersions - the per-scope migration versions.
 * @param {boolean} force - `--force`.
 * @param {(read: object) => {known: boolean, forced: boolean}} validate -
 *   the registry check, given the target file's current read.
 * @returns {Promise<{targets: object, file: string, read: object, known: boolean, forced: boolean}>}
 *   the write's target file, its current content, and whether `--force`
 *   bypassed a refusal.
 * @throws {CliError} the first refusal that applies.
 */
export async function prepareWrite(context, force, validate) {
  const { tier, version, migrationVersions } = context;
  const targets = await context.resolveTargets();

  checkWriteTarget(tier, targets);

  const file = tierFile(tier, targets);
  const read = await readTierForWrite(file);
  const { known, forced: unknownForced } = validate(read);
  const skewForced = checkWriteSkew(tier, tierSkew(tier, read, { cliVersion: version, migrationVersions }), {
    cliVersion: version, force
  });

  return { targets, file, read, known, forced: unknownForced || skewForced };
}

/**
 * Wraps a `Lock` so that the writer's acquire never prints `Lock`'s own
 * "seems stuck" warning (the timeout message replaces it), and tracks
 * whether the lock is held, for the SIGINT handler.
 * @param {Lock} lock - the shared lock.
 * @returns {{acquire: (lockFile: string, options?: object) => Promise<void>, release: (lockFile: string) => Promise<void>, held: () => boolean}}
 *   the wrapper.
 */
function quietLock(lock) {
  let held = false;

  return {
    async acquire(lockFile, options = {}) {
      await lock.acquire(lockFile, { ...options, warn: false });
      held = true;
    },
    async release(lockFile) {
      held = false;
      await lock.release(lockFile);
    },
    held: () => held
  };
}

/**
 * The default signal hooks: the real process.
 * @returns {{on: (signal: string, handler: () => void) => void, off: (signal: string, handler: () => void) => void, exit: (code: number) => void}}
 *   the hooks.
 */
function processSignals() {
  return {
    on: (signal, handler) => process.on(signal, handler),
    off: (signal, handler) => process.off(signal, handler),
    exit: (code) => process.exit(code)
  };
}

/**
 * Writes, removes or updates one key through `RepoConfigWriter` under
 * its lock, with a bounded wait. A known key of two or more segments is
 * written as `namespace` + the rest; a one-segment or `--force`d unknown
 * key uses the top-level form. `update` is the atomic read-modify-write
 * (`RepoConfigWriter#update`): `mutate` runs inside the lock, on the
 * value as re-read there. On SIGINT the lock is released (owner-checked)
 * and the process exits `130`.
 * @param {object} args - the write's inputs.
 * @param {string} args.op - `set`, `unset` or `update`.
 * @param {string} args.file - the tier file.
 * @param {string} args.key - the dotted key.
 * @param {unknown} [args.value] - the value (for `set`).
 * @param {(current: unknown) => unknown} [args.mutate] - builds the new
 *   value from the current one (for `update`); what it throws propagates.
 * @param {boolean} args.known - whether the key is in the registry.
 * @param {number} args.timeoutMs - the lock wait bound.
 * @param {string} args.timeoutLabel - the bound as the user gave it, in seconds.
 * @param {object} [args.deps] - injectable collaborators: `lock`, `signals`.
 * @returns {Promise<(object|undefined)>} resolves once written and
 *   unlocked; for `update`, to `{changed, previous, value}`.
 * @throws {CliError} `LockTimeoutRefusal` (exit `6`) on timeout, `FileError`
 *   (exit `7`) for a non-object on the key's path or an I/O error.
 */
export async function writeKey({ op, file, key, value, mutate, known, timeoutMs, timeoutLabel, deps = {} }) {
  const lock = quietLock(deps.lock || new Lock());
  const signals = deps.signals || processSignals();
  const lockFile = `${file}.lock`;
  const writer = new RepoConfigWriter({ lock });
  const segments = key.split('.');
  const target = known && segments.length > 1
    ? { newFile: file, namespace: segments[0], key: segments.slice(1).join('.'), timeoutMs }
    : { newFile: file, key, timeoutMs };
  const onSigint = () => {
    const released = lock.held() ? lock.release(lockFile) : Promise.resolve();

    released.catch(() => {}).then(() => signals.exit(EXIT_SIGINT));
  };

  signals.on('SIGINT', onSigint);

  try {
    if (op === 'set') {
      await writer.write({ ...target, value });
    } else if (op === 'update') {
      return await writer.update({ ...target, mutate });
    } else {
      await writer.unset(target);
    }

    return undefined;
  } catch (error) {
    throw writeError(error, { file, key, lockFile, timeoutLabel });
  } finally {
    signals.off('SIGINT', onSigint);
  }
}

/**
 * Maps a writer failure to the CLI's refusals.
 * @param {unknown} error - the thrown value.
 * @param {object} details - what was being written.
 * @param {string} details.file - the tier file.
 * @param {string} details.key - the key.
 * @param {string} details.lockFile - the lock file.
 * @param {string} details.timeoutLabel - the lock wait bound, in seconds.
 * @returns {unknown} the error to rethrow.
 */
function writeError(error, { file, key, lockFile, timeoutLabel }) {
  const code = error && typeof error === 'object' ? error.code : undefined;

  if (error instanceof CliError) {
    return error;
  }

  if (code === 'LOCK_TIMEOUT') {
    return new LockTimeoutRefusal(`timed out after ${timeoutLabel}s waiting for ${lockFile}`, {
      hint: 'if no arcanum process is running, remove that file'
    });
  }

  if (code === 'NOT_AN_OBJECT') {
    const message = error.message.replace(/^Cannot index /, '').replace(/: not a JSON object$/, '');

    return new FileError(`cannot write ${key} to ${file}: ${message} is not a JSON object; refusing to overwrite it`, {
      hint: 'fix or remove the file'
    });
  }

  if (error && typeof error === 'object' && typeof error.errno === 'number') {
    return new FileError(`cannot write ${file}: ${error.message}`);
  }

  return error;
}

/**
 * @param {{set: boolean, value: unknown}} previous - the key's previous state.
 * @returns {string} the human `was:` value.
 */
export function wasText(previous) {
  return previous.set ? formatValue(previous.value) : 'unset';
}
