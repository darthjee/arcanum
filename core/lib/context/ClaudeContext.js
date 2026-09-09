import { existsSync } from 'node:fs';
import { realpath } from 'node:fs/promises';
import path from 'node:path';
import DispatchFailure from '../utils/errors/DispatchFailure.js';
import { INSTALL_ROOT } from '../utils/file/InstallRoot.js';

/**
 * Bundles a single repo's `repoPath` (the `<anchor>`) with the string
 * building needed to locate Claude Code's native settings files. It is
 * a peer to `RepoContext`, not a field on it, and it wraps none of
 * `RepoContext`'s collaborators — its sole job is to anchor path
 * resolution so callers stop depending on the ambient `process.cwd()`.
 *
 * Most methods are pure string building — no `fs` access — matching
 * `RepoContext`'s constructor-cost profile. The one exception is the
 * lazy `validateInstall()` `fs` validator: it never runs from the
 * constructor, since specs build `ClaudeContext` with fake paths,
 * mirroring `RepoContext#validate()`.
 */
class ClaudeContext {
  /**
   * @param {object} [deps] - the context's anchor and injectable env,
   *   for testing.
   * @param {string} deps.repoPath - the `<anchor>` all relative paths
   *   resolve against. Same key name as `RepoContext` for consistency.
   * @param {object} [deps.env] - the environment to read
   *   `CLAUDE_CONFIG_DIR` / `HOME` from (defaults to `process.env`),
   *   mirroring `InvocationLog`'s injectable `env`.
   * @param {Function} [deps.existsSync] - injectable `fs.existsSync`,
   *   for testing.
   * @param {Function} [deps.realpath] - injectable
   *   `fs/promises.realpath`, for testing.
   * @param {string} [deps.runtimeInstallRoot] - the running arcanum
   *   install's own resolved root, defaulting to `INSTALL_ROOT`;
   *   injectable for testing `validateInstall()`'s anti-drift check.
   */
  constructor({
    repoPath,
    env = process.env,
    existsSync: existsSyncFn = existsSync,
    realpath: realpathFn = realpath,
    runtimeInstallRoot = INSTALL_ROOT
  } = {}) {
    this.repoPath = repoPath;
    this._env = env;
    this._existsSync = existsSyncFn;
    this._realpath = realpathFn;
    this._runtimeInstallRoot = runtimeInstallRoot;
  }

  /**
   * @param {string} file - an absolute or `repoPath`-relative path.
   * @returns {string} `file` unchanged when absolute, else `file`
   *   resolved against `this.repoPath` instead of `process.cwd()`.
   */
  resolve(file) {
    return path.isAbsolute(file) ? file : path.resolve(this.repoPath, file);
  }

  /**
   * @returns {string} the repo's local-settings path
   *   (`.claude/settings.local.json`).
   */
  localSettingsPath() {
    return path.join(this.repoPath, '.claude', 'settings.local.json');
  }

  /**
   * @returns {string} the repo's project-settings path
   *   (`.claude/settings.json`).
   */
  projectSettingsPath() {
    return path.join(this.repoPath, '.claude', 'settings.json');
  }

  /**
   * @returns {string} the Claude config dir — `CLAUDE_CONFIG_DIR` when
   *   set, else `$HOME/.claude`.
   */
  configDir() {
    return this._env.CLAUDE_CONFIG_DIR || path.join(this._env.HOME, '.claude');
  }

  /**
   * @returns {string} the global settings path — `settings.json` under
   *   `this.configDir()`.
   */
  globalSettingsPath() {
    return path.join(this.configDir(), 'settings.json');
  }

  /**
   * @returns {string} the arcanum install root — `this.repoPath`, the
   *   `<anchor>` this context was built with. Kept a method for
   *   symmetry with the other install-root accessors, and so a future
   *   normalization has one home.
   */
  installRoot() {
    return this.repoPath;
  }

  /**
   * @returns {string} the install's `arcanum/update/bootstrap.sh` path
   *   — the structural marker every arcanum install (zip or git) ships.
   */
  bootstrapPath() {
    return path.join(this.installRoot(), 'arcanum', 'update', 'bootstrap.sh');
  }

  /**
   * @returns {string} the install's `arcanum.json` path — present for a
   *   zip install, absent for a git clone/worktree install.
   */
  arcanumJsonPath() {
    return path.join(this.installRoot(), 'arcanum.json');
  }

  /**
   * @returns {string} the install's `.git` path — present for a git
   *   clone/worktree install, absent for a zip install.
   */
  gitDirPath() {
    return path.join(this.installRoot(), '.git');
  }

  /**
   * Validate this context's install root — mirroring
   * `ArcanumUpdateRunUpdate#_resolveTarget`'s structural check, plus an
   * anti-drift identity check against the running arcanum install.
   * Never runs from the constructor, since specs build `ClaudeContext`
   * with fake paths.
   * @returns {Promise<void>}
   * @throws {DispatchFailure} `STATUS=missing_arcanum\n` (exit 1) when
   *   `bootstrapPath()` is missing, or neither `arcanumJsonPath()` nor
   *   `gitDirPath()` is present.
   * @throws {Error} when `installRoot()` does not resolve (via
   *   `realpath`) to the same directory as the running arcanum
   *   install's own root — a malformed install or #319-class
   *   regression.
   */
  async validateInstall() {
    if (
      !this._existsSync(this.bootstrapPath()) ||
      (!this._existsSync(this.arcanumJsonPath()) && !this._existsSync(this.gitDirPath()))
    ) {
      throw new DispatchFailure('STATUS=missing_arcanum\n', 1);
    }

    const anchorReal = await this._realpath(this.installRoot());
    const runtimeReal = await this._realpath(this._runtimeInstallRoot);

    if (anchorReal !== runtimeReal) {
      throw new Error(
        'arcanum install at ' + this.installRoot() + ' is not the running arcanum install (' +
          this._runtimeInstallRoot + ')'
      );
    }
  }
}

export default ClaudeContext;
