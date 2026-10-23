// `arcanum config auto-fix-all ignore-checks [list] | add <pattern>... |
// remove <pattern>...` (see the `ignore-checks` section of
// docs/agents/specs/arcanum-cli/shortcuts-and-setup.md). The key is
// repo-only, its entries are case-insensitive regex strings (not globs),
// and `add`/`remove` are a read-modify-write inside the lock
// (`RepoConfigWriter#update`), so concurrent calls never lose updates.

import { lockTimeoutMs } from '../../../args.js';
import { EXIT_OK, UsageError, ValidationError } from '../../../exitCodes.js';
import { formatValue } from '../../../output.js';
import { lookupKey } from '../../../tierFiles.js';
import { prepareWrite, validationError, writeKey } from '../../../writeTier.js';
import { displayFile, readTiers } from '../shared.js';
import { checkShortcutFlags, memoizeTargets } from './common.js';

/** The shortcut's name, as typed. */
export const NAME = 'auto-fix-all ignore-checks';

/** The key it edits. */
export const KEY = 'auto-fix-all.ignored_check_patterns';

/** Its only tier. */
export const TIER = 'repo';

/** The hint for a stored value that is not an array. */
export const NOT_ARRAY_HINT = `fix it with: arcanum config set ${KEY} '[...]' --repo`;

const VERBS = ['list', 'add', 'remove'];

/** Thrown by `mutate` when nothing changes, so nothing is written. */
class NoChange extends Error {}

/**
 * Runs `ignore-checks`: `list` (the default), `add` or `remove`.
 * @param {object} context - the `config` context.
 * @param {string[]} args - the positionals after `ignore-checks`.
 * @returns {Promise<number>} the exit code.
 * @throws {UsageError} on an unknown verb, a missing pattern or a flag
 *   the verb does not accept.
 */
export function runIgnoreChecks(context, args) {
  const [verb = 'list', ...patterns] = args;

  if (!VERBS.includes(verb)) {
    throw new UsageError(`${NAME}: unknown verb '${verb}'`, { hint: `use ${VERBS.join(', ')}` });
  }

  if (context.values.unset) {
    throw new UsageError(`--unset is not accepted by ${NAME}`, { hint: `use arcanum config unset ${KEY} --repo` });
  }

  if (verb === 'list') {
    if (patterns.length > 0) {
      throw new UsageError(`${NAME} list: unexpected argument '${patterns[0]}'`);
    }

    return listPatterns(context, checkShortcutFlags(`${NAME} list`, context.values, { write: false }));
  }

  if (patterns.length === 0) {
    throw new UsageError(`${NAME} ${verb} needs <pattern>...`, { hint: 'use -- before a pattern starting with -' });
  }

  if (context.values['all-tiers']) {
    throw new UsageError(`--all-tiers is not accepted by ${NAME} ${verb}`);
  }

  const tier = checkShortcutFlags(`${NAME} ${verb}`, context.values, { write: true });

  return editPatterns(context, { verb, patterns, tier: tier || TIER });
}

/**
 * @param {object} registry - the key registry.
 * @param {string} tier - the tier asked for.
 * @throws {ValidationError} (exit `3`) when it is not the repo tier.
 */
function checkTier(registry, tier) {
  const result = registry.check('unset', KEY, tier);

  if (!result.ok) {
    throw validationError(KEY, tier, result);
  }
}

/**
 * @param {unknown} value - the stored value (`undefined`/`null`: absent).
 * @returns {unknown[]} the patterns; an absent key counts as `[]`.
 * @throws {ValidationError} (exit `3`) when the value is not an array.
 */
export function storedPatterns(value) {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new ValidationError(`${KEY} is not an array (got ${JSON.stringify(value)})`, { hint: NOT_ARRAY_HINT });
  }

  return value;
}

/**
 * `ignore-checks [list]`: the patterns, one per line (nothing for none).
 * Reads take no lock.
 * @param {object} context - the `config` context.
 * @param {(string|undefined)} tier - the tier flag given, if any.
 * @returns {Promise<number>} the exit code.
 * @throws {ValidationError} for a tier other than repo, or a stored
 *   value that is not an array.
 */
async function listPatterns(context, tier) {
  const { tiers: [{ file, read }] } = await readTiers({ ...context, tier: TIER });

  checkTier(context.registry, tier || TIER);

  const found = lookupKey(read.data, KEY);
  const patterns = storedPatterns(found.set ? found.value : undefined);

  context.output.result(patterns.map(formatValue).join('\n'), { key: KEY, tier: TIER, file, patterns });

  return EXIT_OK;
}

/**
 * Applies `add` or `remove` to the current patterns.
 * @param {string} verb - `add` or `remove`.
 * @param {unknown[]} current - the stored patterns.
 * @param {string[]} patterns - the patterns given.
 * @returns {{value: unknown[], added: string[], removed: string[]}} the
 *   new patterns and the ones actually changed.
 */
export function applyPatterns(verb, current, patterns) {
  if (verb === 'add') {
    const value = [...current];
    const added = [];

    for (const pattern of patterns) {
      if (!value.includes(pattern)) {
        value.push(pattern);
        added.push(pattern);
      }
    }

    return { value, added, removed: [] };
  }

  const removed = [...new Set(patterns.filter((pattern) => current.includes(pattern)))];

  return { value: current.filter((pattern) => !removed.includes(pattern)), added: [], removed };
}

/**
 * `ignore-checks add|remove <pattern>...`: edits the array (see
 * `updatePatterns`) and prints one line per distinct pattern given.
 * @param {object} context - the `config` context.
 * @param {object} edit - the edit.
 * @param {string} edit.verb - `add` or `remove`.
 * @param {string[]} edit.patterns - the patterns given.
 * @param {string} edit.tier - the target tier.
 * @returns {Promise<number>} the exit code.
 */
async function editPatterns(context, { verb, patterns, tier }) {
  const { targets, file, changed, previous, value, changes } = await updatePatterns(context, { verb, patterns, tier });
  const where = `(${tier}: ${displayFile(tier, file, targets)})`;

  context.output.result(editText(verb, patterns, changes, where), {
    key: KEY, tier, file, changed, previous, value, forced: false, added: changes.added, removed: changes.removed
  });

  return EXIT_OK;
}

/**
 * The core of `ignore-checks add|remove`, shared with the `config setup`
 * wizard: after the generic pre-write checks (target `4`, file `7`,
 * registry `3` — tier and, for `add`, every pattern compiling with
 * `new RegExp(p, 'i')` — and skew `5`), re-reads, modifies and writes
 * the array inside the lock.
 * @param {object} context - the command's context (`values`,
 *   `registry`, `deps`, `resolveTargets`, `version`, `migrationVersions`).
 * @param {object} edit - the edit.
 * @param {string} edit.verb - `add` or `remove`.
 * @param {string[]} edit.patterns - the patterns given.
 * @param {string} [edit.tier] - the target tier (default: repo).
 * @returns {Promise<{targets: object, file: string, changed: boolean, previous: object, value: unknown[], changes: {added: string[], removed: string[]}}>}
 *   the outcome: the previous state and the new patterns.
 * @throws {Error} the first refusal that applies (a `CliError`).
 */
export async function updatePatterns(context, { verb, patterns, tier = TIER }) {
  const { values, registry, deps } = context;
  const timeoutMs = lockTimeoutMs(values['lock-timeout']);
  const resolveTargets = memoizeTargets(context.resolveTargets);
  const { targets, file } = await prepareWrite({ ...context, resolveTargets, tier }, false, (read) => {
    const result = verb === 'add' ? registry.check('set', KEY, tier, patterns) : registry.check('unset', KEY, tier);

    if (!result.ok) {
      throw validationError(KEY, tier, result, patterns);
    }

    storedPatterns(lookupKey(read.data, KEY).value);

    return { known: true, forced: false };
  });

  let changes = { added: [], removed: [] };
  let outcome;

  try {
    outcome = await writeKey({
      op: 'update',
      file,
      key: KEY,
      known: true,
      timeoutMs,
      timeoutLabel: values['lock-timeout'] || '10',
      deps,
      mutate: (current) => {
        const stored = storedPatterns(current);

        changes = applyPatterns(verb, stored, patterns);

        if (current === undefined && changes.added.length === 0) {
          throw new NoChange();
        }

        return changes.value;
      }
    });
  } catch (error) {
    if (!(error instanceof NoChange)) {
      throw error;
    }

    outcome = { changed: false, previous: undefined, value: undefined };
  }

  return {
    targets,
    file,
    changed: outcome.changed,
    previous: outcome.previous === undefined || outcome.previous === null
      ? { set: false, value: null }
      : { set: true, value: outcome.previous },
    value: outcome.value === undefined || outcome.value === null ? [] : outcome.value,
    changes: { added: changes.added, removed: changes.removed }
  };
}

/**
 * @param {string} verb - `add` or `remove`.
 * @param {string[]} patterns - the patterns given.
 * @param {{added: string[], removed: string[]}} changes - the ones changed.
 * @param {string} where - `(repo: <file>)`.
 * @returns {string} one line per distinct pattern given.
 */
function editText(verb, patterns, changes, where) {
  const done = verb === 'add' ? changes.added : changes.removed;

  return [...new Set(patterns)].map((pattern) => {
    const quoted = `'${pattern}'`;

    if (done.includes(pattern)) {
      return verb === 'add' ? `added ${quoted} to ${KEY} ${where}` : `removed ${quoted} from ${KEY} ${where}`;
    }

    return verb === 'add' ? `${quoted} already present` : `${quoted} not present`;
  }).join('\n');
}
