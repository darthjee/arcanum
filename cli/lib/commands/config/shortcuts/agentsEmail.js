// `arcanum config agents email` (see the `agents email` section of
// docs/agents/specs/arcanum-cli/shortcuts-and-setup.md): the listing of
// every agent's effective commit email, the per-tier detail of one
// agent, and the `set`/`unset` writes of `git.email` and
// `git.agents.<agent>`. Resolution goes only through the shared
// `AgentEmail#resolve` (built on `ConfigChain#readWithSource`), so the
// CLI shows exactly what `arcanum/_lib/agent_email.sh` commits with.

import { readdir } from 'node:fs/promises';
import path from 'node:path';
import AgentEmail from '../../../../../shared/lib/config/AgentEmail.js';
import ConfigChain from '../../../../../shared/lib/config/ConfigChain.js';
import { checkKey } from '../../../args.js';
import { EXIT_ERROR, EXIT_OK, UsageError } from '../../../exitCodes.js';
import { formatValue } from '../../../output.js';
import { lookupKey } from '../../../tierFiles.js';
import { readTiers } from '../shared.js';
import { checkMaxArity, checkShortcutFlags, delegate, memoizeTargets, writeValue } from './common.js';

/** The shortcut's name, as typed. */
export const NAME = 'agents email';

/** The default write tier of `set` and `unset`. */
export const DEFAULT_TIER = 'global';

/** The generic email key. */
export const EMAIL_KEY = 'git.email';

/** A well-formed agent name: one registry wildcard segment. */
export const AGENT_PATTERN = /^[A-Za-z0-9_-]+$/;

/** The repo's agents folder, relative to its root. */
export const AGENTS_DIR = path.join('.claude', 'agents');

const STRING_VALUE = (raw) => ({ value: raw, jsonError: null, precisionLoss: false });

/**
 * A `ConfigChain` with no repo tiers, for a target that is not a repo:
 * only the global tier is read, as everywhere else in the CLI.
 */
class GlobalOnlyConfigChain extends ConfigChain {
  /**
   * @returns {Array<(string|null)>} no local and repo files, then the
   *   global file.
   */
  _tierFiles() {
    return [null, null, this._globalConfigFile()];
  }
}

/**
 * @param {string} agent - an agent name.
 * @returns {string} its key, `git.agents.<agent>`.
 */
export function agentKey(agent) {
  return `git.agents.${agent}`;
}

/**
 * Runs `agents email`: `set` and `unset` are verbs in the first
 * position; anything else is the listing (no argument) or the detail of
 * one agent.
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

  checkReadFlags(context.values);
  checkMaxArity(NAME, args, 1);

  return verb === undefined ? listEmails(context) : showAgent(context, checkAgent(verb));
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
 * The listing and the detail show every tier: they take no tier flag,
 * no `--all-tiers` and no `--unset`.
 * @param {object} values - the parsed flags.
 * @throws {UsageError} on any of those flags.
 */
function checkReadFlags(values) {
  if (values.unset) {
    throw new UsageError(`--unset is not accepted by ${NAME}; use ${NAME} unset [<agent>]`);
  }

  const tier = checkShortcutFlags(NAME, values, { write: false });
  const flag = tier === undefined ? (values['all-tiers'] ? 'all-tiers' : undefined) : tier;

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
 * Reads what the listing and the detail need: the tiers (with the
 * generic read warnings), and an `AgentEmail` reading the same targets.
 * @param {object} context - the `config` context.
 * @returns {Promise<{targets: object, tiers: object[], agentEmail: AgentEmail, configChain: ConfigChain, repoPath: string}>}
 *   the targets, the tiers (each with its `file`, `null` when it has no
 *   target), the resolver, its chain and the repo path to resolve against.
 */
async function readEmailTiers(context) {
  const resolveTargets = memoizeTargets(context.resolveTargets);
  const { targets, tiers } = await readTiers({ ...context, resolveTargets, tier: undefined }, { allTiers: true });
  const env = targets.account.dir === null ? {} : { CLAUDE_CONFIG_DIR: targets.account.dir };
  const configChain = targets.repo.root === null ? new GlobalOnlyConfigChain({ env }) : new ConfigChain({ env });

  return {
    targets,
    tiers,
    agentEmail: new AgentEmail({ configChain }),
    configChain,
    repoPath: targets.repo.root === null ? targets.repo.path : targets.repo.root
  };
}

/**
 * @param {string} root - the repo root.
 * @returns {Promise<Set<string>>} the basenames of its
 *   `.claude/agents/*.md` files (anything else is ignored).
 */
export async function repoAgents(root) {
  let entries;

  try {
    entries = await readdir(path.join(root, AGENTS_DIR), { withFileTypes: true });
  } catch {
    return new Set();
  }

  return new Set(entries
    .filter((entry) => !entry.isDirectory() && entry.name.endsWith('.md'))
    .map((entry) => entry.name.slice(0, -'.md'.length))
    .filter((name) => AGENT_PATTERN.test(name)));
}

/**
 * @param {object[]} tiers - the tiers read.
 * @returns {Set<string>} every agent with a non-null `git.agents.<agent>`
 *   in any tier.
 */
function configuredAgents(tiers) {
  const agents = new Set();

  for (const { read } of tiers) {
    const section = lookupKey(read.data, 'git.agents');

    if (section.set && typeof section.value === 'object' && !Array.isArray(section.value)) {
      for (const [agent, value] of Object.entries(section.value)) {
        if (value !== null && AGENT_PATTERN.test(agent)) {
          agents.add(agent);
        }
      }
    }
  }

  return agents;
}

/**
 * @param {(object|undefined)} resolution - an `AgentEmail#resolve` result.
 * @returns {{email: (string|null), source: (string|null), key: (string|null)}}
 *   the effective email and where it came from; an explicit `""` keeps
 *   its source and key with a `null` email.
 */
function resolvedFields(resolution) {
  if (resolution === undefined) {
    return { email: null, source: null, key: null };
  }

  return { email: resolution.email === undefined ? null : resolution.email, source: resolution.tier, key: resolution.key };
}

/**
 * The listing: the resolved raw `git.email` and every agent's effective
 * email. Always exits `0`.
 * @param {object} context - the `config` context.
 * @returns {Promise<number>} the exit code.
 */
async function listEmails(context) {
  const { targets, tiers, agentEmail, configChain, repoPath } = await readEmailTiers(context);
  const inRepo = targets.repo.root === null ? null : await repoAgents(targets.repo.root);
  const names = new Set([...configuredAgents(tiers), ...(inRepo || [])]);
  const sorted = [...names].sort((a, b) => (a < b ? -1 : Number(a > b)));
  const generic = await configChain.readWithSource(repoPath, 'git', 'email');
  const fallback = generic === undefined
    ? { set: false, value: null, source: null }
    : { set: true, value: generic.value, source: generic.tier };
  const agents = [];

  for (const agent of sorted) {
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
 * @param {unknown} value - a stored value.
 * @returns {string} its human form (`""` for an empty string).
 */
function shownValue(value) {
  return value === '' ? '""' : formatValue(value);
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
