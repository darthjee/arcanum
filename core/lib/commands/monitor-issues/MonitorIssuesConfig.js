import path from 'node:path';
import BooleanKeyConfig from '../../utils/config/BooleanKeyConfig.js';
import JsonValueFormatter from '../../utils/json/JsonValueFormatter.js';

const STATE_KEYS = new Set(['clear_context']);

/**
 * Native equivalent of `monitor-issues/scripts/config_<subcommand>_shell.sh`
 * (`get`, `is-enabled`, `set`, `toggle`) — see `BooleanKeyConfig` for
 * the shared subcommand logic. Supplies the monitor-issues file layout:
 * keys live at the top level of `.claude/state/monitor-issues-config.json`
 * (`clear_context`, personal state) or
 * `.claude/configuration/monitor-issues.json` (every other key), and
 * every write is guarded by `.claude/state/monitor-issues-config.lock`.
 * `repoPath` is the shim's `$PWD` (prepended via `--prepend-repo-path`),
 * since `config.sh` resolves its files relative to the cwd.
 */
class MonitorIssuesConfig extends BooleanKeyConfig {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {import('../../utils/file/Lock.js').default} [deps.lock] -
   *   the lock/mutate/release helper used to guard writes.
   * @param {JsonValueFormatter} [deps.formatter] - formats a stored value
   *   as `jq -r` prints it.
   */
  constructor({ lock, formatter = new JsonValueFormatter() } = {}) {
    super({ lock });
    this._formatter = formatter;
  }

  /**
   * @param {string} repoPath - the cwd the config files resolve under.
   * @returns {string} `.claude/state/monitor-issues-config.lock`.
   */
  _lockFile(repoPath) {
    return path.join(repoPath, '.claude', 'state', 'monitor-issues-config.lock');
  }

  /**
   * Mirrors `jq -r '.[$k] // false'`: `null`/`false`/absent resolve to
   * the default, strings print raw, anything else as indented JSON.
   * @param {string} repoPath - the cwd the config files resolve under.
   * @param {string} key - the config key to read.
   * @returns {Promise<string|undefined>} the formatted value, or
   *   `undefined` when absent/`null`/`false`.
   */
  async _readValue(repoPath, key) {
    const config = await this._readJson(this._fileForKey(repoPath, key));
    const value = Object.prototype.hasOwnProperty.call(config, key) ? config[key] : undefined;

    if (value === undefined || value === null || value === false) {
      return undefined;
    }

    return this._formatter.format(value);
  }

  /**
   * Mirrors `jq '.[$k] = ($v == "true")'` on the key's file.
   * @param {string} repoPath - the cwd the config files resolve under.
   * @param {string} key - the config key to write.
   * @param {boolean} value - the JSON boolean to store.
   * @returns {Promise<{file: string, content: object}>} the write target.
   */
  async _buildUpdate(repoPath, key, value) {
    const file = this._fileForKey(repoPath, key);

    return { file, content: { ...await this._readJson(file), [key]: value } };
  }

  /**
   * @param {string} repoPath - the cwd the config files resolve under.
   * @param {string} key - the config key.
   * @returns {string} the file `key` is read from/written to.
   */
  _fileForKey(repoPath, key) {
    if (STATE_KEYS.has(key)) {
      return path.join(repoPath, '.claude', 'state', 'monitor-issues-config.json');
    }

    return path.join(repoPath, '.claude', 'configuration', 'monitor-issues.json');
  }
}

export default MonitorIssuesConfig;
