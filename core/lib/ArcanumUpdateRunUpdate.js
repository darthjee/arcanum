import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import DispatchFailure from './utils/errors/DispatchFailure.js';

const defaultExecFileAsync = promisify(execFile);
const GIT_SSH_PREFIX = 'git@github.com:';
const GIT_HTTPS_PREFIX = 'https://github.com/';

/**
 * Native equivalent of `arcanum-update/scripts/run_update_check_shell.sh`
 * and `run_update_apply_shell.sh`: resolves and drives an arcanum
 * self-update for the `arcanum-update` skill. See
 * docs/agents/plans/263-migrate-arcanum-update-run-update-entrypoint-check-apply-to-native-node-js/plan.md's
 * "Shared contracts".
 */
class ArcanumUpdateRunUpdate {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Function} [deps.execFileAsync] - promisified `execFile`.
   * @param {Function} [deps.spawnFn] - `child_process.spawn`-compatible
   *   implementation, used to run `arcanum/update/bootstrap.sh`.
   * @param {Function} [deps.readFile] - `fs/promises`-compatible file
   *   reader, used for `arcanum.json`.
   * @param {Function} [deps.existsSync] - `fs`-compatible synchronous
   *   existence check.
   */
  constructor({
    execFileAsync = defaultExecFileAsync,
    spawnFn = spawn,
    readFile: readFileFn = readFile,
    existsSync: existsSyncFn = existsSync
  } = {}) {
    this._execFileAsync = execFileAsync;
    this._spawn = spawnFn;
    this._readFile = readFileFn;
    this._existsSync = existsSyncFn;
  }

  /**
   * Native implementation of the `arcanum-update-run-update-check`
   * migrated entrypoint.
   * @param {string} repoPath - the arcanum install's own self-resolved
   *   location (not necessarily the caller's `REPO_PATH`).
   * @returns {Promise<string>} `METHOD=<zip|git>\nREPO=<repo>\nCURRENT=<version-or-ref>\nTARGET=<path>\n`.
   * @throws {DispatchFailure} `STATUS=missing_arcanum\n` (exit 1) when
   *   `arcanum/update/bootstrap.sh` is missing, or neither
   *   `arcanum.json` nor `.git` is present at `repoPath`.
   */
  async check(repoPath) {
    const { method, repo } = await this._resolveTarget(repoPath);
    const current = await this._currentVersion(repoPath, method);

    return `METHOD=${method}\nREPO=${repo}\nCURRENT=${current}\nTARGET=${repoPath}\n`;
  }

  /**
   * Native implementation of the `arcanum-update-run-update-apply`
   * migrated entrypoint. Runs `arcanum/update/bootstrap.sh`, streaming
   * its stdout/stderr live via `stdio: 'inherit'`.
   * @param {string} repoPath - the arcanum install's own self-resolved
   *   location (not necessarily the caller's `REPO_PATH`).
   * @returns {Promise<string>} `RESULT=updated FROM=<old> TO=<new>\n`
   *   when the version/ref changed, else `RESULT=noop VERSION=<current>\n`.
   * @throws {DispatchFailure} `STATUS=missing_arcanum\n` (exit 1) on the
   *   same missing-arcanum condition as `check`; or an empty stdout
   *   payload with `bootstrap.sh`'s own exit code when it exits nonzero.
   */
  async apply(repoPath) {
    const { method } = await this._resolveTarget(repoPath);
    const before = await this._currentVersion(repoPath, method);
    const bootstrap = path.join(repoPath, 'arcanum', 'update', 'bootstrap.sh');
    const code = await this._runBootstrap(bootstrap);

    if (code !== 0) {
      throw new DispatchFailure('', code);
    }

    const after = await this._currentVersion(repoPath, method);

    if (after !== before) {
      return `RESULT=updated FROM=${before} TO=${after}\n`;
    }

    return `RESULT=noop VERSION=${after}\n`;
  }

  /**
   * Resolves `method`/`repo` for `repoPath`, mirroring
   * `run_update_common.sh`'s `resolve_target`.
   * @param {string} repoPath - the arcanum install's own self-resolved
   *   location.
   * @returns {Promise<{method: string, repo: string}>} the resolved
   *   update method (`'zip'`|`'git'`) and `owner/repo`.
   * @throws {DispatchFailure} `STATUS=missing_arcanum\n` (exit 1) when
   *   `arcanum/update/bootstrap.sh` is missing, or neither
   *   `arcanum.json` nor `.git` is present at `repoPath`.
   */
  async _resolveTarget(repoPath) {
    const bootstrap = path.join(repoPath, 'arcanum', 'update', 'bootstrap.sh');

    if (!this._existsSync(bootstrap)) {
      throw new DispatchFailure('STATUS=missing_arcanum\n', 1);
    }

    const arcanumJson = path.join(repoPath, 'arcanum.json');

    if (this._existsSync(arcanumJson)) {
      const repo = await this._readRepoFromArcanumJson(arcanumJson);

      return { method: 'zip', repo };
    }

    const gitDir = path.join(repoPath, '.git');

    if (this._existsSync(gitDir)) {
      const repo = await this._parseGithubOwnerRepo(repoPath);

      return { method: 'git', repo };
    }

    throw new DispatchFailure('STATUS=missing_arcanum\n', 1);
  }

  /**
   * @param {string} arcanumJsonPath - `<repoPath>/arcanum.json`'s path.
   * @returns {Promise<string>} its `.repo` field, or `''` if absent or
   *   the file is missing/malformed (mirroring the shell's
   *   `jq -r '.repo // empty' ... 2>/dev/null || true`).
   */
  async _readRepoFromArcanumJson(arcanumJsonPath) {
    try {
      const raw = await this._readFile(arcanumJsonPath, 'utf8');
      const data = JSON.parse(raw);

      return (data && data.repo) || '';
    } catch {
      return '';
    }
  }

  /**
   * Parses `<repoPath>`'s `origin` remote URL into `owner/repo`,
   * mirroring `run_update_common.sh`'s `parse_github_owner_repo`.
   * Supports `git@github.com:owner/repo.git` and
   * `https://github.com/owner/repo.git` forms (`.git` suffix stripped
   * either way).
   * @param {string} repoPath - the arcanum install's own self-resolved
   *   location.
   * @returns {Promise<string>} the parsed `owner/repo`, or `''` when
   *   there's no `origin` remote or its URL matches neither form.
   */
  async _parseGithubOwnerRepo(repoPath) {
    let url;

    try {
      const { stdout } = await this._execFileAsync('git', ['-C', repoPath, 'remote', 'get-url', 'origin']);

      url = stdout.trim();
    } catch {
      return '';
    }

    url = url.replace(/\.git$/, '');

    if (url.startsWith(GIT_SSH_PREFIX)) {
      return url.slice(GIT_SSH_PREFIX.length);
    }

    if (url.startsWith(GIT_HTTPS_PREFIX)) {
      return url.slice(GIT_HTTPS_PREFIX.length);
    }

    return '';
  }

  /**
   * Echoes the current version (zip) or ref (git) for `repoPath`/`method`,
   * mirroring `run_update_common.sh`'s `current_version`. Must be
   * called after a successful `_resolveTarget`.
   * @param {string} repoPath - the arcanum install's own self-resolved
   *   location.
   * @param {string} method - `'zip'` or `'git'`.
   * @returns {Promise<string>} the current version (zip) or ref (git).
   */
  async _currentVersion(repoPath, method) {
    if (method === 'zip') {
      const raw = await this._readFile(path.join(repoPath, 'arcanum.json'), 'utf8');
      const data = JSON.parse(raw);

      return (data && data.version) || '';
    }

    try {
      const { stdout } = await this._execFileAsync('git', [
        '-C', repoPath, 'describe', '--tags', '--exact-match'
      ]);
      const tag = stdout.trim();

      if (tag) {
        return tag;
      }
    } catch {
      // No exact tag on HEAD — fall through to the short commit hash.
    }

    const { stdout } = await this._execFileAsync('git', ['-C', repoPath, 'rev-parse', '--short', 'HEAD']);

    return stdout.trim();
  }

  /**
   * Runs `bootstrap` with its stdout/stderr streamed live (not
   * captured/suppressed) and `ARCANUM_ASSUME_YES=1` set.
   * @param {string} bootstrap - `arcanum/update/bootstrap.sh`'s path.
   * @returns {Promise<number>} the child process's exit code.
   */
  _runBootstrap(bootstrap) {
    return new Promise((resolve, reject) => {
      const child = this._spawn(bootstrap, [], {
        stdio: 'inherit',
        env: { ...process.env, ARCANUM_ASSUME_YES: '1' }
      });

      child.on('error', reject);
      child.on('close', (code) => {
        resolve(code);
      });
    });
  }
}

export default ArcanumUpdateRunUpdate;
