import { access } from 'node:fs/promises';
import path from 'node:path';
import AgentEmail from '../../../../shared/lib/config/AgentEmail.js';
import ConfigChain from '../../../../shared/lib/config/ConfigChain.js';

/**
 * Async `fs.access`-based existence check, the default `fileExists`
 * collaborator.
 * @param {string} filePath - the path to check.
 * @returns {Promise<boolean>} whether `filePath` exists.
 */
async function defaultFileExists(filePath) {
  try {
    await access(filePath);

    return true;
  } catch {
    return false;
  }
}

/**
 * Builds a commit's `Co-Authored-By` trailer lines — the native
 * counterpart of `arcanum/_lib/agent_email.sh`'s `coauthor_trailers`,
 * shared by every migrated commit entrypoint (issue, plan, change and
 * cleanup commits) so they all honor `git.omit_model_coauthor` and the
 * agent's configured commit-author email the same way.
 */
class CoauthorTrailers {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {ConfigChain} [deps.configChain] - 3-tier config reader.
   * @param {AgentEmail} [deps.agentEmail] - the shared agent-email
   *   resolver (defaults to one built on `configChain`).
   * @param {function(string): Promise<boolean>} [deps.fileExists] - async
   *   existence check, used to detect the commit template engine.
   */
  constructor({
    configChain = new ConfigChain(),
    agentEmail = new AgentEmail({ configChain }),
    fileExists = defaultFileExists
  } = {}) {
    this._configChain = configChain;
    this._agentEmail = agentEmail;
    this._fileExists = fileExists;
  }

  /**
   * The ordered trailer lines for a commit made by `agent` under
   * `modelName`/`modelEmail`: the model's own line (unless
   * `git.omit_model_coauthor` is set), then the agent's line — dropped
   * too when the model co-author is omitted and the agent's email
   * resolves to the model email (so the model never leaks back in).
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} agent - the acting agent's name.
   * @param {string} modelName - the acting model's display name.
   * @param {string} modelEmail - the acting model's email (also the
   *   agent-email fallback).
   * @returns {Promise<string[]>} the trailer lines, possibly empty.
   */
  async lines(repoPath, agent, modelName, modelEmail) {
    const engine = await this._commitTemplateEngineGet(repoPath);
    const agentEmail = engine === 'new'
      ? await this._agentEmail.get(repoPath, agent, modelEmail)
      : modelEmail;
    const omit = await this._modelCoauthorOmitted(repoPath);
    const lines = [];

    if (!omit) {
      lines.push(`Co-Authored-By: ${modelName} <${modelEmail}>`);
    }

    if (!(omit && agentEmail === modelEmail)) {
      lines.push(`Co-Authored-By: ${agent} agent <${agentEmail}>`);
    }

    return lines;
  }

  /**
   * Native re-derivation of `arcanum/_lib/commit_template.sh`'s
   * `commit_template_engine_get`.
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<'new'|'old'>} `"new"` when
   *   `.github/commit_message_template-2.0.md` exists, `"old"` when
   *   only `.github/commit_message_template.md` exists, `"new"` when
   *   neither does.
   */
  async _commitTemplateEngineGet(repoPath) {
    if (await this._fileExists(path.join(repoPath, '.github', 'commit_message_template-2.0.md'))) {
      return 'new';
    }

    if (await this._fileExists(path.join(repoPath, '.github', 'commit_message_template.md'))) {
      return 'old';
    }

    return 'new';
  }

  /**
   * Native re-derivation of `arcanum/_lib/agent_email.sh`'s
   * `model_coauthor_omitted`.
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<boolean>} `true` only when the resolved
   *   `git.omit_model_coauthor` value is the boolean or string `true`.
   */
  async _modelCoauthorOmitted(repoPath) {
    const value = await this._configChain.read(repoPath, 'git', 'omit_model_coauthor');

    return value === true || value === 'true';
  }
}

export default CoauthorTrailers;
