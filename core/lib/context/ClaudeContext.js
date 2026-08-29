import path from 'node:path';

/**
 * Bundles a single repo's `repoPath` (the `<anchor>`) with the string
 * building needed to locate Claude Code's native settings files. It is
 * a peer to `RepoContext`, not a field on it, and it wraps none of
 * `RepoContext`'s collaborators — its sole job is to anchor path
 * resolution so callers stop depending on the ambient `process.cwd()`.
 *
 * Every method is pure string building — no `fs` access — matching
 * `RepoContext`'s constructor-cost profile.
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
   */
  constructor({ repoPath, env = process.env } = {}) {
    this.repoPath = repoPath;
    this._env = env;
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
   * @returns {string} the global settings path — `settings.json` under
   *   `CLAUDE_CONFIG_DIR` when set, else under `$HOME/.claude`.
   */
  globalSettingsPath() {
    return path.join(
      this._env.CLAUDE_CONFIG_DIR || path.join(this._env.HOME, '.claude'),
      'settings.json'
    );
  }
}

export default ClaudeContext;
