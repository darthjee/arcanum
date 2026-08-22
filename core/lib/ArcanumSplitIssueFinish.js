import { execFile } from 'node:child_process';
import { readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import RepoPath from './RepoPath.js';
import SafeBranch from './SafeBranch.js';

const defaultExecFileAsync = promisify(execFile);
const USAGE = 'Usage: finish.sh <repo_path> <issue_id>';
const ISSUES_DIR = 'docs/agents/issues';

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
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {RepoPath} [deps.repoPath] - repo-path validation helper.
   * @param {Function} [deps.execFileAsync] - promisified `execFile`.
   * @param {SafeBranch} [deps.safeBranch] - safe-branch checkout helper.
   * @param {Function} [deps.readdir] - `node:fs/promises`'s `readdir`.
   * @param {Function} [deps.unlink] - `node:fs/promises`'s `unlink`.
   */
  constructor({
    repoPath = new RepoPath(),
    execFileAsync = defaultExecFileAsync,
    safeBranch = new SafeBranch(),
    readdir: readdirFn = readdir,
    unlink: unlinkFn = unlink
  } = {}) {
    this._repoPath = repoPath;
    this._execFileAsync = execFileAsync;
    this._safeBranch = safeBranch;
    this._readdir = readdirFn;
    this._unlink = unlinkFn;
  }

  /**
   * Native implementation of the `arcanum-split-issue-finish` migrated
   * entrypoint — byte-identical stdout/exit-code counterpart to
   * `finish_shell.sh`. Validates `repoPath` (`RepoPath#validate`,
   * matching `repo_path_enter`'s messages/exit-1 semantics) and that
   * both arguments are present (usage message on missing/empty
   * argument, propagated uncaught so the caller exits 1). Relabels the
   * parent issue by shelling out to `arcanum-split-issue/scripts/github.sh
   * mark-split` (any failure propagates uncaught, mirroring `set -euo
   * pipefail`), deletes the local `docs/agents/issues/<issueId>-`*/`<issueId>_`*
   * working files, and finally releases the working tree back to the
   * configured safe branch.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} issueId - the parent issue's numeric id.
   * @returns {Promise<string>} the `Deleted:\n  <path>\n...\n` (or
   *   `Deleted: (nothing to clean up)\n`) block followed by
   *   `BRANCH=<branch>\n`.
   */
  async run(repoPath, issueId) {
    if (!repoPath || !issueId) {
      throw new Error(USAGE);
    }

    await this._repoPath.validate(repoPath);

    await this._execFileAsync(
      path.join(repoPath, 'arcanum-split-issue', 'scripts', 'github.sh'),
      ['mark-split', repoPath, issueId]
    );

    const deletedBlock = await this._deleteWorkingFiles(repoPath, issueId);

    const branch = await this._safeBranch.checkout(repoPath);

    return `${deletedBlock}BRANCH=${branch}\n`;
  }

  /**
   * Deletes every local working file under `<repoPath>/docs/agents/issues/`
   * whose name starts with `<issueId>-` or `<issueId>_`, in that order
   * — mirroring `finish_shell.sh`'s two separate `for` loops (and their
   * `nullglob`-driven silent no-op when the directory itself is
   * missing) exactly, including the two-pass ordering.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} issueId - the parent issue's numeric id.
   * @returns {Promise<string>} the `Deleted:\n  <path>\n...\n` block, or
   *   `Deleted: (nothing to clean up)\n` when nothing matched.
   */
  async _deleteWorkingFiles(repoPath, issueId) {
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
