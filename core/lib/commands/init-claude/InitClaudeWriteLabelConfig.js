import path from 'node:path';
import LabelConfig from '../../services/LabelConfig.js';
import DispatchFailure from '../../utils/errors/DispatchFailure.js';

/**
 * Native implementation of the `init-claude-write-label-config-replace`,
 * `-remove` and `-add` migrated entrypoints — byte-identical
 * stdout/exit-code counterparts to
 * `init-claude/scripts/write_label_config_<sub>_shell.sh`. Mutates a
 * label-config JSON file (`{"labels":[{"name":..,"color":..}]}`).
 * Validation errors go to stderr, exit 2, with the file untouched.
 */
class InitClaudeWriteLabelConfig {
  /**
   * @param {import('../../context/RepoContext.js').default} repoContext -
   *   the target repo's context, supplying `repoPath` (only used to
   *   resolve a relative `configPath`).
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {LabelConfig} [deps.labelConfig] - the label-config service.
   */
  constructor(repoContext, { labelConfig = new LabelConfig() } = {}) {
    this._repoContext = repoContext;
    this._labelConfig = labelConfig;
  }

  /**
   * Replace the whole `labels` array with the given pairs.
   * @param {string} configPath - the config file's path.
   * @param {...string} pairs - `<name>:<color>` pairs.
   * @returns {Promise<string>} `''` (no stdout).
   * @throws {DispatchFailure} exit 2 on an invalid pair.
   */
  async replace(configPath, ...pairs) {
    return this._apply(await this._labelConfig.replace(this._resolve(configPath), pairs));
  }

  /**
   * Remove the entries matching the given bare names.
   * @param {string} configPath - the config file's path.
   * @param {...string} names - bare label names.
   * @returns {Promise<string>} `''` (no stdout).
   * @throws {DispatchFailure} exit 2 on a name containing `:`.
   */
  async remove(configPath, ...names) {
    return this._apply(await this._labelConfig.remove(this._resolve(configPath), names));
  }

  /**
   * Upsert the given pairs by name.
   * @param {string} configPath - the config file's path.
   * @param {...string} pairs - `<name>:<color>` pairs.
   * @returns {Promise<string>} `''` (no stdout).
   * @throws {DispatchFailure} exit 2 on an invalid pair.
   */
  async add(configPath, ...pairs) {
    return this._apply(await this._labelConfig.add(this._resolve(configPath), pairs));
  }

  /**
   * Resolve `configPath` against the context's `repoPath` (a no-op for
   * the absolute path the shim always passes).
   * @param {string} configPath - the config file's path.
   * @returns {string} the absolute path.
   * @private
   */
  _resolve(configPath) {
    return path.resolve(this._repoContext.repoPath, configPath);
  }

  /**
   * Map a service result to the command's output contract.
   * @param {string|null} error - the service's error message, if any.
   * @returns {string} `''` on success.
   * @throws {DispatchFailure} exit 2 after writing `error` to stderr.
   * @private
   */
  _apply(error) {
    if (error !== null) {
      process.stderr.write(`${error}\n`);
      throw new DispatchFailure('', 2);
    }

    return '';
  }
}

export default InitClaudeWriteLabelConfig;
