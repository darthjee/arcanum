import { EXIT_FILE, EXIT_OK, EXIT_VALIDATION } from '../../exitCodes.js';
import { isMalformed } from '../../tierFiles.js';
import { flatten } from './list.js';
import { displayFile, readTiers } from './shared.js';

/** `config doctor`'s own flags, beyond the global ones. */
export const options = {};

/** `config doctor`'s positionals, in order. */
export const positionals = [];

/** Whether `config doctor` accepts the tier flags. */
export const acceptsTier = false;

/**
 * `arcanum config doctor`: reads every tier like `config list` and reports
 * only the problems: unknown keys, values in a tier their key does not
 * allow, and values the registry rejects. Never writes and takes no lock.
 * Exits 7 when a scanned tier is malformed, else 3 when there is a
 * problem, else 0.
 * @param {object} context - the subcommand context.
 * @param {object} context.output - the output helpers.
 * @param {object} context.registry - the key registry.
 * @returns {Promise<number>} the exit code.
 */
export async function run(context) {
  const { output, registry } = context;
  const { targets, tiers } = await readTiers(context, { allTiers: true });
  const problems = [];
  const skipped = [];
  const malformed = [];

  for (const { tier, file, read } of tiers) {
    if (file === null) {
      skipped.push({ tier, reason: 'no target for this tier' });
    } else if (read.state === 'missing') {
      skipped.push({ tier, reason: 'file does not exist' });
    } else if (isMalformed(read.state)) {
      malformed.push({ tier, file, error: read.error });
    } else {
      problems.push(...tierProblems(tier, file, read.data, registry));
    }
  }

  const data = { problems, skipped, malformed };

  output.result(humanReport(data, tiers, targets), data);

  if (malformed.length > 0) {
    return EXIT_FILE;
  }

  return problems.length > 0 ? EXIT_VALIDATION : EXIT_OK;
}

/**
 * @param {string} tier - the tier scanned.
 * @param {string} file - its file.
 * @param {object} content - its parsed content.
 * @param {object} registry - the key registry.
 * @returns {object[]} the problems found in it.
 */
function tierProblems(tier, file, content, registry) {
  const found = [];

  for (const [key, value] of flatten(content)) {
    if (value === null || (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0)) {
      continue;
    }

    const problem = classify(key, value, tier, registry);

    if (problem !== null) {
      found.push({ tier, file, key, value, ...problem });
    }
  }

  return found;
}

/**
 * @param {string} key - the dotted key.
 * @param {unknown} value - its value.
 * @param {string} tier - the tier it is in.
 * @param {object} registry - the key registry.
 * @returns {(object|null)} `{ kind, ..., hint }`, or `null` when fine.
 */
function classify(key, value, tier, registry) {
  const entry = registry.lookup(key);

  if (entry === null) {
    return { kind: 'unknown', hint: `arcanum config unset ${key} --${tier}` };
  }

  if (!entry.tiers.includes(tier)) {
    const target = registry.defaultTier(key);

    return {
      kind: 'tier',
      allowed_tiers: [...entry.tiers],
      hint: `arcanum config set ${key} ${JSON.stringify(value)} --${target}, then arcanum config unset ${key} --${tier}`
    };
  }

  if (entry.read_only === true) {
    return null;
  }

  const result = registry.check('set', key, tier, value);

  if (result.ok) {
    return null;
  }

  const details = { ...result };

  delete details.ok;
  delete details.key;

  return {
    kind: 'invalid',
    ...details,
    hint: `arcanum config set ${key} <valid value> --${tier}, or arcanum config unset ${key} --${tier}`
  };
}

/**
 * @param {{problems: object[], skipped: object[], malformed: object[]}} data - the report.
 * @param {object[]} tiers - the tiers read, in resolution order.
 * @param {object} targets - the resolved targets.
 * @returns {string} the human report.
 */
function humanReport({ problems, skipped, malformed }, tiers, targets) {
  const lines = [];

  for (const { tier, file } of tiers) {
    const own = problems.filter((problem) => problem.tier === tier);

    if (own.length === 0) {
      continue;
    }

    lines.push(`${tier} (${displayFile(tier, file, targets)}):`);

    for (const problem of own) {
      lines.push(`  ${problem.key} = ${JSON.stringify(problem.value)}   ${problemText(problem)}`);
      lines.push(`    hint: ${problem.hint}`);
    }
  }

  if (problems.length === 0 && malformed.length === 0) {
    lines.push('no problems found');
  }

  for (const { tier, file, error } of malformed) {
    lines.push(`${tier} (${displayFile(tier, file, targets)}): malformed, not scanned${error ? ` (${error})` : ''}`);
  }

  for (const { tier, reason } of skipped) {
    lines.push(`${tier}: skipped (${reason})`);
  }

  return lines.join('\n');
}

/**
 * @param {object} problem - a problem.
 * @returns {string} its one-line description.
 */
function problemText(problem) {
  if (problem.kind === 'unknown') {
    return 'unknown key';
  }

  if (problem.kind === 'tier') {
    return `ignored: tier not allowed (allowed: ${problem.allowed_tiers.join(', ')})`;
  }

  return `invalid: ${problem.reason}`;
}

export default { name: 'doctor', options, positionals, acceptsTier, run };
