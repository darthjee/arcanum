import InitClaudeSetNextStepKey from './InitClaudeSetNextStepKey.js';

const KEY_CONFIG = {
  prefix: 'auto',
  tag: 'NEXT_STEP_AUTO',
  usage: 'Usage: set_next_step_auto.sh <repo_path> <skill> <true|false>'
};

/**
 * Native-only implementation of `init-claude-set-next-step-auto`: the
 * init-claude auto-next setup step's writer. Sets
 * `next_step.auto.<skill>` to `true` or `false` in the target repo's
 * `.claude/configuration/arcanum-repo-config.json` (creating the file
 * and its folder when missing) and prints
 * `NEXT_STEP_AUTO=<skill>=<value>`. There is no shell counterpart: this
 * command is reached through `init-claude/scripts/set_next_step_auto.sh`
 * and `engine_dispatch --native-only` (see
 * `docs/agents/architecture/script-engine.md`). The logic lives in
 * `InitClaudeSetNextStepKey`.
 */
class InitClaudeSetNextStepAuto extends InitClaudeSetNextStepKey {
  /**
   * @param {import('../../context/RepoContext.js').default} repoContext -
   *   the target repo's context, supplying `repoPath`.
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {import('../../../../shared/lib/config/RepoConfigWriter.js').default} [deps.writer] -
   *   the repo-config writer.
   */
  constructor(repoContext, deps = {}) {
    super(repoContext, deps, KEY_CONFIG);
  }
}

export default InitClaudeSetNextStepAuto;
