import GithubIssue from './GithubIssue.js';
import IssueFile from './IssueFile.js';
import SafeBranch from './SafeBranch.js';

const ID_PATTERN = /^#([0-9]+)$/;

/**
 * Native implementation of the `resolve-and-fetch` migrated entrypoint
 * — see docs/agents/architecture/script-engine.md and
 * docs/agents/plans/193-migrate-resolve-and-fetch-sh-to-a-native--node-js--implementation/plan.md
 * for the full design/shared contracts. Byte-identical stdout/exit-code
 * counterpart to `arcanum/_lib/resolve_and_fetch_shell.sh`.
 */
class ResolveAndFetch {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {SafeBranch} [deps.safeBranch] - safe-branch checkout helper.
   * @param {GithubIssue} [deps.githubIssue] - GitHub issue fetcher.
   */
  constructor({ safeBranch = new SafeBranch(), githubIssue = new GithubIssue() } = {}) {
    this._safeBranch = safeBranch;
    this._githubIssue = githubIssue;
  }

  /**
   * Resolve an issue id and guarantee its content exists locally,
   * fetching from GitHub when needed. Always resolves to a
   * `STATUS=ok`/`STATUS=error` stdout string, exiting 0, for any
   * defined input — the only exception is a dirty working tree, which
   * throws (propagated uncaught, matching
   * `checkout_safe_branch.sh`'s own hard-failure behavior: no
   * `STATUS=` line, non-zero exit).
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} issuesFolder - the local issues folder to search
   *   for an existing `<id>_*`/`<id>-*` file, relative to `repoPath`.
   * @param {string} argString - the raw `#<id>` input.
   * @returns {Promise<string>} the `STATUS=...`/`KEY=value...` output.
   */
  async run(repoPath, issuesFolder, argString) {
    await this._safeBranch.checkout(repoPath);

    const id = this._parseId(argString);

    if (!id) {
      return `STATUS=error\nERROR=Error: invalid input '${argString}' — expected '#<id>'\n`;
    }

    const existing = await IssueFile.findExisting(repoPath, issuesFolder, id);

    if (existing) {
      const title = IssueFile.titleFromFilename(existing);

      return `STATUS=ok\nID=${id}\nTITLE=${title}\nFILE=${existing}\n`;
    }

    try {
      const fetched = await this._githubIssue.fetch(repoPath, id);

      return `STATUS=ok\nID=${id}\nTITLE=${fetched.title}\nFILE=${fetched.file}\nDOMAIN=${fetched.domain}\nREPO=${fetched.repo}\n`;
    } catch (error) {
      return `STATUS=error\nID=${id}\nERROR=${error.message}\n`;
    }
  }

  /**
   * @param {string} argString - the raw input.
   * @returns {string|null} the numeric id, or null if `argString`
   *   doesn't match the simplified `^#[0-9]+$` (whitespace-trimmed)
   *   grammar.
   */
  _parseId(argString) {
    const trimmed = (argString || '').trim();
    const match = ID_PATTERN.exec(trimmed);

    return match ? match[1] : null;
  }
}

export default ResolveAndFetch;
