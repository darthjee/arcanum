import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { appendFile } from 'node:fs/promises';
import path from 'node:path';

const defaultExecFileAsync = promisify(execFile);

/**
 * Temporary, debug-only instrumentation for issue #244: records a
 * single `command <name> invoked at <ISO timestamp>` line to a log
 * file under the configured `engine.log.location`, for every native
 * command invocation that reaches `core/bin/arcanum`. This class is
 * expected to be removed once the native migration described in
 * docs/agents/architecture/script-engine.md is complete.
 *
 * Every failure — missing `ARCANUM_REPO_PATH`, an unset/misconfigured
 * `engine.log.location`, an unwritable log directory, a broken
 * shell-out to `config_chain_read` — is intentionally swallowed
 * silently: this instrumentation must never affect the invoked
 * command's own stdout or exit code.
 */
class InvocationLog {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Function} [deps.execFileAsync] - promisified `execFile`.
   * @param {Function} [deps.appendFileAsync] - `fs/promises` `appendFile`.
   * @param {string} deps.configChainPath - absolute path to
   *   `arcanum/_lib/config_chain.sh`, to be `source`d by the shell-out.
   * @param {object} [deps.env] - the environment to read
   *   `ARCANUM_REPO_PATH` from (defaults to `process.env`).
   */
  constructor({
    execFileAsync = defaultExecFileAsync,
    appendFileAsync = appendFile,
    configChainPath,
    env = process.env
  } = {}) {
    this._execFileAsync = execFileAsync;
    this._appendFileAsync = appendFileAsync;
    this._configChainPath = configChainPath;
    this._env = env;
  }

  /**
   * @param {string} command - the command name being invoked.
   * @returns {Promise<void>} always resolves — see class doc for why
   *   every failure is silently swallowed instead of rejecting.
   */
  async record(command) {
    try {
      const repoPath = this._env.ARCANUM_REPO_PATH;

      if (!repoPath) {
        return;
      }

      const location = await this._resolveLogLocation(repoPath);

      if (!location) {
        return;
      }

      const repoName = path.basename(repoPath);
      const logFile = path.join(location, `arcanum-${repoName}-log.txt`);
      const timestamp = new Date().toISOString();

      await this._appendFileAsync(logFile, `command ${command} invoked at ${timestamp}\n`);
    } catch {
      // silently swallow — see class doc.
    }
  }

  /**
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<string>} the resolved `engine.log.location`, or
   *   an empty string when unset.
   */
  async _resolveLogLocation(repoPath) {
    // Static script text; repoPath/configChainPath are passed as real
    // argv values ($1/$2), never concatenated into the script string —
    // required by docs/agents/architecture/script-engine.md's "No
    // string-interpolated shell execution" rule. `cwd` is set to
    // repoPath because config_chain_read resolves its config file
    // paths relative to the current directory, the same way
    // engine_dispatch.sh itself does (`cd "$repo_path" && config_chain_read ...`).
    const script = 'source "$1" && config_chain_read "$2" engine log.location';
    const { stdout } = await this._execFileAsync(
      'bash',
      ['-c', script, '--', this._configChainPath, repoPath],
      { cwd: repoPath }
    );

    return stdout.trim().replace(/^"/, '').replace(/"$/, '');
  }
}

export default InvocationLog;
