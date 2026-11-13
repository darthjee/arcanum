// What every form of `arcanum config agents email` reads (see
// docs/agents/architecture/arcanum-cli.md#agents-email): the keys, the
// tiers (with the generic read warnings), the repo's agents and the
// configured ones, and an `AgentEmail` resolving against the same
// targets. Resolution goes only through the shared `AgentEmail#resolve`
// (built on `ConfigChain#readWithSource`), so the CLI shows exactly what
// `arcanum/_lib/agent_email.sh` commits with.

import { readdir } from 'node:fs/promises';
import path from 'node:path';
import AgentEmail from '../../../../../shared/lib/config/AgentEmail.js';
import ConfigChain from '../../../../../shared/lib/config/ConfigChain.js';
import { formatValue } from '../../../output.js';
import { lookupKey } from '../../../tierFiles.js';
import { readTiers } from '../shared.js';
import { memoizeTargets } from './common.js';

/** The shortcut's name, as typed. */
export const NAME = 'agents email';

/** The generic email key. */
export const EMAIL_KEY = 'git.email';

/** The per-agent email key, as the registry names it. */
export const AGENTS_PATTERN = 'git.agents.<agent>';

/** A well-formed agent name: one registry wildcard segment. */
export const AGENT_PATTERN = /^[A-Za-z0-9_-]+$/;

/** The repo's agents folder, relative to its root. */
export const AGENTS_DIR = path.join('.claude', 'agents');

/**
 * The value parser of every email write: the email is stored as typed,
 * as a plain string (never parsed as JSON, never validated).
 * @param {string} raw - the value as typed.
 * @returns {{value: string, jsonError: null, precisionLoss: boolean}} the parsed value.
 */
export function STRING_VALUE(raw) {
  return { value: raw, jsonError: null, precisionLoss: false };
}

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
 * Reads what every read form needs: the tiers (with the generic read
 * warnings), and an `AgentEmail` reading the same targets.
 * @param {object} context - the `config` context.
 * @returns {Promise<{targets: object, tiers: object[], agentEmail: AgentEmail, configChain: ConfigChain, repoPath: string}>}
 *   the targets, the tiers (each with its `file`, `null` when it has no
 *   target), the resolver, its chain and the repo path to resolve against.
 */
export async function readEmailTiers(context) {
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
 * Reads the tiers and the agents to show: the repo's agents plus every
 * configured one, sorted.
 * @param {object} context - the `config` context.
 * @returns {Promise<object>} what `readEmailTiers` returns, plus
 *   `inRepo` (the repo's agents, `null` outside a repo) and `agents`
 *   (the sorted names).
 */
export async function readAgents(context) {
  const read = await readEmailTiers(context);
  const inRepo = read.targets.repo.root === null ? null : await repoAgents(read.targets.repo.root);
  const names = new Set([...configuredAgents(read.tiers), ...(inRepo || [])]);
  const agents = [...names].sort((a, b) => (a < b ? -1 : Number(a > b)));

  return { ...read, inRepo, agents };
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
export function configuredAgents(tiers) {
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
export function resolvedFields(resolution) {
  if (resolution === undefined) {
    return { email: null, source: null, key: null };
  }

  return { email: resolution.email === undefined ? null : resolution.email, source: resolution.tier, key: resolution.key };
}

/**
 * @param {(object|undefined)} generic - a `readWithSource` result for
 *   `git.email`.
 * @returns {{set: boolean, value: unknown, source: (string|null)}} the
 *   resolved raw `git.email`, as the listing's `default` block.
 */
export function genericFields(generic) {
  return generic === undefined
    ? { set: false, value: null, source: null }
    : { set: true, value: generic.value, source: generic.tier };
}

/**
 * @param {unknown} value - a stored value.
 * @returns {string} its human form (`""` for an empty string).
 */
export function shownValue(value) {
  return value === '' ? '""' : formatValue(value);
}
