import { readdir } from 'node:fs/promises';
import path from 'node:path';
import GithubIssue from './GithubIssue.js';
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

    const existing = await this._findExistingFile(repoPath, issuesFolder, id);

    if (existing) {
      const title = this._titleFromFilename(existing);

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

  /**
   * Glob `<issuesFolder>/<id>_*`/`<id>-*` (first match wins — match
   * order is filesystem-dependent, mirroring `find ... | head -1`).
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} issuesFolder - the folder to search, relative to `repoPath`.
   * @param {string} id - the numeric issue id.
   * @returns {Promise<string|null>} the matched path (in the same
   *   `<issuesFolder>/<filename>` shape the shell prints), or null if
   *   no file matches.
   */
  async _findExistingFile(repoPath, issuesFolder, id) {
    let entries;

    try {
      entries = await readdir(path.join(repoPath, issuesFolder));
    } catch {
      return null;
    }

    const match = entries.find((name) => name.startsWith(`${id}_`) || name.startsWith(`${id}-`));

    return match ? path.posix.join(issuesFolder, match) : null;
  }

  /**
   * Native equivalent of `title_from_filename`: strip the id prefix up
   * to the first `_` (falling back to the first `-` only when the
   * filename has no `_` at all — matching the shell original's
   * parameter-expansion order exactly, quirks included), replace
   * remaining `_`/`-` with spaces, Title-Case each word.
   * @param {string} filePath - the matched existing-file path.
   * @returns {string} the derived title.
   */
  _titleFromFilename(filePath) {
    const base = path.basename(filePath, '.md');
    const underscoreIndex = base.indexOf('_');

    let titlePart;

    if (underscoreIndex !== -1) {
      titlePart = base.slice(underscoreIndex + 1);
    } else {
      const dashIndex = base.indexOf('-');

      titlePart = dashIndex !== -1 ? base.slice(dashIndex + 1) : base;
    }

    return titlePart
      .replace(/[_-]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}

export default ResolveAndFetch;
