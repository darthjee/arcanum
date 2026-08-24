import { execFile } from 'node:child_process';
import { access, unlink } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import DispatchFailure from './utils/errors/DispatchFailure.js';
import GithubIssue from './GithubIssue.js';
import Origin from './utils/git/Origin.js';
import RepoConfig from './utils/config/RepoConfig.js';
import RepoPath from './utils/file/RepoPath.js';
import Tags from './utils/issue/Tags.js';

const defaultExecFileAsync = promisify(execFile);
const USAGE = 'Usage: spawn-issue <repo_path> <parent_id> <title> <body_file> [--as-subissue]';
const SPAWNED_LABEL = 'Spawned';
const AS_SUBISSUE_FLAG = '--as-subissue';
const ADD_SUB_ISSUE_MUTATION =
  'mutation($issueId:ID!,$subIssueId:ID!){addSubIssue(input:{issueId:$issueId,subIssueId:$subIssueId}){subIssue{id}}}';

/**
 * Sleep for `seconds` seconds, mirroring the shell's `sleep
 * "$error_sleep"` between retry attempts.
 * @param {number} seconds - how long to sleep, in seconds.
 * @returns {Promise<void>} resolves once the wait has elapsed.
 */
function defaultSleep(seconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000);
  });
}

/**
 * Native implementation of the `spawn-issue` migrated entrypoint —
 * mirrors `arcanum/_lib/spawn_issue_shell.sh` step for step: create a
 * brand-new GitHub issue (retried), derive and apply a safe label set
 * plus the permanent `Spawned` label (best-effort), link it back to its
 * parent via comments and (optionally) a native GitHub sub-issue link
 * (best-effort), then delete the scratch file `GithubIssue#create`
 * wrote (best-effort). See
 * docs/agents/plans/239-migrate-spawn-issue-entrypoint-to-native-node-js/plan.md's
 * "Shared contracts".
 */
class SpawnIssue {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {RepoPath} [deps.repoPath] - repo-path validation helper.
   * @param {Origin} [deps.origin] - git-origin resolver.
   * @param {GithubIssue} [deps.githubIssue] - GitHub issue create helper.
   * @param {RepoConfig} [deps.repoConfig] - per-repo config reader.
   * @param {Function} [deps.execFileAsync] - promisified `execFile`.
   * @param {Function} [deps.sleepFn] - retry-loop sleep implementation,
   *   overridable for tests (defaults to a real `setTimeout`-based
   *   sleep).
   */
  constructor({
    repoPath = new RepoPath(),
    origin = new Origin(),
    githubIssue = new GithubIssue(),
    repoConfig = new RepoConfig(),
    execFileAsync = defaultExecFileAsync,
    sleepFn = defaultSleep
  } = {}) {
    this._repoPath = repoPath;
    this._origin = origin;
    this._githubIssue = githubIssue;
    this._repoConfig = repoConfig;
    this._execFileAsync = execFileAsync;
    this._sleep = sleepFn;
  }

  /**
   * Spawn a brand-new GitHub issue linked back to `parentId`.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} parentId - the parent issue's numeric id.
   * @param {string} title - the new issue's title.
   * @param {string} bodyFile - the local file whose contents become the
   *   new issue's body.
   * @param {string} [asSubissueFlag] - the literal string
   *   `--as-subissue` to also link the new issue as a native GitHub
   *   sub-issue of `parentId`, or absent/empty for comment-only linking.
   * @returns {Promise<string>} the `STATUS=ok\nID=...\nURL=...\n` output.
   * @throws {DispatchFailure} when `create`'s retry budget is exhausted
   *   — carries the `STATUS=failed\n` stdout payload.
   */
  async run(repoPath, parentId, title, bodyFile, asSubissueFlag) {
    if (!repoPath || !parentId || !title || !bodyFile) {
      throw new Error(USAGE);
    }

    if (asSubissueFlag !== undefined && asSubissueFlag !== '' && asSubissueFlag !== AS_SUBISSUE_FLAG) {
      throw new Error(USAGE);
    }

    const asSubissue = asSubissueFlag === AS_SUBISSUE_FLAG;

    await this._repoPath.validate(repoPath);

    if (!(await this._fileExists(bodyFile))) {
      throw new Error(`Error: file not found: ${bodyFile}`);
    }

    const { domain, repo } = await this._origin.resolve(repoPath);
    const { maxRetryCount, errorSleepTime } = await this._repoConfig.getPlanIssuesRetryConfig(repoPath);

    const { newId, newFile } = await this._createWithRetry(repoPath, title, bodyFile, maxRetryCount, errorSleepTime);

    await this._applyLabels(parentId, newId, repo);
    await this._linkBack(parentId, newId, title, repo, asSubissue);
    await this._cleanup(repoPath, newFile);

    const url = `https://${domain}/${repo}/issues/${newId}`;

    return `STATUS=ok\nID=${newId}\nURL=${url}\n`;
  }

  /**
   * Call `GithubIssue#create` in-process, retrying up to
   * `maxRetryCount` times with `errorSleepTime`-second sleeps between
   * attempts, mirroring `spawn_issue_shell.sh`'s retry loop around
   * `github_issue.sh create`.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} title - the new issue's title.
   * @param {string} bodyFile - the local file whose contents become the
   *   new issue's body.
   * @param {number} maxRetryCount - maximum number of attempts.
   * @param {number} errorSleepTime - seconds to sleep between attempts.
   * @returns {Promise<{newId: string, newFile: string}>} the created
   *   issue's id and the scratch file `create` wrote.
   * @throws {DispatchFailure} once `maxRetryCount` attempts have all failed.
   */
  async _createWithRetry(repoPath, title, bodyFile, maxRetryCount, errorSleepTime) {
    for (let attempt = 1; attempt <= maxRetryCount; attempt += 1) {
      try {
        const output = await this._githubIssue.create(repoPath, title, bodyFile);

        return { newId: this._extractField(output, 'ID'), newFile: this._extractField(output, 'FILE') };
      } catch (error) {
        process.stderr.write(
          `Warning: github-issue create failed (attempt ${attempt}/${maxRetryCount}): ${error.message}\n`
        );

        if (attempt < maxRetryCount) {
          await this._sleep(errorSleepTime);
        }
      }
    }

    throw new DispatchFailure('STATUS=failed\n');
  }

  /**
   * Best-effort: fetch `parentId`'s current labels, strip any label
   * that maps to a canonical pipeline tag, keep everything else, then
   * always add `Spawned` on top. Falls back to applying just `Spawned`
   * when the parent-labels lookup itself fails. Never throws.
   * @param {string} parentId - the parent issue's numeric id.
   * @param {string} newId - the newly-created issue's numeric id.
   * @param {string} repoRef - the `owner/repo` GitHub reference.
   * @returns {Promise<void>} resolves regardless of outcome.
   */
  async _applyLabels(parentId, newId, repoRef) {
    let labelsToApply = [];

    try {
      const { stdout } = await this._execFileAsync('gh', [
        'issue', 'view', String(parentId), '-R', repoRef, '--json', 'labels', '-q', '.labels[].name'
      ]);

      labelsToApply = stdout
        .split('\n')
        .map((label) => label.trim())
        .filter((label) => label.length > 0)
        .filter((label) => Tags.extractTags([label]).length === 0);
    } catch (error) {
      process.stderr.write(
        `Warning: could not fetch labels from parent issue #${parentId} on ${repoRef}: ${error.message} — applying only 'Spawned'\n`
      );
    }

    labelsToApply.push(SPAWNED_LABEL);

    const labelArgs = labelsToApply.flatMap((label) => ['--add-label', label]);

    try {
      await this._execFileAsync('gh', ['issue', 'edit', String(newId), '-R', repoRef, ...labelArgs]);
    } catch {
      process.stderr.write(`Warning: could not apply labels to issue #${newId} on ${repoRef}\n`);
    }
  }

  /**
   * Best-effort: comment on both the parent and the new issue,
   * cross-linking them, and — when `asSubissue` is set — additionally
   * link the new issue as a native GitHub sub-issue of the parent via
   * the `addSubIssue` GraphQL mutation. Never throws.
   * @param {string} parentId - the parent issue's numeric id.
   * @param {string} newId - the newly-created issue's numeric id.
   * @param {string} title - the new issue's title.
   * @param {string} repoRef - the `owner/repo` GitHub reference.
   * @param {boolean} asSubissue - whether to also link as a native
   *   GitHub sub-issue.
   * @returns {Promise<void>} resolves regardless of outcome.
   */
  async _linkBack(parentId, newId, title, repoRef, asSubissue) {
    try {
      await this._execFileAsync('gh', [
        'issue', 'comment', String(parentId), '-R', repoRef, '--body', `Spawned issue #${newId}: ${title}`
      ]);
    } catch {
      process.stderr.write(`Warning: could not comment on parent issue #${parentId} on ${repoRef}\n`);
    }

    try {
      await this._execFileAsync('gh', [
        'issue', 'comment', String(newId), '-R', repoRef, '--body', `Spawned from #${parentId}`
      ]);
    } catch {
      process.stderr.write(`Warning: could not comment on issue #${newId} on ${repoRef}\n`);
    }

    if (!asSubissue) {
      return;
    }

    await this._linkSubIssue(parentId, newId, repoRef);
  }

  /**
   * Best-effort: resolve both issues' GraphQL node ids and run the
   * `addSubIssue` mutation, warning to stderr on any failure along the
   * way. Never throws.
   * @param {string} parentId - the parent issue's numeric id.
   * @param {string} newId - the newly-created issue's numeric id.
   * @param {string} repoRef - the `owner/repo` GitHub reference.
   * @returns {Promise<void>} resolves regardless of outcome.
   */
  async _linkSubIssue(parentId, newId, repoRef) {
    const parentNodeId = await this._nodeId(parentId, repoRef);
    const subNodeId = await this._nodeId(newId, repoRef);

    let linked = false;

    if (parentNodeId && subNodeId) {
      try {
        await this._execFileAsync('gh', [
          'api', 'graphql',
          '-f', `query=${ADD_SUB_ISSUE_MUTATION}`,
          '-F', `issueId=${parentNodeId}`,
          '-F', `subIssueId=${subNodeId}`
        ]);
        linked = true;
      } catch {
        linked = false;
      }
    }

    if (!linked) {
      process.stderr.write(
        `Warning: could not link issue #${newId} as a native sub-issue of #${parentId} — created but not linked; link it manually on GitHub\n`
      );
    }
  }

  /**
   * @param {string} id - the issue's numeric id.
   * @param {string} repoRef - the `owner/repo` GitHub reference.
   * @returns {Promise<string>} the issue's GraphQL node id, or an empty
   *   string on any lookup failure.
   */
  async _nodeId(id, repoRef) {
    try {
      const { stdout } = await this._execFileAsync('gh', [
        'issue', 'view', String(id), '-R', repoRef, '--json', 'id', '-q', '.id'
      ]);

      return stdout.trim();
    } catch {
      return '';
    }
  }

  /**
   * Best-effort: delete the scratch file `GithubIssue#create` wrote, so
   * nothing survives locally to be accidentally committed. A no-op when
   * `newFile` is empty. Never throws — on failure, prints the same
   * loud multi-line stderr warning block `spawn_issue_shell.sh` does.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} newFile - the scratch file's path, relative to
   *   `repoPath`.
   * @returns {Promise<void>} resolves regardless of outcome.
   */
  async _cleanup(repoPath, newFile) {
    if (!newFile) {
      return;
    }

    try {
      await unlink(path.join(repoPath, newFile));
    } catch (error) {
      process.stderr.write(
        '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n' +
        `WARNING: failed to delete scratch file '${newFile}': ${error.message}\n` +
        'This file must NOT be committed — delete it manually right away.\n' +
        '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n'
      );
    }
  }

  /**
   * @param {string} filePath - the path to check.
   * @returns {Promise<boolean>} whether `filePath` exists.
   */
  async _fileExists(filePath) {
    try {
      await access(filePath);

      return true;
    } catch {
      return false;
    }
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

export default SpawnIssue;
