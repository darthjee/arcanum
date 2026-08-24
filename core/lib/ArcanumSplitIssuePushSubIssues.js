import { readdir } from 'node:fs/promises';
import path from 'node:path';
import ArcanumSplitIssueCreateSubIssue from './ArcanumSplitIssueCreateSubIssue.js';
import DispatchFailure from './utils/errors/DispatchFailure.js';
import RepoPath from './utils/file/RepoPath.js';

const USAGE = 'Usage: push_sub_issues.sh <repo_path> <issue_id>';
const ISSUES_DIR = 'docs/agents/issues';

/**
 * Native equivalent of `arcanum-split-issue/scripts/push_sub_issues.sh`:
 * batch driver that pushes every generated sub-issue draft file for an
 * issue to GitHub, in ascending count order, stopping at the first
 * failure. Calls `ArcanumSplitIssueCreateSubIssue#run` directly in-process
 * for each matched file (per
 * docs/agents/plans/260-migrate-arcanum-split-issue-push-sub-issues-entrypoint-to-native-node-js/node.md's
 * "External dependencies" note), rather than shelling out. See that plan's
 * "Shared contracts".
 */
class ArcanumSplitIssuePushSubIssues {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {RepoPath} [deps.repoPath] - repo-path validation helper.
   * @param {ArcanumSplitIssueCreateSubIssue} [deps.createSubIssue] -
   *   per-file sub-issue creation helper.
   * @param {Function} [deps.readdir] - `node:fs/promises`'s `readdir`.
   */
  constructor({
    repoPath = new RepoPath(),
    createSubIssue = new ArcanumSplitIssueCreateSubIssue(),
    readdir: readdirFn = readdir
  } = {}) {
    this._repoPath = repoPath;
    this._createSubIssue = createSubIssue;
    this._readdir = readdirFn;
  }

  /**
   * Native implementation of the `arcanum-split-issue-push-sub-issues`
   * migrated entrypoint — byte-identical stdout/exit-code counterpart to
   * `push_sub_issues.sh`. Validates both arguments are present (usage
   * message otherwise, propagated uncaught so the caller exits 1),
   * validates `repoPath` (`RepoPath#validate`), lists and sorts every
   * matching sub-issue draft file under `docs/agents/issues/`, and calls
   * `ArcanumSplitIssueCreateSubIssue#run` for each in order — discarding
   * each call's own stdout entirely (mirroring the shell script's
   * `OUTPUT=$(...)` capture, whose contents never reach this driver's own
   * stdout on either path), stopping at the first failure.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} issueId - the parent issue's numeric id.
   * @returns {Promise<string>} `STATUS=ok\nCREATED=<csv of file:id
   *   pairs, possibly empty>\n` when every file succeeds (or there were
   *   none to begin with).
   * @throws {DispatchFailure} with exit code 1 on the first file that
   *   fails — carries `STATUS=failed\nCREATED=<csv of file:id pairs that
   *   succeeded so far, possibly empty>\nFAILED=<the file that
   *   failed>\n`.
   */
  async run(repoPath, issueId) {
    if (!repoPath || !issueId) {
      throw new Error(USAGE);
    }

    await this._repoPath.validate(repoPath);

    const files = await this._matchingFiles(repoPath, issueId);
    const created = [];

    for (const file of files) {
      let output;

      try {
        output = await this._createSubIssue.run(repoPath, issueId, file);
      } catch {
        throw new DispatchFailure(
          `STATUS=failed\nCREATED=${created.join(',')}\nFAILED=${file}\n`
        );
      }

      const newId = this._extractField(output, 'ID');

      created.push(`${file}:${newId}`);
    }

    return `STATUS=ok\nCREATED=${created.join(',')}\n`;
  }

  /**
   * Lists and sorts every sub-issue draft file matching the shell glob
   * `${issueId}_[0-9][0-9]*_*` directly under `docs/agents/issues/`,
   * returning their `docs/agents/issues/<basename>`-relative paths sorted
   * ascending by default string comparison — mirroring the shell script's
   * `sort` over the same paths. An absent `docs/agents/issues/` directory
   * yields an empty list (mirrors the shell glob's `nullglob` behavior
   * when the directory itself doesn't exist).
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} issueId - the parent issue's numeric id.
   * @returns {Promise<string[]>} the sorted, relative matching file paths.
   */
  async _matchingFiles(repoPath, issueId) {
    const issuesDir = path.join(repoPath, ISSUES_DIR);
    let entries;

    try {
      entries = await this._readdir(issuesDir);
    } catch {
      return [];
    }

    const prefix = `${issueId}_`;
    const globPattern = new RegExp(`^${this._escapeRegExp(prefix)}[0-9]{2}.*_.*$`);

    return entries
      .filter((name) => globPattern.test(name))
      .map((name) => path.posix.join(ISSUES_DIR, name))
      .sort();
  }

  /**
   * @param {string} value - the string to escape.
   * @returns {string} `value` with regex metacharacters escaped.
   */
  _escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Extract a `KEY=value` field's value from a multi-line `key=value`
   * output string, mirroring `grep '^KEY=' <<< "$output" | head -1 |
   * cut -d= -f2-`.
   * @param {string} output - the multi-line `KEY=value` output.
   * @param {string} key - the field name to extract.
   * @returns {string} the field's value, or an empty string when absent.
   */
  _extractField(output, key) {
    const prefix = `${key}=`;
    const line = output.split('\n').find((candidate) => candidate.startsWith(prefix));

    return line ? line.slice(prefix.length) : '';
  }
}

export default ArcanumSplitIssuePushSubIssues;
