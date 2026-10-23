// `arcanum config next-step auto [<skill> [on|off | --unset]]` (see the
// Design rules and Output sections of
// docs/agents/specs/arcanum-cli/shortcuts-and-setup.md): with a skill, a
// boolean single-value shortcut over `next_step.auto.<skill>`; without
// one, the listing of every `next_step.auto.*` key that is set.

import { checkKey } from '../../../args.js';
import { EXIT_OK, UsageError } from '../../../exitCodes.js';
import { formatValue } from '../../../output.js';
import { lookupKey } from '../../../tierFiles.js';
import { readTiers } from '../shared.js';
import { checkShortcutFlags } from './common.js';
import { runSingleValue } from './singleValue.js';

/** The shortcut's name, as typed. */
export const NAME = 'next-step auto';

/** The key prefix the shortcut covers. */
export const PREFIX = 'next_step.auto';

/**
 * Runs `next-step auto`: the listing without a skill, else the
 * single-value shortcut over `next_step.auto.<skill>` (default tier
 * local). Any well-formed skill name is accepted.
 * @param {object} context - the `config` context.
 * @param {string[]} args - the positionals after `next-step auto`.
 * @returns {Promise<number>} the exit code.
 * @throws {UsageError} on a flag the form does not accept, or an
 *   empty skill name.
 */
export function runNextStepAuto(context, args) {
  const [skill, ...rest] = args;

  if (skill === undefined) {
    return listAuto(context);
  }

  const key = checkKey(`${PREFIX}.${skill}`);

  return runSingleValue(context, { name: NAME, key, tier: 'local', kind: 'boolean' }, rest);
}

/**
 * Lists every resolved `next_step.auto.*` key that is set, sorted by
 * skill, as `<skill>  <value>  (<tier>)`; with a tier flag, only that
 * tier's. Always exits `0`, even when nothing is set.
 * @param {object} context - the `config` context.
 * @returns {Promise<number>} the exit code.
 * @throws {UsageError} on `--unset`, `--all-tiers` or a write flag.
 */
export async function listAuto(context) {
  const { values, output } = context;

  if (values.unset) {
    throw new UsageError(`${NAME}: --unset needs a <skill>`);
  }

  if (values['all-tiers']) {
    throw new UsageError(`--all-tiers is not accepted by the ${NAME} listing; pass a <skill>`);
  }

  const tier = checkShortcutFlags(NAME, values, { write: false });
  const { tiers } = await readTiers({ ...context, tier });
  const resolved = new Map();

  for (const { tier: source, read } of tiers) {
    const auto = lookupKey(read.data, PREFIX);

    if (!auto.set || typeof auto.value !== 'object' || Array.isArray(auto.value)) {
      continue;
    }

    for (const [skill, value] of Object.entries(auto.value)) {
      if (value !== null && !resolved.has(skill)) {
        resolved.set(skill, { key: `${PREFIX}.${skill}`, value, source });
      }
    }
  }

  const skills = [...resolved.keys()].sort((a, b) => (a < b ? -1 : Number(a > b)));
  const entries = skills.map((skill) => resolved.get(skill));

  output.result(listText(skills, entries), { entries });

  return EXIT_OK;
}

/**
 * @param {string[]} skills - the skills, sorted.
 * @param {object[]} entries - their entries, in the same order.
 * @returns {string} the aligned human listing (empty for no entries).
 */
function listText(skills, entries) {
  const rows = entries.map((entry, index) => [skills[index], formatValue(entry.value), `(${entry.source})`]);
  const widths = [0, 1].map((column) => Math.max(0, ...rows.map((row) => row[column].length)));

  return rows.map((row) => `${row[0].padEnd(widths[0])}  ${row[1].padEnd(widths[1])}  ${row[2]}`).join('\n');
}
