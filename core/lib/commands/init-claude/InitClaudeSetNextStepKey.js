import path from 'node:path';
import RepoConfigWriter from '../../utils/config/RepoConfigWriter.js';

const CONFIG_FILE = path.join('.claude', 'configuration', 'arcanum-repo-config.json');
const NAMESPACE = 'next_step';
const SKILLS = ['enhance-issue', 'discuss-issue', 'auto-plan-issue'];
const VALUES = { true: true, false: false };

/**
 * Shared base of the init-claude `next_step.<prefix>.<skill>` writers
 * (`InitClaudeSetNextStepAuto`, `InitClaudeSetNextStepClear`). Sets
 * `next_step.<prefix>.<skill>` to `true` or `false` in the target repo's
 * `.claude/configuration/arcanum-repo-config.json` (creating the file
 * and its folder when missing) and prints `<TAG>=<skill>=<value>`.
 * Subclasses only supply the key prefix, the output tag and the usage
 * line through the constructor's `keyConfig`.
 */
class InitClaudeSetNextStepKey {
  /**
   * @param {import('../../context/RepoContext.js').default} repoContext -
   *   the target repo's context, supplying `repoPath`.
   * @param {object} deps - injectable collaborators, for testing.
   * @param {RepoConfigWriter} [deps.writer] - the repo-config writer.
   * @param {object} keyConfig - what the subclass writes and prints.
   * @param {string} keyConfig.prefix - the key prefix under `next_step`
   *   (`auto` or `clear`).
   * @param {string} keyConfig.tag - the stdout tag (e.g. `NEXT_STEP_AUTO`).
   * @param {string} keyConfig.usage - the usage line for missing
   *   arguments.
   */
  constructor(repoContext, { writer = new RepoConfigWriter() } = {}, { prefix, tag, usage }) {
    this._repoContext = repoContext;
    this._writer = writer;
    this._prefix = prefix;
    this._tag = tag;
    this._usage = usage;
  }

  /**
   * Writes `next_step.<prefix>.<skill> = <value>`.
   * @param {string} skill - one of `enhance-issue`, `discuss-issue` or
   *   `auto-plan-issue`.
   * @param {string} value - the literal `true` or `false`.
   * @returns {Promise<string>} `<TAG>=<skill>=<value>\n`.
   * @throws {Error} a usage error when an argument is missing, the
   *   skill is unknown or the value is neither `true` nor `false`.
   */
  async run(skill, value) {
    this._validate(skill, value);

    await this._writer.write({
      newFile: path.join(this._repoContext.repoPath, CONFIG_FILE),
      legacyFile: '',
      namespace: NAMESPACE,
      key: `${this._prefix}.${skill}`,
      value: VALUES[value]
    });

    return `${this._tag}=${skill}=${value}\n`;
  }

  /**
   * @param {string} skill - the skill argument.
   * @param {string} value - the value argument.
   * @returns {void}
   * @throws {Error} when either argument is missing or invalid.
   */
  _validate(skill, value) {
    if (!skill || !value) {
      throw new Error(this._usage);
    }

    if (!SKILLS.includes(skill)) {
      throw new Error(`unknown skill '${skill}': expected one of ${SKILLS.join(', ')}`);
    }

    if (!Object.hasOwn(VALUES, value)) {
      throw new Error(`invalid value '${value}': expected true or false`);
    }
  }
}

export default InitClaudeSetNextStepKey;
