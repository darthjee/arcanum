import InitClaudeSetNextStepKey from './InitClaudeSetNextStepKey.js';

const KEY_CONFIG = {
  prefix: 'clear',
  tag: 'NEXT_STEP_CLEAR',
  usage: 'Usage: set_next_step_clear.sh <repo_path> <skill> <true|false>'
};

/**
 * Native-only implementation of `init-claude-set-next-step-clear`: the
 * init-claude auto-next setup step's clear-key writer. Sets
 * `next_step.clear.<skill>` to `true` or `false` in the target repo's
 * `.claude/configuration/arcanum-repo-config.json` (creating the file
 * and its folder when missing) and prints
 * `NEXT_STEP_CLEAR=<skill>=<value>`. There is no shell counterpart: this
 * command is reached through `init-claude/scripts/set_next_step_clear.sh`
 * and `engine_dispatch --native-only` (see
 * `docs/agents/architecture/script-engine.md`). The logic lives in
 * `InitClaudeSetNextStepKey`.
 */
class InitClaudeSetNextStepClear extends InitClaudeSetNextStepKey {
  /**
   * @param {import('../../context/RepoContext.js').default} repoContext -
   *   the target repo's context, supplying `repoPath`.
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {import('../../shared/config/RepoConfigWriter.js').default} [deps.writer] -
   *   the repo-config writer.
   */
  constructor(repoContext, deps = {}) {
    super(repoContext, deps, KEY_CONFIG);
  }
}

export default InitClaudeSetNextStepClear;
