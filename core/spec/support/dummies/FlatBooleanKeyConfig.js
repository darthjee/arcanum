import path from 'node:path';
import BooleanKeyConfig from '../../../lib/utils/config/BooleanKeyConfig.js';

/**
 * Minimal `BooleanKeyConfig` subclass for specs: stores every key at the
 * top level of `<repoPath>/config.json`, locked by `<repoPath>/config.lock`.
 */
class FlatBooleanKeyConfig extends BooleanKeyConfig {
  /**
   * @param {string} repoPath - the repo path.
   * @returns {string} the lock file.
   */
  _lockFile(repoPath) {
    return path.join(repoPath, 'config.lock');
  }

  /**
   * @param {string} repoPath - the repo path.
   * @param {string} key - the key.
   * @returns {Promise<string|undefined>} the stored value, stringified.
   */
  async _readValue(repoPath, key) {
    const config = await this._readJson(path.join(repoPath, 'config.json'));

    return key in config ? String(config[key]) : undefined;
  }

  /**
   * @param {string} repoPath - the repo path.
   * @param {string} key - the key.
   * @param {boolean} value - the value.
   * @returns {Promise<{file: string, content: object}>} the write target.
   */
  async _buildUpdate(repoPath, key, value) {
    const file = path.join(repoPath, 'config.json');

    return { file, content: { ...await this._readJson(file), [key]: value } };
  }
}

export default FlatBooleanKeyConfig;
