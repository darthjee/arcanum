// The `config setup` identity section's per-agent overrides (see
// docs/agents/architecture/arcanum-cli.md#coverage-and-order): behind an
// opt-in question, one `git.agents.<agent>` setting per agent in the
// repo's `.claude/agents/`, each showing what its email resolves to now.

import AgentEmail from '../../../../../shared/lib/config/AgentEmail.js';
import ConfigChain from '../../../../../shared/lib/config/ConfigChain.js';
import { agentKey, repoAgents } from '../shortcuts/agentsEmail.js';
import { askSetting, confirm } from './setting.js';

/** The opt-in question (default: no). */
export const AGENTS_QUESTION = 'customise per-agent emails? [y/N] ';

/**
 * @param {(object|undefined)} resolution - an `AgentEmail#resolve` result.
 * @returns {string} what the agent commits with now, and where it comes from.
 */
export function resolvesText(resolution) {
  if (resolution === undefined || resolution.email === undefined) {
    const from = resolution === undefined ? '' : ` (empty at ${resolution.key}, ${resolution.tier})`;

    return `currently resolves to: the model default${from}`;
  }

  return `currently resolves to: ${resolution.email} (${resolution.key}, ${resolution.tier})`;
}

/**
 * Asks the per-agent overrides: a note and nothing else when the repo
 * has no agents; otherwise the opt-in question, then, on yes, one
 * setting per agent, sorted.
 * @param {object} session - the wizard's state.
 * @param {object} item - the `agents` item (`entry`, `defaultTier`).
 * @returns {Promise<void>} resolves once every agent is asked.
 */
export async function askAgents(session, item) {
  const { root } = session.targets.repo;
  const agents = [...await repoAgents(root)].sort((a, b) => (a < b ? -1 : Number(a > b)));

  if (agents.length === 0) {
    session.output.note(`no agents in ${root}/.claude/agents; skipping the per-agent emails`);

    return;
  }

  session.io.stderr.write('\n');

  if (!await confirm(session, AGENTS_QUESTION, false)) {
    return;
  }

  const { account } = session.targets;
  const env = account.dir === null ? {} : { CLAUDE_CONFIG_DIR: account.dir };
  const agentEmail = new AgentEmail({ configChain: new ConfigChain({ env }) });

  for (const agent of agents) {
    const resolution = await agentEmail.resolve(root, agent);

    await askSetting(session, { ...item, key: agentKey(agent), kind: 'value' }, [resolvesText(resolution)]);
  }
}
