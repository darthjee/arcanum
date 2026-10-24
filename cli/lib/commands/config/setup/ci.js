// The `config setup` ci section (see
// docs/agents/architecture/arcanum-cli.md#per-setting-flow): the repo-only
// `auto-fix-all.ignored_check_patterns` array, edited one pattern at a
// time through an `[a]dd / [r]emove / [d]one` loop. Each change is
// confirmed, then written like `ignore-checks add/remove`: an atomic
// read-modify-write inside the lock.

import { exitCodeForError } from '../../../exitCodes.js';
import { errorMessage, formatValue, reportError } from '../../../output.js';
import { Interrupted } from '../../../prompter.js';
import { lookupKey, tierFile } from '../../../tierFiles.js';
import { validationError } from '../../../writeTier.js';
import { readTiers } from '../shared.js';
import { KEY, TIER, storedPatterns, updatePatterns } from '../shortcuts/ignoreChecks.js';
import { confirm, record } from './setting.js';

/** The loop's question. */
export const LOOP_QUESTION = '  [a]dd / [r]emove / [d]one: ';

const VERBS = { a: 'add', add: 'add', r: 'remove', remove: 'remove', d: 'done', done: 'done', '': 'done' };

/**
 * @param {unknown[]} patterns - the patterns.
 * @returns {string} the list, for the `current:` line.
 */
export function patternsText(patterns) {
  return patterns.length === 0 ? '(none)' : patterns.map(formatValue).join(', ');
}

/**
 * Runs the ci item: shows the stored list, then loops until done. A
 * stored value that is not an array marks the item failed.
 * @param {object} session - the wizard's state.
 * @param {object} item - the `array` item.
 * @param {string} item.key - its key.
 * @param {object} item.entry - its registry entry.
 * @returns {Promise<void>} resolves once done.
 */
export async function askPatterns(session, { key, entry }) {
  const { tiers: [{ read }] } = await readTiers({ ...session.context, tier: TIER });

  session.io.stderr.write(`\n${key} — ${entry.description}\n`);

  let patterns;

  try {
    const found = lookupKey(read.data, KEY);

    patterns = storedPatterns(found.set ? found.value : undefined);
  } catch (error) {
    fail(session, error);

    return;
  }

  session.io.stderr.write(`  current: ${patternsText(patterns)}\n`);

  let changed = false;

  for (;;) {
    const verb = await askVerb(session);

    if (verb === 'done') {
      break;
    }

    const pattern = verb === 'add' ? await askNewPattern(session, patterns) : await askOldPattern(session, patterns);

    if (pattern === null) {
      continue;
    }

    const file = tierFile(TIER, session.targets);
    const question = verb === 'add'
      ? `  add '${pattern}' to ${KEY} at ${TIER} (${file})? [Y/n] `
      : `  remove '${pattern}' from ${KEY} at ${TIER} (${file})? [Y/n] `;

    if (!await confirm(session, question)) {
      continue;
    }

    const written = await write(session, verb, pattern);

    if (written !== null) {
      patterns = written;
      changed = true;
      session.io.stderr.write(`  now: ${patternsText(patterns)}\n`);
    }
  }

  if (!changed) {
    record(session, { status: 'kept', key: KEY, tier: TIER, value: patterns });
  }
}

/**
 * @param {object} session - the wizard's state.
 * @returns {Promise<string>} `add`, `remove` or `done`.
 */
async function askVerb(session) {
  for (;;) {
    const answer = (await session.prompter.ask(LOOP_QUESTION)).trim().toLowerCase();

    if (Object.hasOwn(VERBS, answer)) {
      return VERBS[answer];
    }

    session.io.stderr.write('arcanum: answer a, r or d\n');
  }
}

/**
 * Asks for a pattern to add until it compiles (`new RegExp(p, 'i')`,
 * the registry's `regex` format check). An empty answer goes back to
 * the loop; one already present is reported and not written.
 * @param {object} session - the wizard's state.
 * @param {unknown[]} patterns - the current patterns.
 * @returns {Promise<(string|null)>} the pattern, or `null` for none.
 */
async function askNewPattern(session, patterns) {
  for (;;) {
    const pattern = (await session.prompter.ask('  pattern to add: ')).trim();

    if (pattern === '') {
      return null;
    }

    const result = session.registry.check('set', KEY, TIER, [pattern]);

    if (!result.ok) {
      reportError(session.io, validationError(KEY, TIER, result, [pattern]));
      continue;
    }

    if (patterns.includes(pattern)) {
      session.io.stderr.write(`  '${pattern}' already present\n`);

      return null;
    }

    return pattern;
  }
}

/**
 * Asks for a pattern to remove; one not in the list is reported.
 * @param {object} session - the wizard's state.
 * @param {unknown[]} patterns - the current patterns.
 * @returns {Promise<(string|null)>} the pattern, or `null` for none.
 */
async function askOldPattern(session, patterns) {
  const pattern = (await session.prompter.ask('  pattern to remove: ')).trim();

  if (pattern === '') {
    return null;
  }

  if (!patterns.includes(pattern)) {
    session.io.stderr.write(`  '${pattern}' not present\n`);

    return null;
  }

  return pattern;
}

/**
 * Writes one add or remove through `updatePatterns`, recording it as its
 * own summary row; a failure is printed and recorded.
 * @param {object} session - the wizard's state.
 * @param {string} verb - `add` or `remove`.
 * @param {string} pattern - the pattern.
 * @returns {Promise<(unknown[]|null)>} the patterns now stored, or
 *   `null` when the write failed.
 * @throws {Interrupted} when interrupted mid-write.
 */
async function write(session, verb, pattern) {
  try {
    const { previous, value } = await updatePatterns(session.context, { verb, patterns: [pattern] });

    record(session, { status: 'written', key: KEY, tier: TIER, previous, value });

    return value;
  } catch (error) {
    if (error instanceof Interrupted) {
      throw error;
    }

    fail(session, error);

    return null;
  }
}

/**
 * @param {object} session - the wizard's state.
 * @param {unknown} error - what failed.
 */
function fail(session, error) {
  reportError(session.io, error);
  record(session, { status: 'failed', key: KEY, tier: TIER, reason: errorMessage(error), exit: exitCodeForError(error) });
}
