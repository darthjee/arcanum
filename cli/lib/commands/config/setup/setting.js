// The `config setup` wizard's per-setting dialogue (see the Per-setting
// flow and Input handling sections of
// docs/agents/specs/arcanum-cli/shortcuts-and-setup.md): show the
// setting, ask the value, ask the tier, confirm, then write through the
// generic `set`/`unset` path. No lock is held while a question is open.

import { BOOLEAN_TOKENS, BOOLEAN_TOKEN_NAMES } from '../../../booleanToken.js';
import { ValidationError, exitCodeForError } from '../../../exitCodes.js';
import { errorMessage, formatValue, reportError } from '../../../output.js';
import { Interrupted } from '../../../prompter.js';
import { TIERS, lookupKey, tierFile } from '../../../tierFiles.js';
import { parseValue } from '../../../values.js';
import { validateSet } from '../../../writeTier.js';
import { applySet } from '../set.js';
import { readTiers, registryDefault } from '../shared.js';
import { findShadowing } from '../shortcuts/common.js';
import { applyUnset } from '../unset.js';

/** The answer that unsets the key at the chosen tier. */
export const UNSET_ANSWER = '-';

/** The wizard's boolean answers: the shortcuts' tokens plus `y`/`n`. */
export const WIZARD_BOOLEANS = { y: true, n: false, ...BOOLEAN_TOKENS };

/** The answers to a yes/no question (Enter gives the question's default). */
const CONFIRM_ANSWERS = { y: true, yes: true, n: false, no: false };

/**
 * @param {string} key - the key the answer is for.
 * @param {string} raw - the answer.
 * @returns {boolean} the JSON boolean it stands for.
 * @throws {ValidationError} on any other answer.
 */
export function parseWizardBoolean(key, raw) {
  if (Object.hasOwn(WIZARD_BOOLEANS, raw)) {
    return WIZARD_BOOLEANS[raw];
  }

  throw new ValidationError(`${key} must be y or n, got ${JSON.stringify(raw)}`, {
    hint: `accepted: y, n, ${BOOLEAN_TOKEN_NAMES.join(', ')} (lowercase)`
  });
}

/**
 * Parses a typed value by the entry's type: booleans from the wizard's
 * tokens, strings as typed, anything else like `config set`.
 * @param {string} key - the key.
 * @param {object} entry - its registry entry.
 * @param {string} raw - the answer.
 * @returns {{value: unknown, jsonError: (string|null), precisionLoss: boolean}} the parsed value.
 * @throws {ValidationError} on an invalid boolean answer.
 */
export function parseAnswer(key, entry, raw) {
  if (entry.type === 'boolean') {
    return { value: parseWizardBoolean(key, raw), jsonError: null, precisionLoss: false };
  }

  if (entry.type === 'string') {
    return { value: raw, jsonError: null, precisionLoss: false };
  }

  return parseValue(raw);
}

/**
 * @param {object} entry - a registry entry.
 * @returns {string} the inline choices of the value question.
 */
export function valueChoices(entry) {
  if (entry.type === 'enum') {
    return `${entry.values.join('/')}, `;
  }

  return entry.type === 'boolean' ? 'y/n, ' : '';
}

/**
 * @param {object} entry - a registry entry.
 * @returns {string[]} the tiers it may be written to, in precedence order.
 */
export function allowedTiers(entry) {
  return TIERS.filter((tier) => entry.tiers.includes(tier));
}

/**
 * Resolves a key's current value as `config get` does.
 * @param {object} session - the wizard's state.
 * @param {string} key - the key.
 * @param {object} entry - its registry entry.
 * @returns {Promise<{set: boolean, value: unknown, source: (string|null), default: unknown}>}
 *   the resolved value and its source tier.
 */
export async function currentValue(session, key, entry) {
  const { tiers } = await readTiers({ ...session.context, tier: undefined });
  const winner = tiers.map(({ tier, read }) => ({ tier, ...lookupKey(read.data, key) })).find((found) => found.set);
  const fallback = registryDefault(entry);

  return winner
    ? { set: true, value: winner.value, source: winner.tier, default: fallback }
    : { set: false, value: null, source: null, default: fallback };
}

/**
 * @param {object} current - a `currentValue` result.
 * @returns {string} `<value> (<tier>)`, or `(unset)` with the default.
 */
export function currentText(current) {
  if (current.set) {
    return `${formatValue(current.value)} (${current.source})`;
  }

  return current.default === null ? '(unset)' : `(unset; default: ${formatValue(current.default)})`;
}

/**
 * Asks for the new value until it is valid.
 * @param {object} session - the wizard's state.
 * @param {object} item - the setting.
 * @param {string} item.key - its key.
 * @param {object} item.entry - its registry entry.
 * @param {string} item.defaultTier - its default write tier.
 * @returns {Promise<({op: 'keep'}|{op: 'unset'}|{op: 'set', raw: string, parsed: object})>}
 *   what to do.
 */
export async function askValue(session, { key, entry, defaultTier }) {
  const question = `  new value [${valueChoices(entry)}Enter keeps, ${UNSET_ANSWER} unsets]: `;

  for (;;) {
    const raw = (await session.prompter.ask(question)).trim();

    if (raw === '') {
      return { op: 'keep' };
    }

    if (raw === UNSET_ANSWER) {
      return { op: 'unset' };
    }

    try {
      const parsed = parseAnswer(key, entry, raw);

      validateSet({ registry: session.registry, key, tier: defaultTier, parsed, raw, force: false, string: false });

      return { op: 'set', raw, parsed };
    } catch (error) {
      if (!(error instanceof ValidationError)) {
        throw error;
      }

      reportError(session.io, error);
    }
  }
}

/**
 * Asks for the target tier, unless the key allows only one.
 * @param {object} session - the wizard's state.
 * @param {object} item - the setting.
 * @param {object} item.entry - its registry entry.
 * @param {string} item.defaultTier - its default write tier.
 * @returns {Promise<string>} the tier.
 */
export async function askTier(session, { entry, defaultTier }) {
  const tiers = allowedTiers(entry);

  if (tiers.length === 1) {
    return tiers[0];
  }

  for (;;) {
    const answer = (await session.prompter.ask(`  tier [${tiers.join('/')}] (${defaultTier}): `)).trim();

    if (answer === '') {
      return defaultTier;
    }

    if (tiers.includes(answer)) {
      return answer;
    }

    session.io.stderr.write(`arcanum: tier must be one of ${tiers.join(', ')}\n`);
  }
}

/**
 * Asks a yes/no question until answered.
 * @param {object} session - the wizard's state.
 * @param {string} question - the question, ending with `[Y/n] ` or `[y/N] `.
 * @param {boolean} [fallback] - the answer Enter gives (default yes).
 * @returns {Promise<boolean>} whether the user said yes.
 */
export async function confirm(session, question, fallback = true) {
  for (;;) {
    const answer = (await session.prompter.ask(question)).trim().toLowerCase();

    if (answer === '') {
      return fallback;
    }

    if (Object.hasOwn(CONFIRM_ANSWERS, answer)) {
      return CONFIRM_ANSWERS[answer];
    }

    session.io.stderr.write('arcanum: answer y or n\n');
  }
}

/**
 * Records a setting's outcome for the summary.
 * @param {object} session - the wizard's state.
 * @param {object} result - `{status, key, ...}`.
 */
export function record(session, result) {
  session.results.push(result);
}

/**
 * Prints the shadowing note when a higher-precedence tier holds a value.
 * @param {object} session - the wizard's state.
 * @param {string} key - the key.
 * @param {string} tier - the chosen tier.
 * @returns {Promise<void>} resolves once checked.
 */
export async function noteShadowed(session, key, tier) {
  const shadowing = await findShadowing(session.context, key, tier);

  if (shadowing !== null) {
    session.output.note(`${shadowing.tier} still overrides this (value: ${formatValue(shadowing.value)})`);
  }
}

/**
 * Confirms and writes one change: the shadowing note, the `[Y/n]`
 * question, then the generic `set`/`unset`. Declining records `kept`.
 * @param {object} session - the wizard's state.
 * @param {object} change - the change.
 * @param {string} change.key - the key.
 * @param {string} change.tier - the tier.
 * @param {string} change.op - `set` or `unset`.
 * @param {string} [change.raw] - the value as typed (for `set`).
 * @param {object} [change.parsed] - the parsed value (for `set`).
 * @param {object} [change.kept] - what the summary shows if declined.
 * @returns {Promise<void>} resolves once written, declined or failed.
 */
export async function confirmAndWrite(session, { key, tier, op, raw, parsed, kept = {} }) {
  const file = tierFile(tier, session.targets);
  const where = `${tier} (${file === null ? 'no target' : file})`;

  await noteShadowed(session, key, tier);

  const question = op === 'set'
    ? `  set ${key} = ${JSON.stringify(parsed.value)} at ${where}? [Y/n] `
    : `  unset ${key} at ${where}? [Y/n] `;

  if (!await confirm(session, question)) {
    record(session, { status: 'kept', key, tier: null, value: null, ...kept });

    return;
  }

  await write(session, { key, tier, op, raw, parsed });
}

/**
 * Writes one change through the generic `set`/`unset` body, so the
 * target, file, registry, skew and lock rules are the same code. A
 * failure is printed and recorded; the wizard moves on.
 * @param {object} session - the wizard's state.
 * @param {object} change - the change (see `confirmAndWrite`).
 * @param {string} change.key - the key.
 * @param {string} change.tier - the tier.
 * @param {string} change.op - `set` or `unset`.
 * @param {string} [change.raw] - the value as typed (for `set`).
 * @param {object} [change.parsed] - the parsed value (for `set`).
 * @returns {Promise<void>} resolves once written or failed.
 * @throws {Interrupted} when interrupted mid-write.
 */
export async function write(session, { key, tier, op, raw, parsed }) {
  const context = { ...session.context, args: op === 'set' ? [key, raw] : [key], tier, parseValue: () => parsed };

  try {
    if (op === 'set') {
      const { previous, value } = await applySet(context);

      record(session, { status: 'written', key, tier, previous, value });
    } else {
      const { previous, changed } = await applyUnset(context);

      record(session, changed
        ? { status: 'written', key, tier, previous, value: null }
        : { status: 'kept', key, tier, value: null });
    }
  } catch (error) {
    if (error instanceof Interrupted) {
      throw error;
    }

    reportError(session.io, error);
    record(session, { status: 'failed', key, tier, reason: errorMessage(error), exit: exitCodeForError(error) });
  }
}

/**
 * Runs the whole dialogue for one scalar setting.
 * @param {object} session - the wizard's state.
 * @param {object} item - the setting (`key`, `entry`, `defaultTier`).
 * @param {string[]} [extra] - further lines shown after `current:`.
 * @returns {Promise<void>} resolves once kept, written or failed.
 */
export async function askSetting(session, item, extra = []) {
  const { key, entry } = item;
  const current = await currentValue(session, key, entry);

  session.io.stderr.write([
    '',
    `${key} — ${entry.description}`,
    `  current: ${currentText(current)}`,
    ...extra.map((line) => `  ${line}`),
    ''
  ].join('\n'));

  const answer = await askValue(session, item);
  const kept = { tier: current.source, value: current.set ? current.value : null };

  if (answer.op === 'keep') {
    record(session, { status: 'kept', key, ...kept });

    return;
  }

  const tier = await askTier(session, item);

  await confirmAndWrite(session, { key, tier, ...answer, kept });
}
