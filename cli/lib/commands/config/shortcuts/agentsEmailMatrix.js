// The per-tier matrix of `arcanum config agents email --all-tiers` (see
// docs/agents/architecture/arcanum-cli.md#agents-email): one `(default)`
// row for `git.email` and one row per agent, one column per tier, with
// the resolved value, the shadowed ones and the model-default fallback
// marked. Shared by `--all-tiers` and the `edit` loop.

import { EXIT_OK } from '../../../exitCodes.js';
import { lookupKey } from '../../../tierFiles.js';
import { EMAIL_KEY, agentKey, genericFields, readAgents, resolvedFields, shownValue } from './agentsEmailRead.js';

/** The `(default)` row's label, for `git.email`. */
export const DEFAULT_ROW = '(default)';

/**
 * Builds the matrix from what `readAgents` read.
 * @param {object} read - the `readAgents` result.
 * @returns {Promise<object>} the matrix, in its JSON shape: `files`
 *   (each tier's file, `null` with no target), `default` (`git.email`
 *   per tier and resolved) and `agents` (each agent's
 *   `git.agents.<agent>` per tier, its resolution and `in_repo`).
 */
export async function buildMatrix(read) {
  const { tiers, agentEmail, configChain, repoPath, inRepo, agents } = read;
  const perTier = (key) => Object.fromEntries(tiers.map(({ tier, read: found }) => [tier, lookupKey(found.data, key)]));
  const rows = [];

  for (const agent of agents) {
    rows.push({
      agent,
      in_repo: inRepo === null ? null : inRepo.has(agent),
      tiers: perTier(agentKey(agent)),
      resolved: resolvedFields(await agentEmail.resolve(repoPath, agent))
    });
  }

  return {
    files: Object.fromEntries(tiers.map(({ tier, file }) => [tier, file])),
    default: {
      tiers: perTier(EMAIL_KEY),
      resolved: genericFields(await configChain.readWithSource(repoPath, 'git', 'email'))
    },
    agents: rows
  };
}

/**
 * Reads and builds the matrix.
 * @param {object} context - the `config` context.
 * @returns {Promise<object>} the matrix (see `buildMatrix`).
 */
export async function readMatrix(context) {
  return buildMatrix(await readAgents(context));
}

/**
 * `agents email --all-tiers`: prints the matrix. Always exits `0`.
 * @param {object} context - the `config` context.
 * @returns {Promise<number>} the exit code.
 */
export async function showMatrix(context) {
  const matrix = await readMatrix(context);

  context.output.result(matrixText(matrix), matrix);

  return EXIT_OK;
}

/**
 * @param {object} matrix - the matrix.
 * @returns {string} its human table: one column per tier, then the
 *   row's marks.
 */
export function matrixText(matrix) {
  const tierNames = Object.keys(matrix.files);
  const cells = (tiers) => tierNames.map((tier) => {
    if (matrix.files[tier] === null) {
      return '(no target)';
    }

    return tiers[tier].set ? shownValue(tiers[tier].value) : '-';
  });
  const rows = [
    ['agent', ...tierNames, ''],
    [DEFAULT_ROW, ...cells(matrix.default.tiers), defaultMarks(matrix.default)],
    ...matrix.agents.map((row) => [row.agent, ...cells(row.tiers), agentMarks(row)])
  ];
  const last = tierNames.length + 1;
  const widths = rows[0].slice(0, last).map((_, column) => Math.max(...rows.map((row) => row[column].length)));

  return rows.map((row) => (
    `${row.slice(0, last).map((cell, column) => cell.padEnd(widths[column])).join('  ')}   ${row[last]}`.trimEnd()
  )).join('\n');
}

/**
 * @param {object} tiers - a row's per-tier lookups.
 * @param {(string|null)} winner - the tier whose cell resolves, if any.
 * @returns {string} the `(shadowed: …)` mark for the set cells that
 *   lose, or `''`.
 */
function shadowedMark(tiers, winner) {
  const shadowed = Object.keys(tiers).filter((tier) => tiers[tier].set && tier !== winner);

  return shadowed.length === 0 ? '' : `(shadowed: ${shadowed.join(', ')})`;
}

/**
 * @param {object} row - the matrix's `default` block.
 * @returns {string} where `git.email` resolves, and what it shadows.
 */
function defaultMarks(row) {
  const { tiers, resolved } = row;
  let mark = '(unset)';

  if (resolved.set) {
    mark = resolved.value === '' ? `<- ${resolved.source} (empty: model default)` : `<- ${resolved.source}`;
  }

  return joinMarks(mark, shadowedMark(tiers, resolved.source));
}

/**
 * @param {object} row - a matrix agent row.
 * @returns {string} the row's marks: not in this repo, where its email
 *   resolves (its own key, the `git.email` default or the model
 *   default), and its shadowed cells.
 */
function agentMarks(row) {
  const { resolved } = row;
  const own = resolved.key === agentKey(row.agent);
  let mark;

  if (resolved.source === null) {
    mark = '(model default)';
  } else if (resolved.email === null) {
    mark = `<- ${resolved.source} (${own ? 'empty' : 'empty default'}: model default)`;
  } else {
    mark = own ? `<- ${resolved.source}` : `<- ${resolved.source} (default: ${resolved.email})`;
  }

  return joinMarks(
    row.in_repo === false ? '(not in this repo)' : '',
    mark,
    shadowedMark(row.tiers, own ? resolved.source : null)
  );
}

/**
 * @param {...string} marks - marks, possibly empty.
 * @returns {string} the non-empty ones, space-separated.
 */
function joinMarks(...marks) {
  return marks.filter((mark) => mark !== '').join(' ');
}
