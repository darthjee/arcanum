import ConfigChain from './ConfigChain.js';

const NAMESPACE = 'git';

/**
 * Native equivalent of `arcanum/_lib/agent_email.sh`'s
 * `agent_email_get`: resolves an agent's commit-author email across
 * the three config tiers with two-key, per-tier precedence
 * (`git.agents.<agent>` first, then the generic `git.email` pattern,
 * a tier fully resolved before the next one), substituting any
 * `{agent}` placeholder with the agent's name. Part of the shared
 * config surface bundled into `arcanum-cli` (see
 * `docs/agents/specs/arcanum-cli/shared-config-logic.md`), so it
 * imports only `ConfigChain`.
 */
class AgentEmail {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {ConfigChain} [deps.configChain] - the 3-tier config reader.
   */
  constructor({ configChain = new ConfigChain() } = {}) {
    this._configChain = configChain;
  }

  /**
   * Resolves `agent`'s email with its provenance.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} agent - the agent's name.
   * @returns {Promise<({email: (string|undefined), raw: string, tier: string, key: string}|undefined)>}
   *   `raw` is the resolved value before `{agent}` substitution
   *   (stringified), `email` the substituted value (`undefined` when
   *   the resolved value is an explicit `""`), `tier` the winning tier
   *   and `key` the full dotted key (`git.agents.<agent>` or
   *   `git.email`); `undefined` when no tier holds either key.
   */
  async resolve(repoPath, agent) {
    const source = await this._configChain.readWithSource(repoPath, NAMESPACE, `agents.${agent}`, 'email');

    if (!source) {
      return undefined;
    }

    const raw = String(source.value);
    const email = raw === '' ? undefined : raw.replaceAll('{agent}', () => agent);

    return { email, raw, tier: source.tier, key: `${NAMESPACE}.${source.key}` };
  }

  /**
   * Mirrors `agent_email_get <agent> <model_email>`: the resolved email,
   * or `modelEmail` when nothing resolves or the resolved value is an
   * explicit `""` (aligned with the shell).
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} agent - the agent's name.
   * @param {string} modelEmail - the fallback email.
   * @returns {Promise<string>} the commit-author email for `agent`.
   */
  async get(repoPath, agent, modelEmail) {
    return (await this.resolve(repoPath, agent))?.email || modelEmail;
  }
}

export default AgentEmail;
