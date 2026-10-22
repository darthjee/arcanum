import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** The model email every fixture row falls back to. */
export const MODEL_EMAIL = 'model@example.com';

/**
 * The shared shell/native agent-email parity table: each row seeds the
 * three config tiers' `git` section (`local`, `repo`, `global`; an
 * omitted tier has no file) and states the email `agent_email_get` /
 * `AgentEmail#get` must yield for `agent`, plus the native
 * `AgentEmail#resolve` provenance (`undefined` when nothing resolves).
 * Exercised by `shared/spec/config/AgentEmail_spec.js` (native). Copied
 * from core's spec support, which keeps its own copy for the shell/native
 * parity spec; spec support is never imported across folders.
 */
export const AGENT_EMAIL_FIXTURES = [
  {
    description: 'no tier holds either key',
    agent: 'node',
    tiers: {},
    expected: MODEL_EMAIL,
    resolved: undefined
  },
  {
    description: 'every key is null',
    agent: 'node',
    tiers: {
      local: { agents: { node: null }, email: null },
      repo: { agents: { node: null } },
      global: { email: null }
    },
    expected: MODEL_EMAIL,
    resolved: undefined
  },
  {
    description: 'the agent-specific key is an explicit ""',
    agent: 'node',
    tiers: {
      repo: { agents: { node: '' } },
      global: { email: 'global@example.com' }
    },
    expected: MODEL_EMAIL,
    resolved: { email: undefined, raw: '', tier: 'repo', key: 'git.agents.node' }
  },
  {
    description: 'the generic key is an explicit ""',
    agent: 'node',
    tiers: { local: { email: '' } },
    expected: MODEL_EMAIL,
    resolved: { email: undefined, raw: '', tier: 'local', key: 'git.email' }
  },
  {
    description: 'only the agent-specific key is set',
    agent: 'node',
    tiers: { global: { agents: { node: 'node@example.com' } } },
    expected: 'node@example.com',
    resolved: { email: 'node@example.com', raw: 'node@example.com', tier: 'global', key: 'git.agents.node' }
  },
  {
    description: 'only the generic key is set',
    agent: 'node',
    tiers: { repo: { email: 'team@example.com' } },
    expected: 'team@example.com',
    resolved: { email: 'team@example.com', raw: 'team@example.com', tier: 'repo', key: 'git.email' }
  },
  {
    description: 'the agent-specific key beats the generic key within a tier',
    agent: 'node',
    tiers: { repo: { agents: { node: 'node@example.com' }, email: 'team@example.com' } },
    expected: 'node@example.com',
    resolved: { email: 'node@example.com', raw: 'node@example.com', tier: 'repo', key: 'git.agents.node' }
  },
  {
    description: 'a null agent-specific key falls through to the generic key in the same tier',
    agent: 'node',
    tiers: { repo: { agents: { node: null }, email: 'team@example.com' } },
    expected: 'team@example.com',
    resolved: { email: 'team@example.com', raw: 'team@example.com', tier: 'repo', key: 'git.email' }
  },
  {
    description: 'the generic key at repo beats the agent-specific key at global',
    agent: 'node',
    tiers: {
      repo: { email: 'team@example.com' },
      global: { agents: { node: 'node@example.com' } }
    },
    expected: 'team@example.com',
    resolved: { email: 'team@example.com', raw: 'team@example.com', tier: 'repo', key: 'git.email' }
  },
  {
    description: 'the {agent} placeholder is substituted with the agent name',
    agent: 'architect',
    tiers: { global: { email: 'bot+{agent}@example.com' } },
    expected: 'bot+architect@example.com',
    resolved: {
      email: 'bot+architect@example.com', raw: 'bot+{agent}@example.com', tier: 'global', key: 'git.email'
    }
  },
  {
    description: 'every {agent} placeholder occurrence is substituted',
    agent: 'node',
    tiers: { local: { agents: { node: '{agent}.{agent}@example.com' } } },
    expected: 'node.node@example.com',
    resolved: {
      email: 'node.node@example.com', raw: '{agent}.{agent}@example.com', tier: 'local', key: 'git.agents.node'
    }
  }
];

/**
 * Seed a row's tiers: the local state and repo config files under
 * `repoPath`, and the global config file under `globalDir` (the
 * `CLAUDE_CONFIG_DIR`), each holding `{ git: <section> }`.
 * @param {string} repoPath - the temp repo's path.
 * @param {string} globalDir - the temp `CLAUDE_CONFIG_DIR`.
 * @param {{local?: object, repo?: object, global?: object}} tiers - the
 *   row's per-tier `git` sections.
 * @returns {Promise<void>} resolves once every given tier is written.
 */
export async function seedAgentEmailTiers(repoPath, globalDir, tiers) {
  const files = {
    local: path.join(repoPath, '.claude', 'state', 'arcanum-config.json'),
    repo: path.join(repoPath, '.claude', 'configuration', 'arcanum-repo-config.json'),
    global: path.join(globalDir, 'arcanum-config.json')
  };

  for (const [tier, section] of Object.entries(tiers)) {
    await mkdir(path.dirname(files[tier]), { recursive: true });
    await writeFile(files[tier], JSON.stringify({ git: section }));
  }
}
