import { lockTimeoutMs, requireTier } from '../../args.js';
import { EXIT_OK } from '../../exitCodes.js';
import { formatValue } from '../../output.js';
import { lookupKey } from '../../tierFiles.js';
import { parseValue } from '../../values.js';
import { prepareWrite, validateSet, wasText, writeKey } from '../../writeTier.js';
import { displayFile } from './shared.js';

/** `config set`'s own flags, beyond the global ones. */
export const options = { string: { type: 'boolean' }, force: { type: 'boolean' }, 'lock-timeout': { type: 'string' } };

/** `config set`'s positionals, in order. */
export const positionals = ['key', 'value'];

/** Whether `config set` accepts the tier flags. */
export const acceptsTier = true;

/**
 * `arcanum config set <key> <value> <tier>`: writes one key to one tier
 * through the shared writer and its lock, after the target, file,
 * registry and skew checks. Nested keys keep their siblings.
 * @param {object} context - the subcommand context.
 * @param {string[]} context.args - `[key, value]`.
 * @param {(string|undefined)} context.tier - the tier flag.
 * @param {object} context.values - the parsed flags.
 * @param {object} context.output - the output helpers.
 * @param {object} context.registry - the key registry.
 * @param {object} context.deps - injectable collaborators.
 * @param {(raw: string) => object} [context.parseValue] - a value parser
 *   replacing `parseValue` (the shortcuts' boolean tokens and plain
 *   strings); one that throws defers its refusal to the registry check,
 *   so the target and file refusals still win.
 * @returns {Promise<number>} the exit code.
 */
export async function run(context) {
  const { args: [key, raw], values, output, registry, deps } = context;
  const tier = requireTier('set', context.tier);
  const timeoutMs = lockTimeoutMs(values['lock-timeout']);
  const force = Boolean(values.force);
  const string = Boolean(values.string);
  const { parsed, parseError } = parseRaw(context.parseValue || ((text) => parseValue(text, { string })), raw);
  const { targets, file, read, known, forced } = await prepareWrite(context, force, () => {
    if (parseError !== null) {
      throw parseError;
    }

    return validateSet({ registry, key, tier, parsed, raw, force, string });
  });
  const previous = lookupKey(read.data, key);
  const { value } = parsed;

  await writeKey({
    op: 'set', file, key, value, known, timeoutMs, timeoutLabel: values['lock-timeout'] || '10', deps
  });

  output.result(
    `set ${key} = ${formatValue(value)}   (${tier}: ${displayFile(tier, file, targets)}, was: ${wasText(previous)})`,
    {
      key,
      tier,
      file,
      changed: !previous.set || JSON.stringify(previous.value) !== JSON.stringify(value),
      previous,
      value,
      forced
    }
  );

  return EXIT_OK;
}

/**
 * @param {(raw: string) => object} parse - the value parser.
 * @param {string} raw - the value as typed.
 * @returns {{parsed: (object|null), parseError: (unknown|null)}} the
 *   parsed value, or what the parser threw.
 */
function parseRaw(parse, raw) {
  try {
    return { parsed: parse(raw), parseError: null };
  } catch (error) {
    return { parsed: null, parseError: error };
  }
}

export default { name: 'set', options, positionals, acceptsTier, run };
