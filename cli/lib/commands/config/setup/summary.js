// The `config setup` summary (see the Interrupts and errors section of
// docs/agents/specs/arcanum-cli/shortcuts-and-setup.md), printed to
// stderr on every exit path: what was written (old -> new), kept, failed
// (with the reason) and not reached.

import { formatValue } from '../../../output.js';

const STATUS_WIDTH = 'not reached'.length + 2;
const TIER_WIDTH = 'global'.length + 2;
const KEY_GAP = 4;
const WILDCARD = /^<[^>]+>$/;

/**
 * @param {{set: boolean, value: unknown}} previous - a previous state.
 * @returns {string} its summary form.
 */
function oldText(previous) {
  return previous && previous.set ? formatValue(previous.value) : '(unset)';
}

/**
 * @param {unknown} value - a value (`null`: unset).
 * @returns {string} its summary form.
 */
function valueText(value) {
  return value === null || value === undefined ? '(unset)' : formatValue(value);
}

/**
 * @param {object} result - a recorded result.
 * @returns {string} its last column: `old -> new`, the kept value, or
 *   the failure's reason.
 */
function detail(result) {
  if (result.status === 'written') {
    return `${oldText(result.previous)} -> ${valueText(result.value)}`;
  }

  return result.status === 'failed' ? result.reason : valueText(result.value);
}

/**
 * @param {object} item - a wizard item.
 * @param {object[]} results - the recorded results.
 * @returns {boolean} whether the item has any recorded result.
 */
function reached(item, results) {
  if (item.kind === 'agents') {
    const prefix = item.key.split('.').filter((segment) => !WILDCARD.test(segment)).join('.');

    return results.some((result) => result.key.startsWith(`${prefix}.`));
  }

  return results.some((result) => result.key === item.key);
}

/**
 * @param {string} key - a registry key pattern.
 * @returns {string} the pattern with each `<name>` segment as `*`.
 */
function starred(key) {
  return key.split('.').map((segment) => (WILDCARD.test(segment) ? '*' : segment)).join('.');
}

/**
 * The labels of the items not reached; a wildcard entry none of whose
 * items was reached collapses to its starred pattern (`next_step.auto.*`).
 * @param {object[]} items - every wizard item, in order.
 * @param {object[]} results - the recorded results.
 * @param {boolean} interrupted - whether the wizard stopped early.
 * @returns {string[]} the labels, in order.
 */
export function notReached(items, results, interrupted) {
  if (!interrupted) {
    return [];
  }

  const labels = [];

  for (const item of items) {
    if (reached(item, results)) {
      continue;
    }

    const siblings = items.filter((other) => other.entry === item.entry);
    const wildcard = item.kind === 'agents' || item.key !== item.entry.key;
    const label = wildcard && siblings.every((other) => !reached(other, results)) ? starred(item.entry.key) : item.key;

    if (!labels.includes(label)) {
      labels.push(label);
    }
  }

  return labels;
}

/**
 * @param {object[]} results - the recorded results, in order.
 * @param {string[]} pending - the labels not reached.
 * @returns {string} the summary text, newline-terminated.
 */
export function summaryText(results, pending) {
  const width = Math.max(0, ...results.map((result) => result.key.length)) + KEY_GAP;
  const lines = results.map((result) => (
    `  ${result.status.padEnd(STATUS_WIDTH)}${result.key.padEnd(width)}${(result.tier || '-').padEnd(TIER_WIDTH)}${detail(result)}`
  ));

  if (pending.length > 0) {
    lines.push(`  ${'not reached'.padEnd(STATUS_WIDTH)}${pending.join(', ')}`);
  }

  if (lines.length === 0) {
    lines.push('  (nothing asked)');
  }

  return ['', 'summary', ...lines, ''].join('\n');
}

/**
 * Prints the summary once, whatever the exit path.
 * @param {object} session - the wizard's state (`io`, `items`, `results`).
 * @param {boolean} interrupted - whether the wizard stopped early.
 */
export function printSummary(session, interrupted) {
  if (session.summarized) {
    return;
  }

  session.summarized = true;
  session.io.stderr.write(summaryText(session.results, notReached(session.items, session.results, interrupted)));
}
