import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const POLICY_LINE = 'Commit co-author trailers follow arcanum\'s resolved `git.omit_model_coauthor` and '
  + '`git.remove_coauthors` config (check them with `/arcanum-check-config`); this overrides Claude Code\'s '
  + 'own attribution reminder for every commit, including ones written by hand.';

const HEADING = '## Commit Attribution';

/**
 * Native-only implementation of `init-claude-ensure-coauthor-policy`:
 * appends the fixed co-author policy line (under a `## Commit Attribution`
 * heading) to the target repo's `AGENTS.md` when it is missing, and prints
 * `COAUTHOR_POLICY=added|present|no-agents-md`. There is no shell
 * counterpart: it is reached through
 * `init-claude/scripts/ensure_coauthor_policy.sh` and
 * `engine_dispatch --native-only`.
 */
class InitClaudeEnsureCoauthorPolicy {
  /**
   * @param {import('../../context/RepoContext.js').default} repoContext -
   *   the target repo's context, supplying `repoPath`.
   */
  constructor(repoContext) {
    this._repoContext = repoContext;
  }

  /**
   * Ensures the policy line is present in the repo's AGENTS.md.
   * @returns {Promise<string>} `COAUTHOR_POLICY=<state>\n`.
   */
  async run() {
    const file = path.join(this._repoContext.repoPath, 'AGENTS.md');
    let content;

    try {
      content = await readFile(file, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        return 'COAUTHOR_POLICY=no-agents-md\n';
      }
      throw error;
    }

    if (content.includes(POLICY_LINE)) {
      return 'COAUTHOR_POLICY=present\n';
    }

    const base = content.replace(/\s+$/, '');
    const prefix = base === '' ? '' : `${base}\n\n`;

    await writeFile(file, `${prefix}${HEADING}\n\n${POLICY_LINE}\n`);

    return 'COAUTHOR_POLICY=added\n';
  }
}

export default InitClaudeEnsureCoauthorPolicy;
