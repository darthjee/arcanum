// The single-value shortcuts (see
// docs/agents/architecture/arcanum-cli.md#shortcuts, its Design rules and
// docs/agents/architecture/arcanum-cli.md#shortcut-output):
// no value reads like `config get`, a value writes like `config set` at
// the key's default tier (from the registry), `--unset` removes like `config unset`.

import { parseBooleanToken } from '../../../booleanToken.js';
import { UsageError } from '../../../exitCodes.js';
import { checkMaxArity, checkShortcutFlags, delegate, writeValue } from './common.js';
import { defaultTier } from './defaultTier.js';

/**
 * The single-value shortcuts: the name as typed → its key and its value
 * kind (the default write tier comes from the registry) (`enum`: parsed like `config set`;
 * `string`: stored as typed; `boolean`: an on/off token).
 */
export const SINGLE_VALUE = {
  engine: { key: 'engine.mode', kind: 'enum' },
  'git safe-branch': { key: 'git.safe_branch', kind: 'string' },
  'git merge-body': { key: 'git.merge_body_mode', kind: 'enum' },
  'auto-fix-all clear-context': { key: 'auto-fix-all.clear_context', kind: 'boolean' },
  'auto-fix-all finish-on-empty-queue': { key: 'auto-fix-all.finish_on_empty_queue', kind: 'boolean' },
  'monitor-issues clear-context': { key: 'monitor-issues.clear_context', kind: 'boolean' }
};

/**
 * The value parsers, by kind, each replacing `config set`'s `parseValue`
 * (`enum` keeps it, so enum refusals match `config set`'s).
 */
const PARSERS = {
  enum: () => undefined,
  string: () => (raw) => ({ value: raw, jsonError: null, precisionLoss: false }),
  boolean: (key) => (raw) => ({ value: parseBooleanToken(key, raw), jsonError: null, precisionLoss: false })
};

/**
 * Runs one single-value shortcut.
 * @param {object} context - the `config` context (flags, output,
 *   targets, and the `registry` giving the default write tier).
 * @param {object} shortcut - the shortcut.
 * @param {string} shortcut.name - its name, as typed (for errors).
 * @param {string} shortcut.key - the key it targets.
 * @param {string} shortcut.kind - its value kind (`enum`, `string`, `boolean`).
 * @param {string[]} args - its positionals: none, or the value.
 * @returns {Promise<number>} the exit code.
 * @throws {UsageError} on an extra positional, `--unset` with a value, or
 *   a flag the shortcut does not accept.
 */
export async function runSingleValue(context, { name, key, kind }, args) {
  const { values } = context;

  checkMaxArity(name, args, 1);

  const [raw] = args;
  const unset = Boolean(values.unset);

  if (unset && raw !== undefined) {
    throw new UsageError(`${name}: --unset cannot be combined with a value`);
  }

  const write = unset || raw !== undefined;
  const tier = checkShortcutFlags(name, values, { write });

  if (!write) {
    return delegate(context, 'get', [key], tier);
  }

  const writeTier = tier || defaultTier(key, context.registry);

  if (unset) {
    return delegate(context, 'unset', [key], writeTier);
  }

  return writeValue(context, { key, raw, tier: writeTier, parseValue: PARSERS[kind](key) });
}

/**
 * @param {string} name - a key of `SINGLE_VALUE`.
 * @returns {(context: object, args: string[]) => Promise<number>} the
 *   shortcut's runner.
 */
export function singleValue(name) {
  return (context, args) => runSingleValue(context, { name, ...SINGLE_VALUE[name] }, args);
}
