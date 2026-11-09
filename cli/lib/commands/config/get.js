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
 * every tier's value, shadowed ones included. Tiers the key registry
 * does not allow for the key are skipped when resolving, and marked
 * `ignored: tier not allowed` when shown. Reads take no lock. An
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
  const found = tiers.map(({ tier: name, file, read }) => withAllowed(registry, key, { tier: name, file, ...lookupKey(read.data, key) }));
  const winner = tier === undefined ? found.find((entry) => entry.set && entry.allowed !== false) : found.find((entry) => entry.set);
  const resolved = winner
    ? { set: true, value: winner.value, source: winner.tier, default: fallback }
    : { set: false, value: null, source: null, default: fallback };

  if (values['all-tiers']) {
    output.result(allTiersText(found, winner), {
      key,
      resolved,
      tiers: Object.fromEntries(found.map((entry) => [entry.tier, tierJson(entry)]))
    });
  } else if (tier !== undefined) {
    output.result(winner ? formatValue(winner.value) : '', { key, ...resolved, ...allowedField(found[0]) });

    if (!output.json) {
      warnExplicitTier(context, key, tier, winner, fallback);
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
 * Adds `allowed` to a tier lookup, only when the registry knows whether
 * the key may live in that tier (an unknown key gets no field).
 * @param {object} registry - the key registry.
 * @param {string} key - the dotted key.
 * @param {object} entry - a tier lookup `{ tier, file, set, value }`.
 * @returns {object} the entry, with `allowed` when known.
 */
function withAllowed(registry, key, entry) {
  const allowed = registry.allowsTier(key, entry.tier);

  return typeof allowed === 'boolean' ? { ...entry, allowed } : entry;
}

/**
 * @param {(object|undefined)} entry - a tier lookup.
 * @returns {object} `{ allowed }` when the entry carries it, else `{}`.
 */
function allowedField(entry) {
  return entry !== undefined && 'allowed' in entry ? { allowed: entry.allowed } : {};
}

/**
 * @param {object} entry - a tier lookup.
 * @returns {object} the `--all-tiers` JSON for one tier.
 */
function tierJson(entry) {
  return { set: entry.set, value: entry.value, file: entry.file, ...allowedField(entry) };
}

/**
 * Warns, in human mode, about an explicitly read tier that is unset, or
 * set in a tier arcanum does not read the key from.
 * @param {object} context - the subcommand context.
 * @param {string} key - the dotted key.
 * @param {string} tier - the tier flag.
 * @param {(object|undefined)} winner - the tier's lookup, when set.
 * @param {unknown} fallback - the registry default, or `null`.
 */
function warnExplicitTier(context, key, tier, winner, fallback) {
  if (!winner) {
    context.warn(`${key} is ${unsetText(fallback)} in the ${tier} tier`);
  } else if (winner.allowed === false) {
    context.warn(`${key} is set in the ${tier} tier, but arcanum does not read it from there`);
  }
}

/**
 * @param {object} entry - a tier lookup.
 * @param {(object|undefined)} winner - the resolving tier, if any.
 * @returns {string} the `--all-tiers` status column.
 */
function statusText(entry, winner) {
  if (!entry.set) {
    return entry.file === null ? '(no target)' : '(unset)';
  }
  if (entry.allowed === false) {
    return '(ignored: tier not allowed)';
  }

  return entry === winner ? '<- resolved' : '';
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
    statusText(entry, winner)
  ]);
  const widths = [0, 1].map((column) => Math.max(...rows.map((row) => row[column].length)));

  return rows.map((row) => `${row[0].padEnd(widths[0])}   ${row[1].padEnd(widths[1])}   ${row[2]}`.trimEnd()).join('\n');
}

export default { name: 'get', options, positionals, acceptsTier, run };
