import { execFile } from 'node:child_process';
import { readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { resolveInstallPath } from '../utils/file/InstallRoot.js';
import SafeBranch from './SafeBranch.js';

const defaultExecFileAsync = promisify(execFile);
const USAGE = 'Usage: finish.sh <repo_path> <issue_id>';
const ISSUES_DIR = 'docs/agents/issues';

// `arcanum-split-issue/scripts/github.sh` is shelled out to exactly
// like `finish_shell.sh` does — resolved via `resolveInstallPath`
// against the arcanum install (the skill repo itself), NOT the target
// `repoPath` being operated on.
const GITHUB_SCRIPT = resolveInstallPath(
  'arcanum-split-issue', 'scripts', 'github.sh'
);

/**
 * Native equivalent of `arcanum-split-issue/scripts/finish_shell.sh`:
 * finishes up after all of a split issue's sub-issues have been pushed
 * successfully — relabels the parent issue (Planning -> Split), deletes
 * the local working files left over from the split, and releases the
 * working tree back to the configured safe branch. See
 * docs/agents/plans/255-migrate-arcanum-split-issue-finish-entrypoint-to-native-node-js/node.md's
 * "Shared contracts".
 */
class ArcanumSplitIssueFinish {
  /**
   * @param {import('../context/RepoContext.js').default} repoContext -
   *   the target repo's context (provides `repoPath`).
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Function} [deps.execFileAsync] - promisified `execFile`.
   * @param {SafeBranch} [deps.safeBranch] - safe-branch checkout helper.
   * @param {Function} [deps.readdir] - `node:fs/promises`'s `readdir`.
   * @param {Function} [deps.unlink] - `node:fs/promises`'s `unlink`.
   */
  constructor(repoContext, {
    execFileAsync = defaultExecFileAsync,
    safeBranch = new SafeBranch(repoContext),
    readdir: readdirFn = readdir,
    unlink: unlinkFn = unlink
  } = {}) {
    this._repoContext = repoContext;
    this._execFileAsync = execFileAsync;
    this._safeBranch = safeBranch;
    this._readdir = readdirFn;
    this._unlink = unlinkFn;
  }

  /**
   * Native implementation of the `arcanum-split-issue-finish` migrated
   * entrypoint — byte-identical stdout/exit-code counterpart to
   * `finish_shell.sh`. Validates that
   * both arguments are present (usage message on missing/empty
   * argument, propagated uncaught so the caller exits 1). Relabels the
   * parent issue by shelling out to `arcanum-split-issue/scripts/github.sh
   * mark-split` — resolved via `resolveInstallPath` against the arcanum
   * install, like `finish_shell.sh`'s `"${SCRIPT_DIR}/github.sh"`, NOT
   * relative to `repoPath` — where any
   * failure propagates uncaught, mirroring `set -euo pipefail`. Then
   * deletes the local `docs/agents/issues/` working files
   * whose name starts with `<issueId>-` or `<issueId>_`, and finally
   * releases the working tree back to the configured safe branch.
   * @param {string} issueId - the parent issue's numeric id.
   * @returns {Promise<string>} the `Deleted:\n  <path>\n...\n` (or
   *   `Deleted: (nothing to clean up)\n`) block followed by
   *   `BRANCH=<branch>\n`.
   */
  async run(issueId) {
    if (!this._repoContext.repoPath || !issueId) {
      throw new Error(USAGE);
    }

    await this._execFileAsync(
      GITHUB_SCRIPT,
      ['mark-split', this._repoContext.repoPath, issueId]
    );

    const deletedBlock = await this._deleteWorkingFiles(issueId);

    const branch = await this._safeBranch.checkout();

    return `${deletedBlock}BRANCH=${branch}\n`;
  }

  /**
   * Deletes every local working file under `<repoPath>/docs/agents/issues/`
   * whose name starts with `<issueId>-` or `<issueId>_`, in that order
   * — mirroring `finish_shell.sh`'s two separate `for` loops (and their
   * `nullglob`-driven silent no-op when the directory itself is
   * missing) exactly, including the two-pass ordering.
   * @param {string} issueId - the parent issue's numeric id.
   * @returns {Promise<string>} the `Deleted:\n  <path>\n...\n` block, or
   *   `Deleted: (nothing to clean up)\n` when nothing matched.
   */
  async _deleteWorkingFiles(issueId) {
    const repoPath = this._repoContext.repoPath;
    let entries;

    try {
      entries = await this._readdir(path.join(repoPath, ISSUES_DIR));
    } catch {
      entries = [];
    }

    const dashMatches = entries.filter((name) => name.startsWith(`${issueId}-`));
    const underscoreMatches = entries.filter((name) => name.startsWith(`${issueId}_`));

    const deleted = [];

    for (const name of [...dashMatches, ...underscoreMatches]) {
      await this._unlink(path.join(repoPath, ISSUES_DIR, name));
      deleted.push(path.posix.join(ISSUES_DIR, name));
    }

    if (deleted.length === 0) {
      return 'Deleted: (nothing to clean up)\n';
    }

    return `Deleted:\n${deleted.map((file) => `  ${file}\n`).join('')}`;
  }
}

export default ArcanumSplitIssueFinish;
