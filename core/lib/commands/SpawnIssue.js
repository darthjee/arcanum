import { execFile } from 'node:child_process';
import { access, unlink } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import DispatchFailure from '../utils/errors/DispatchFailure.js';
import IssueLinker from '../utils/issue/IssueLinker.js';
import LabelApplicator from '../utils/issue/LabelApplicator.js';
import RepoPath from '../utils/file/RepoPath.js';

const defaultExecFileAsync = promisify(execFile);
const USAGE = 'Usage: spawn-issue <repo_path> <parent_id> <title> <body_file> [--as-subissue]';
const AS_SUBISSUE_FLAG = '--as-subissue';
const DEFAULT_MAX_RETRY_COUNT = 5;
const DEFAULT_ERROR_SLEEP_TIME = 5;

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
   * @param {import('../context/RepoContext.js').default} repoContext -
   *   the target repo's context (provides `repoPath` plus the
   *   `resolve`/`readConfig`/`createIssue` wiring `run` reaches).
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Function} [deps.execFileAsync] - promisified `execFile`,
   *   forwarded to the default `labelApplicator`/`issueLinker`.
   * @param {Function} [deps.sleepFn] - retry-loop sleep implementation,
   *   overridable for tests (defaults to a real `setTimeout`-based
   *   sleep).
   * @param {LabelApplicator} [deps.labelApplicator] - best-effort
   *   parent-label carryover delegate.
   * @param {IssueLinker} [deps.issueLinker] - best-effort
   *   parent/new-issue cross-linking delegate.
   * @param {RepoPath} [deps.repoPathValidator] - repo-path validation
   *   helper.
   */
  constructor(repoContext, {
    execFileAsync = defaultExecFileAsync,
    sleepFn = defaultSleep,
    labelApplicator = new LabelApplicator({ execFileAsync }),
    issueLinker = new IssueLinker({ execFileAsync }),
    repoPathValidator = new RepoPath()
  } = {}) {
    this._repoContext = repoContext;
    this._execFileAsync = execFileAsync;
    this._sleep = sleepFn;
    this._labelApplicator = labelApplicator;
    this._issueLinker = issueLinker;
    this._repoPathValidator = repoPathValidator;
  }

  /**
   * Spawn a brand-new GitHub issue linked back to `parentId`.
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
  async run(parentId, title, bodyFile, asSubissueFlag) {
    const repoPath = this._repoContext.repoPath;

    if (!repoPath || !parentId || !title || !bodyFile) {
      throw new Error(USAGE);
    }

    if (asSubissueFlag !== undefined && asSubissueFlag !== '' && asSubissueFlag !== AS_SUBISSUE_FLAG) {
      throw new Error(USAGE);
    }

    const asSubissue = asSubissueFlag === AS_SUBISSUE_FLAG;

    await this._repoPathValidator.validate(repoPath);

    if (!(await this._fileExists(bodyFile))) {
      throw new Error(`Error: file not found: ${bodyFile}`);
    }

    const context = this._repoContext;
    const { domain, repo } = await context.resolve();
    const maxRetryCount = this._numberOrDefault(
      await context.readConfig('plan-issues', 'max-retry-count'), DEFAULT_MAX_RETRY_COUNT
    );
    const errorSleepTime = this._numberOrDefault(
      await context.readConfig('plan-issues', 'error-sleep-time'), DEFAULT_ERROR_SLEEP_TIME
    );

    const { newId, newFile } = await this._createWithRetry(context, title, bodyFile, maxRetryCount, errorSleepTime);

    await this._labelApplicator.apply(parentId, newId, repo);
    await this._issueLinker.link(parentId, newId, title, repo, asSubissue);
    await this._cleanup(repoPath, newFile);

    const url = `https://${domain}/${repo}/issues/${newId}`;

    return `STATUS=ok\nID=${newId}\nURL=${url}\n`;
  }

  /**
   * Coerce a raw config value (a number, a numeric string, or anything
   * else) into a number, falling back to `fallback` when it can't be
   * parsed as a finite number — mirrors `RepoConfig#_numberOrDefault`'s
   * coercion logic (`ConfigChain#read` itself applies no per-key
   * defaults).
   * @param {*} value - the raw config value.
   * @param {number} fallback - the default to use when unparseable.
   * @returns {number} the parsed number, or `fallback`.
   */
  _numberOrDefault(value, fallback) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return fallback;
  }

  /**
   * Call `RepoContext#createIssue` in-process, retrying up to
   * `maxRetryCount` times with `errorSleepTime`-second sleeps between
   * attempts, mirroring `spawn_issue_shell.sh`'s retry loop around
   * `github_issue.sh create`.
   * @param {RepoContext} context - the per-call repo context.
   * @param {string} title - the new issue's title.
   * @param {string} bodyFile - the local file whose contents become the
   *   new issue's body.
   * @param {number} maxRetryCount - maximum number of attempts.
   * @param {number} errorSleepTime - seconds to sleep between attempts.
   * @returns {Promise<{newId: string, newFile: string}>} the created
   *   issue's id and the scratch file `create` wrote.
   * @throws {DispatchFailure} once `maxRetryCount` attempts have all failed.
   */
  async _createWithRetry(context, title, bodyFile, maxRetryCount, errorSleepTime) {
    for (let attempt = 1; attempt <= maxRetryCount; attempt += 1) {
      try {
        const output = await context.createIssue(title, bodyFile);

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
