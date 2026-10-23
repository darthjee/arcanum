import { EXIT_OK } from '../../exitCodes.js';
import { readTiers } from './shared.js';

/** `config list`'s own flags, beyond the global ones. */
export const options = {};

/** `config list`'s positionals, in order. */
export const positionals = [];

/** Whether `config list` accepts the tier flags. */
export const acceptsTier = true;

/**
 * `arcanum config list [tier]`: every key set in every tier (or only the
 * given one), flattened to dotted keys, one entry per key per tier, with
 * the registry description of known keys. Reads take no lock.
 * @param {object} context - the subcommand context.
 * @param {(string|undefined)} context.tier - the tier flag, if any.
 * @param {object} context.output - the output helpers.
 * @param {object} context.registry - the key registry.
 * @returns {Promise<number>} the exit code.
 */
export async function run(context) {
  const { tier, output, registry } = context;
  const { tiers } = await readTiers(context);
  const entries = tiers.flatMap(({ tier: name, read }) => flatten(read.data).map(([key, value]) => {
    const entry = registry.lookup(key);

    return { key, tier: name, value, known: entry !== null, description: entry ? entry.description : null };
  }));

  output.result(entries.map((entry) => entryText(entry, tier === undefined)).join('\n'), { entries });

  return EXIT_OK;
}

/**
 * Flattens a tier's content into dotted leaf keys. Non-empty objects are
 * walked; anything else (scalars, arrays, `null`, empty objects) is a leaf.
 * @param {object} data - the tier's parsed content.
 * @param {string} [prefix] - the dotted path walked so far.
 * @returns {Array<[string, unknown]>} `[key, value]` pairs, in file order.
 */
export function flatten(data, prefix = '') {
  return Object.entries(data).flatMap(([segment, value]) => {
    const key = prefix === '' ? segment : `${prefix}.${segment}`;

    if (value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0) {
      return flatten(value, key);
    }

    return [[key, value]];
  });
}

/**
 * @param {object} entry - a list entry.
 * @param {boolean} withTier - prefix the tier (no tier flag given).
 * @returns {string} the human line, e.g. `engine.mode = "native"   <description>`.
 */
function entryText(entry, withTier) {
  const line = `${withTier ? `${entry.tier.padEnd(6)}  ` : ''}${entry.key} = ${JSON.stringify(entry.value)}`;

  return entry.description === null ? line : `${line}   ${entry.description}`;
}

export default { name: 'list', options, positionals, acceptsTier, run };
