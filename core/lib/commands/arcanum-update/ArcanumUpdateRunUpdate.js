import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import DispatchFailure from '../../utils/errors/DispatchFailure.js';

const defaultExecFileAsync = promisify(execFile);
const GIT_SSH_PREFIX = 'git@github.com:';
const GIT_HTTPS_PREFIX = 'https://github.com/';

/**
 * Native equivalent of `arcanum-update/scripts/run_update_check_shell.sh`
 * and `run_update_apply_shell.sh`: resolves and drives an arcanum
 * self-update for the `arcanum-update` skill. See
 * docs/agents/plans/263-migrate-arcanum-update-run-update-entrypoint-check-apply-to-native-node-js/plan.md's
 * "Shared contracts".
 *
 * The CLI path is a `context: 'claude'` command: `Dispatcher` strips the
 * leading `<anchor>` argument, builds a `ClaudeContext` from it and injects
 * it here, so the install's paths resolve against the anchor rather than a
 * caller-suppliable `repoPath` positional.
 */
class ArcanumUpdateRunUpdate {
  /**
   * @param {import('../../context/ClaudeContext.js').default} claudeContext -
   *   the context anchoring the arcanum install's own self-resolved
   *   location, injected by `Dispatcher` from the leading `<anchor>` CLI
   *   argument.
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Function} [deps.execFileAsync] - promisified `execFile`.
   * @param {Function} [deps.spawnFn] - `child_process.spawn`-compatible
   *   implementation, used to run `arcanum/update/bootstrap.sh`.
   * @param {Function} [deps.readFile] - `fs/promises`-compatible file
   *   reader, used for `arcanum.json`.
   * @param {Function} [deps.existsSync] - `fs`-compatible synchronous
   *   existence check.
   */
  constructor(claudeContext, {
    execFileAsync = defaultExecFileAsync,
    spawnFn = spawn,
    readFile: readFileFn = readFile,
    existsSync: existsSyncFn = existsSync
  } = {}) {
    this._claudeContext = claudeContext;
    this._execFileAsync = execFileAsync;
    this._spawn = spawnFn;
    this._readFile = readFileFn;
    this._existsSync = existsSyncFn;
  }

  /**
   * Native implementation of the `arcanum-update-run-update-check`
   * migrated entrypoint.
   * @returns {Promise<string>} `METHOD=<zip|git>\nREPO=<repo>\nCURRENT=<version-or-ref>\nTARGET=<path>\n`.
   * @throws {DispatchFailure} `STATUS=missing_arcanum\n` (exit 1) when
   *   `arcanum/update/bootstrap.sh` is missing, or neither
   *   `arcanum.json` nor `.git` is present at the install root.
   */
  async check() {
    const { method, repo } = await this._resolveTarget();
    const current = await this._currentVersion(method);

    return `METHOD=${method}\nREPO=${repo}\nCURRENT=${current}\nTARGET=${this._claudeContext.installRoot()}\n`;
  }

  /**
   * Native implementation of the `arcanum-update-run-update-apply`
   * migrated entrypoint. Runs `arcanum/update/bootstrap.sh`, streaming
   * its stdout/stderr live via `stdio: 'inherit'`.
   * @returns {Promise<string>} `RESULT=updated FROM=<old> TO=<new>\n`
   *   when the version/ref changed, else `RESULT=noop VERSION=<current>\n`.
   * @throws {DispatchFailure} `STATUS=missing_arcanum\n` (exit 1) on the
   *   same missing-arcanum condition as `check`; or an empty stdout
   *   payload with `bootstrap.sh`'s own exit code when it exits nonzero.
   */
  async apply() {
    const { method } = await this._resolveTarget();
    const before = await this._currentVersion(method);
    const bootstrap = this._claudeContext.bootstrapPath();
    const code = await this._runBootstrap(bootstrap);

    if (code !== 0) {
      throw new DispatchFailure('', code);
    }

    const after = await this._currentVersion(method);

    if (after !== before) {
      return `RESULT=updated FROM=${before} TO=${after}\n`;
    }

    return `RESULT=noop VERSION=${after}\n`;
  }

  /**
   * Resolves `method`/`repo` for the injected `claudeContext`'s install
   * root, mirroring `run_update_common.sh`'s `resolve_target`.
   * @returns {Promise<{method: string, repo: string}>} the resolved
   *   update method (`'zip'`|`'git'`) and `owner/repo`.
   * @throws {DispatchFailure} `STATUS=missing_arcanum\n` (exit 1) when
   *   `arcanum/update/bootstrap.sh` is missing, or neither
   *   `arcanum.json` nor `.git` is present at the install root.
   */
  async _resolveTarget() {
    const bootstrap = this._claudeContext.bootstrapPath();

    if (!this._existsSync(bootstrap)) {
      throw new DispatchFailure('STATUS=missing_arcanum\n', 1);
    }

    const arcanumJson = this._claudeContext.arcanumJsonPath();

    if (this._existsSync(arcanumJson)) {
      const repo = await this._readRepoFromArcanumJson(arcanumJson);

      return { method: 'zip', repo };
    }

    const gitDir = this._claudeContext.gitDirPath();

    if (this._existsSync(gitDir)) {
      const repo = await this._parseGithubOwnerRepo();

      return { method: 'git', repo };
    }

    throw new DispatchFailure('STATUS=missing_arcanum\n', 1);
  }

  /**
   * @param {string} arcanumJsonPath - `<installRoot>/arcanum.json`'s path.
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
   * Parses the install root's `origin` remote URL into `owner/repo`,
   * mirroring `run_update_common.sh`'s `parse_github_owner_repo`.
   * Supports `git@github.com:owner/repo.git` and
   * `https://github.com/owner/repo.git` forms (`.git` suffix stripped
   * either way).
   * @returns {Promise<string>} the parsed `owner/repo`, or `''` when
   *   there's no `origin` remote or its URL matches neither form.
   */
  async _parseGithubOwnerRepo() {
    let url;

    try {
      const { stdout } = await this._execFileAsync('git', [
        '-C', this._claudeContext.installRoot(), 'remote', 'get-url', 'origin'
      ]);

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
   * Echoes the current version (zip) or ref (git) for the install
   * root/`method`, mirroring `run_update_common.sh`'s `current_version`.
   * Must be called after a successful `_resolveTarget`.
   * @param {string} method - `'zip'` or `'git'`.
   * @returns {Promise<string>} the current version (zip) or ref (git).
   */
  async _currentVersion(method) {
    if (method === 'zip') {
      const raw = await this._readFile(this._claudeContext.arcanumJsonPath(), 'utf8');
      const data = JSON.parse(raw);

      return (data && data.version) || '';
    }

    const installRoot = this._claudeContext.installRoot();

    try {
      const { stdout } = await this._execFileAsync('git', [
        '-C', installRoot, 'describe', '--tags', '--exact-match'
      ]);
      const tag = stdout.trim();

      if (tag) {
        return tag;
      }
    } catch {
      // No exact tag on HEAD — fall through to the short commit hash.
    }

    const { stdout } = await this._execFileAsync('git', ['-C', installRoot, 'rev-parse', '--short', 'HEAD']);

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
