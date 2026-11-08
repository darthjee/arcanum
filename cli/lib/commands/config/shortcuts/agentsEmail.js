// `arcanum config agents email` (see
// docs/agents/architecture/arcanum-cli.md#agents-email): the listing of
// every agent's effective commit email, the per-tier matrix of every
// agent (`--all-tiers`, in agentsEmailMatrix.js), the detail of one
// agent, the `set`/`unset` writes of `git.email` and
// `git.agents.<agent>`, and the interactive `edit` loop (in
// agentsEmailEdit.js). Resolution goes only through the shared
// `AgentEmail#resolve` (built on `ConfigChain#readWithSource`), so the
// CLI shows exactly what `arcanum/_lib/agent_email.sh` commits with.

import { checkKey } from '../../../args.js';
import { EXIT_ERROR, EXIT_OK, UsageError } from '../../../exitCodes.js';
import { lookupKey } from '../../../tierFiles.js';
import {
  AGENT_PATTERN, DEFAULT_TIER, EMAIL_KEY, NAME, STRING_VALUE, agentKey, genericFields, readAgents, readEmailTiers, resolvedFields,
  shownValue
} from './agentsEmailRead.js';
import { editEmails } from './agentsEmailEdit.js';
import { showMatrix } from './agentsEmailMatrix.js';
import { checkMaxArity, checkShortcutFlags, delegate, writeValue } from './common.js';

export {
  AGENTS_DIR, AGENTS_PATTERN, AGENT_PATTERN, DEFAULT_TIER, EMAIL_KEY, NAME, agentKey, repoAgents
} from './agentsEmailRead.js';

/**
 * Runs `agents email`: `set`, `unset` and `edit` are verbs in the first
 * position; anything else is the listing (no argument, or the matrix
 * with `--all-tiers`) or the detail of one agent.
 * @param {object} context - the `config` context.
 * @param {string[]} args - the positionals after `agents email`.
 * @returns {Promise<number>} the exit code.
 * @throws {UsageError} on bad arity or a flag the form does not accept.
 */
export function runAgentsEmail(context, args) {
  const [verb, ...rest] = args;

  if (verb === 'set') {
    return setEmail(context, rest);
  }

  if (verb === 'unset') {
    return unsetEmail(context, rest);
  }

  if (verb === 'edit') {
    return editEmails(context, rest);
  }

  checkReadFlags(context.values, { listing: verb === undefined });
  checkMaxArity(NAME, args, 1);

  if (verb !== undefined) {
    return showAgent(context, checkAgent(verb));
  }

  return context.values['all-tiers'] ? showMatrix(context) : listEmails(context);
}

/**
 * `agents email set <pattern>` (`git.email`) or `set <agent> <email>`
 * (`git.agents.<agent>`), told apart by arity; default tier global.
 * @param {object} context - the `config` context.
 * @param {string[]} args - the positionals after `set`.
 * @returns {Promise<number>} the exit code.
 * @throws {UsageError} on bad arity or flags.
 */
function setEmail(context, args) {
  if (args.length === 0 || args.length > 2) {
    throw new UsageError(args.length === 0
      ? `${NAME} set needs <pattern>, or <agent> <email>`
      : `${NAME} set: unexpected argument '${args[2]}'`);
  }

  const tier = checkWriteFlags(context.values, 'set');
  const [key, raw] = args.length === 1 ? [EMAIL_KEY, args[0]] : [checkKey(agentKey(args[0])), args[1]];

  return writeValue(context, { key, raw, tier: tier || DEFAULT_TIER, parseValue: STRING_VALUE });
}

/**
 * `agents email unset` (`git.email`) or `unset <agent>`
 * (`git.agents.<agent>`); default tier global.
 * @param {object} context - the `config` context.
 * @param {string[]} args - the positionals after `unset`.
 * @returns {Promise<number>} the exit code.
 * @throws {UsageError} on bad arity or flags.
 */
function unsetEmail(context, args) {
  checkMaxArity(`${NAME} unset`, args, 1);

  const tier = checkWriteFlags(context.values, 'unset');
  const key = args.length === 0 ? EMAIL_KEY : checkKey(agentKey(args[0]));

  return delegate(context, 'unset', [key], tier || DEFAULT_TIER);
}

/**
 * @param {object} values - the parsed flags.
 * @param {string} verb - `set` or `unset`.
 * @returns {(string|undefined)} the tier flag, if any.
 * @throws {UsageError} on `--unset` or a flag writes refuse.
 */
function checkWriteFlags(values, verb) {
  if (values.unset) {
    throw new UsageError(`--unset is not accepted by ${NAME} ${verb}; use ${NAME} unset [<agent>]`);
  }

  return checkShortcutFlags(`${NAME} ${verb}`, values, { write: true });
}

/**
 * The listing and the detail show every tier: they take no tier flag
 * and no `--unset`; only the listing takes `--all-tiers` (the matrix).
 * @param {object} values - the parsed flags.
 * @param {object} form - the read form.
 * @param {boolean} form.listing - whether it is the listing.
 * @throws {UsageError} on any of those flags.
 */
function checkReadFlags(values, { listing }) {
  if (values.unset) {
    throw new UsageError(`--unset is not accepted by ${NAME}; use ${NAME} unset [<agent>]`);
  }

  const tier = checkShortcutFlags(NAME, values, { write: false });
  const flag = tier === undefined ? (values['all-tiers'] && !listing ? 'all-tiers' : undefined) : tier;

  if (flag !== undefined) {
    throw new UsageError(`--${flag} is not accepted by ${NAME}: it always shows every tier`);
  }
}

/**
 * @param {string} agent - an agent name, as typed.
 * @returns {string} the name.
 * @throws {UsageError} when it is not a well-formed agent name.
 */
function checkAgent(agent) {
  if (!AGENT_PATTERN.test(agent)) {
    throw new UsageError(`invalid agent name '${agent}': use letters, digits, _ and -`);
  }

  return agent;
}

/**
 * The listing: the resolved raw `git.email` and every agent's effective
 * email. Always exits `0`.
 * @param {object} context - the `config` context.
 * @returns {Promise<number>} the exit code.
 */
async function listEmails(context) {
  const { agentEmail, configChain, repoPath, inRepo, agents: names } = await readAgents(context);
  const fallback = genericFields(await configChain.readWithSource(repoPath, 'git', 'email'));
  const agents = [];

  for (const agent of names) {
    agents.push({
      agent,
      ...resolvedFields(await agentEmail.resolve(repoPath, agent)),
      in_repo: inRepo === null ? null : inRepo.has(agent)
    });
  }

  context.output.result(listText(fallback, agents), { default: fallback, agents });

  return EXIT_OK;
}

/**
 * @param {object} fallback - the listing's `default` block.
 * @param {object[]} agents - its rows.
 * @returns {string} the human listing.
 */
function listText(fallback, agents) {
  const lines = [fallback.set
    ? `default  ${shownValue(fallback.value)}   (${fallback.source}: ${EMAIL_KEY})`
    : 'default  (unset)'];

  if (agents.length === 0) {
    return lines[0];
  }

  const rows = [['agent', 'effective email', 'from', ''], ...agents.map((row) => [
    row.agent,
    row.email === null ? '(model default)' : row.email,
    fromText(row),
    row.in_repo === false ? '(not in this repo)' : ''
  ])];
  const widths = [0, 1, 2].map((column) => Math.max(...rows.map((row) => row[column].length)));

  lines.push('', ...rows.map((row) => (
    `${row[0].padEnd(widths[0])}  ${row[1].padEnd(widths[1])}  ${row[2].padEnd(widths[2])}   ${row[3]}`.trimEnd()
  )));

  return lines.join('\n');
}

/**
 * @param {object} row - a listing row.
 * @returns {string} where its email comes from.
 */
function fromText(row) {
  if (row.source === null) {
    return '';
  }

  return row.email === null ? `(empty at ${row.source}: ${row.key})` : `${row.source.padEnd(6)} ${row.key}`;
}

/**
 * The detail of one agent: both keys in every tier, with the resolved
 * one and the shadowed ones marked. Exits `1` when the model default
 * would apply.
 * @param {object} context - the `config` context.
 * @param {string} agent - the agent.
 * @returns {Promise<number>} the exit code.
 */
async function showAgent(context, agent) {
  const { tiers, agentEmail, repoPath } = await readEmailTiers(context);
  const resolution = await agentEmail.resolve(repoPath, agent);
  const resolved = resolvedFields(resolution);
  const keys = { agents: agentKey(agent), email: EMAIL_KEY };
  const breakdown = tiers.map(({ tier, file, read }) => ({
    tier,
    file,
    agents: lookupKey(read.data, keys.agents),
    email: lookupKey(read.data, keys.email)
  }));
  const data = {
    agent,
    resolved,
    tiers: Object.fromEntries(breakdown.map(({ tier, file, agents, email }) => [tier, { agents, email, file }]))
  };

  context.output.result(detailText(breakdown, keys, resolved), data);

  return resolved.email === null ? EXIT_ERROR : EXIT_OK;
}

/**
 * @param {object[]} breakdown - each tier's two lookups, in order.
 * @param {{agents: string, email: string}} keys - the two keys.
 * @param {object} resolved - the resolved fields.
 * @returns {string} the human detail table.
 */
function detailText(breakdown, keys, resolved) {
  const rows = breakdown.flatMap(({ tier, file, agents, email }) => [['agents', agents], ['email', email]]
    .map(([field, found], index) => {
      const winner = resolved.source === tier && resolved.key === keys[field];
      let mark = '';

      if (winner) {
        mark = resolved.email === null ? '<- resolved (empty: model default)' : '<- resolved';
      } else if (found.set) {
        mark = '(shadowed)';
      } else if (file === null && index === 0) {
        mark = '(no target)';
      }

      return [index === 0 ? tier : '', keys[field], found.set ? shownValue(found.value) : '-', mark];
    }));
  const widths = [0, 1, 2].map((column) => Math.max(...rows.map((row) => row[column].length)));

  return rows.map((row) => (
    `${row[0].padEnd(widths[0])}  ${row[1].padEnd(widths[1])}  ${row[2].padEnd(widths[2])}   ${row[3]}`.trimEnd()
  )).join('\n');
}
