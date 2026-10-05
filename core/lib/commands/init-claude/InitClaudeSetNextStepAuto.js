import path from 'node:path';
import RepoConfigWriter from '../../utils/config/RepoConfigWriter.js';

const CONFIG_FILE = path.join('.claude', 'configuration', 'arcanum-repo-config.json');
const NAMESPACE = 'next_step';
const SKILLS = ['enhance-issue', 'discuss-issue', 'auto-plan-issue'];
const VALUES = { true: true, false: false };
const USAGE = 'Usage: set_next_step_auto.sh <repo_path> <skill> <true|false>';

/**
 * Native-only implementation of `init-claude-set-next-step-auto`: the
 * init-claude auto-next setup step's writer. Sets
 * `next_step.auto.<skill>` to `true` or `false` in the target repo's
 * `.claude/configuration/arcanum-repo-config.json` (creating the file
 * and its folder when missing). There is no shell counterpart: this
 * command is reached through `init-claude/scripts/set_next_step_auto.sh`
 * and `engine_dispatch --native-only` (see
 * `docs/agents/architecture/script-engine.md`).
 */
class InitClaudeSetNextStepAuto {
  /**
   * @param {import('../../context/RepoContext.js').default} repoContext -
   *   the target repo's context, supplying `repoPath`.
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {RepoConfigWriter} [deps.writer] - the repo-config writer.
   */
  constructor(repoContext, { writer = new RepoConfigWriter() } = {}) {
    this._repoContext = repoContext;
    this._writer = writer;
  }

  /**
   * Writes `next_step.auto.<skill> = <value>`.
   * @param {string} skill - one of `enhance-issue`, `discuss-issue` or
   *   `auto-plan-issue`.
   * @param {string} value - the literal `true` or `false`.
   * @returns {Promise<string>} `NEXT_STEP_AUTO=<skill>=<value>\n`.
   * @throws {Error} a usage error when an argument is missing, the
   *   skill is unknown or the value is neither `true` nor `false`.
   */
  async run(skill, value) {
    this._validate(skill, value);

    await this._writer.write({
      newFile: path.join(this._repoContext.repoPath, CONFIG_FILE),
      legacyFile: '',
      namespace: NAMESPACE,
      key: `auto.${skill}`,
      value: VALUES[value]
    });

    return `NEXT_STEP_AUTO=${skill}=${value}\n`;
  }

  /**
   * @param {string} skill - the skill argument.
   * @param {string} value - the value argument.
   * @returns {void}
   * @throws {Error} when either argument is missing or invalid.
   */
  _validate(skill, value) {
    if (!skill || !value) {
      throw new Error(USAGE);
    }

    if (!SKILLS.includes(skill)) {
      throw new Error(`unknown skill '${skill}': expected one of ${SKILLS.join(', ')}`);
    }

    if (!Object.hasOwn(VALUES, value)) {
      throw new Error(`invalid value '${value}': expected true or false`);
    }
  }
}

export default InitClaudeSetNextStepAuto;
