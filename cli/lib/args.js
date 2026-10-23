// The argument layer shared by every `arcanum config` subcommand: the
// `--repo` overload pre-scan, tier-flag exclusivity, per-subcommand flag
// sets, strict arity, key syntax and `--lock-timeout`. Everything here
// runs before any filesystem access, so usage errors (exit `2`) always
// win (see docs/agents/specs/arcanum-cli/command-surface.md#syntax-rules).

import { UsageError } from './exitCodes.js';

/** The tier flags, in the order the spec lists them. */
export const TIER_FLAGS = ['global', 'repo', 'local'];

/** The default `--lock-timeout`, in seconds. */
export const DEFAULT_LOCK_TIMEOUT_SECONDS = 10;

const LOCK_TIMEOUT_PATTERN = /^\d+(\.\d+)?$/;

/**
 * Splits the targeting forms of `--repo` out of argv, before `parseArgs`
 * sees it. The rule is syntactic: `--repo=<path>` is always the
 * targeting form; `--repo <token>` is the targeting form when `<token>`
 * contains a `/` or is `.` or `..`; any other `--repo` (including a
 * trailing one) is the repo tier flag and is left in argv. Scanning
 * stops at `--`.
 * @param {string[]} argv - the raw arguments.
 * @returns {{args: string[], repoPath: (string|undefined)}} argv without
 *   the targeting forms, and the targeted path, if any.
 * @throws {UsageError} when a targeting path is given more than once or
 *   is empty.
 */
export function extractRepoTarget(argv) {
  const args = [];
  let repoPath;

  const setPath = (value) => {
    if (repoPath !== undefined) {
      throw new UsageError('--repo <path> given more than once');
    }

    if (value === '') {
      throw new UsageError('--repo=<path> needs a path');
    }

    repoPath = value;
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--') {
      args.push(...argv.slice(index));
      break;
    }

    if (arg.startsWith('--repo=')) {
      setPath(arg.slice('--repo='.length));
      continue;
    }

    if (arg === '--repo' && index + 1 < argv.length && isPathToken(argv[index + 1])) {
      setPath(argv[index + 1]);
      index += 1;
      continue;
    }

    args.push(arg);
  }

  return { args, repoPath };
}

/**
 * @param {string} token - the token following a bare `--repo`.
 * @returns {boolean} whether it makes `--repo` the targeting form.
 */
export function isPathToken(token) {
  return token.includes('/') || token === '.' || token === '..';
}

/**
 * Finds the first positional argument (the command or subcommand name),
 * skipping the values of string-typed options.
 * @param {string[]} argv - the arguments.
 * @param {string[]} valueOptions - the long names of the options that
 *   take a value (e.g. `claude-config-dir`).
 * @returns {string|undefined} the first positional, or `undefined`.
 */
export function firstPositional(argv, valueOptions) {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--') {
      return argv[index + 1];
    }

    if (!arg.startsWith('-') || arg === '-') {
      return arg;
    }

    if (arg.startsWith('--') && !arg.includes('=') && valueOptions.includes(arg.slice(2))) {
      index += 1;
    }
  }

  return undefined;
}

/**
 * @param {object} options - a `parseArgs` options object.
 * @returns {string[]} the names of its string-typed options.
 */
export function valueOptionNames(options) {
  return Object.entries(options).filter(([, option]) => option.type === 'string').map(([name]) => name);
}

/**
 * Returns the single tier flag given, enforcing their mutual exclusion
 * and `--all-tiers`'s exclusion with any of them.
 * @param {object} values - the parsed flags.
 * @returns {(string|undefined)} `global`, `repo`, `local` or `undefined`.
 * @throws {UsageError} when two tier flags, or `--all-tiers` and a tier
 *   flag, are combined.
 */
export function selectedTier(values) {
  const given = TIER_FLAGS.filter((tier) => values[tier]);

  if (given.length > 1) {
    throw new UsageError(`--${given[0]} cannot be combined with --${given[1]}`);
  }

  if (values['all-tiers'] && given.length === 1) {
    throw new UsageError(`--all-tiers cannot be combined with --${given[0]}`);
  }

  return given[0];
}

/**
 * Refuses subcommand-specific flags given to a subcommand that does not
 * accept them (`--all-tiers` outside `get`, `--string` outside `set`,
 * `--force`/`--lock-timeout` outside `set`/`unset`).
 * @param {string} subcommand - the subcommand name.
 * @param {object} values - the parsed flags.
 * @param {object} accepted - the subcommand's own `parseArgs` options.
 * @param {object} commandOptions - every subcommand-specific option of
 *   the namespace, keyed by name, each with an `only` list of the
 *   subcommands accepting it.
 * @throws {UsageError} naming the flag and the subcommands accepting it.
 */
export function checkFlags(subcommand, values, accepted, commandOptions) {
  for (const [name, option] of Object.entries(commandOptions)) {
    if (values[name] !== undefined && !Object.hasOwn(accepted, name)) {
      throw new UsageError(`--${name} is only accepted by ${joinAnd(option.only)}, not ${subcommand}`);
    }
  }
}

/**
 * @param {string[]} words - the words to list.
 * @returns {string} `a`, `a and b`, or `a, b and c`.
 */
export function joinAnd(words) {
  return words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

/**
 * Enforces a subcommand's positional arity: exact, unless the last name
 * ends with `...`, which takes any number (zero included) of trailing
 * positionals.
 * @param {string} subcommand - the subcommand name.
 * @param {string[]} positionals - its positionals (after the name).
 * @param {string[]} names - the expected positional names, e.g.
 *   `['key', 'value']` or `['section...']`.
 * @throws {UsageError} on a missing or extra positional.
 */
export function checkArity(subcommand, positionals, names) {
  const variadic = names.length > 0 && names[names.length - 1].endsWith('...');
  const required = variadic ? names.slice(0, -1) : names;

  if (positionals.length < required.length) {
    const missing = required.slice(positionals.length).map((name) => `<${name}>`).join(' ');

    throw new UsageError(`${subcommand} needs ${missing}`);
  }

  if (!variadic && positionals.length > names.length) {
    throw new UsageError(`${subcommand}: unexpected argument '${positionals[names.length]}'`);
  }
}

/**
 * Checks a dotted key's syntax: no empty segment.
 * @param {string} key - the key as typed.
 * @returns {string} the key.
 * @throws {UsageError} on an empty key or an empty segment (`a..b`, a
 *   leading or a trailing `.`).
 */
export function checkKey(key) {
  if (key === '' || key.split('.').some((segment) => segment === '')) {
    throw new UsageError(`invalid key '${key}': a key segment may not be empty`);
  }

  return key;
}

/**
 * Parses `--lock-timeout <seconds>`.
 * @param {(string|undefined)} raw - the flag's value, if given.
 * @returns {number} the timeout in milliseconds (default `10` seconds).
 * @throws {UsageError} on a negative or non-numeric value.
 */
export function lockTimeoutMs(raw) {
  if (raw === undefined) {
    return DEFAULT_LOCK_TIMEOUT_SECONDS * 1000;
  }

  if (!LOCK_TIMEOUT_PATTERN.test(raw)) {
    throw new UsageError(`--lock-timeout must be a non-negative number of seconds, got '${raw}'`);
  }

  return Math.round(Number(raw) * 1000);
}

/**
 * Requires a tier flag (for `set` and `unset`).
 * @param {string} subcommand - the subcommand name.
 * @param {(string|undefined)} tier - the selected tier.
 * @returns {string} the tier.
 * @throws {UsageError} when no tier was given.
 */
export function requireTier(subcommand, tier) {
  if (tier === undefined) {
    throw new UsageError(`${subcommand} needs a tier: --global, --repo or --local`);
  }

  return tier;
}
