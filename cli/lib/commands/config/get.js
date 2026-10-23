import { EXIT_ERROR, EXIT_OK } from '../../exitCodes.js';
import { formatValue } from '../../output.js';
import { lookupKey } from '../../tierFiles.js';
import { displayFile, readTiers, registryDefault } from './shared.js';

/** `config get`'s own flags, beyond the global ones. */
export const options = { 'all-tiers': { type: 'boolean' } };

/** `config get`'s positionals, in order. */
export const positionals = ['key'];

/** Whether `config get` accepts the tier flags. */
export const acceptsTier = true;

/**
 * `arcanum config get <key>`: with no tier, the value resolved local →
 * repo → global (first present, non-`null` value) and its source tier;
 * with a tier flag, only that tier's raw value; with `--all-tiers`,
 * every tier's value, shadowed ones included. Reads take no lock. An
 * unset key exits `1`.
 * @param {object} context - the subcommand context.
 * @param {string[]} context.args - `[key]`.
 * @param {(string|undefined)} context.tier - the tier flag, if any.
 * @param {object} context.values - the parsed flags.
 * @param {object} context.output - the output helpers.
 * @param {object} context.registry - the key registry.
 * @returns {Promise<number>} the exit code.
 */
export async function run(context) {
  const { args: [key], tier, values, output, registry } = context;
  const { targets, tiers } = await readTiers(context, { allTiers: Boolean(values['all-tiers']) });
  const fallback = registryDefault(registry.lookup(key));
  const found = tiers.map(({ tier: name, file, read }) => ({ tier: name, file, ...lookupKey(read.data, key) }));
  const winner = found.find((entry) => entry.set);
  const resolved = winner
    ? { set: true, value: winner.value, source: winner.tier, default: fallback }
    : { set: false, value: null, source: null, default: fallback };

  if (values['all-tiers']) {
    output.result(allTiersText(found, winner), {
      key,
      resolved,
      tiers: Object.fromEntries(found.map((entry) => [entry.tier, { set: entry.set, value: entry.value, file: entry.file }]))
    });
  } else if (tier !== undefined) {
    output.result(winner ? formatValue(winner.value) : '', { key, ...resolved });

    if (!winner && !output.json) {
      context.warn(`${key} is ${unsetText(fallback)} in the ${tier} tier`);
    }
  } else {
    const human = winner
      ? `${formatValue(winner.value)}   (${winner.tier}: ${displayFile(winner.tier, winner.file, targets)})`
      : `(${unsetText(fallback)})`;

    output.result(human, { key, ...resolved });
  }

  return winner ? EXIT_OK : EXIT_ERROR;
}

/**
 * @param {unknown} fallback - the registry default, or `null`.
 * @returns {string} `unset`, or `unset; default: <value>`.
 */
function unsetText(fallback) {
  return fallback === null ? 'unset' : `unset; default: ${formatValue(fallback)}`;
}

/**
 * @param {object[]} found - each tier's lookup, in resolution order.
 * @param {(object|undefined)} winner - the resolving tier, if any.
 * @returns {string} the `--all-tiers` table.
 */
function allTiersText(found, winner) {
  const rows = found.map((entry) => [
    entry.tier,
    entry.set ? formatValue(entry.value) : '-',
    entry.set ? (entry === winner ? '<- resolved' : '') : (entry.file === null ? '(no target)' : '(unset)')
  ]);
  const widths = [0, 1].map((column) => Math.max(...rows.map((row) => row[column].length)));

  return rows.map((row) => `${row[0].padEnd(widths[0])}   ${row[1].padEnd(widths[1])}   ${row[2]}`.trimEnd()).join('\n');
}

export default { name: 'get', options, positionals, acceptsTier, run };
