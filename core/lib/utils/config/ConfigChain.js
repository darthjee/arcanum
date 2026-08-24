import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Native equivalent of `arcanum/_lib/config_chain.sh`'s
 * `config_chain_read`: resolves a namespaced config key across the
 * three arcanum config tiers, in precedence order — local state
 * (`.claude/state/arcanum-config.json`), repo config
 * (`.claude/configuration/arcanum-repo-config.json`), then global
 * config (`${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json`).
 * Extracted as a standalone, reusable module (see
 * `core/lib/Tags.js`/`core/lib/GithubToken.js` for the same
 * one-entrypoint-then-exported-for-reuse precedent) rather than
 * embedded in whichever entrypoint needed it first.
 */
class ConfigChain {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {object} [deps.env] - the environment to resolve
   *   `CLAUDE_CONFIG_DIR`/`HOME` from (defaults to `process.env`).
   */
  constructor({ env = process.env } = {}) {
    this._env = env;
  }

  /**
   * Reads `<namespace>.<key1>[, <namespace>.<key2>, ...]` across all
   * three config tiers, in order, returning the first present-and-
   * non-null value found. Within each tier, `keys` are tried in order
   * and the first one that resolves there wins; only once every key
   * has been tried and found absent/null in the current tier does the
   * chain advance to the next tier — a tier is always fully resolved
   * before the next one is consulted. Each key may itself be a
   * dot-separated nested path (e.g. `"agents.architect"`), resolved as
   * a nested lookup under `namespace`. A JSON `null` value at any
   * tier/key is treated the same as absent and falls through; an
   * explicit empty string (`""`) is a real value and stops the chain
   * there. A missing file, an unreadable file, or malformed JSON at
   * any tier never throws — it's treated as "no value at this tier"
   * and the chain continues, matching every other native config
   * reader's fail-open convention (`RepoConfig.js`, `AutoFixAllConfig.js`).
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} namespace - the top-level config namespace.
   * @param {...string} keys - one or more keys (each possibly a
   *   dot-separated nested path) to try, in order, within each tier.
   * @returns {Promise<*>} the raw resolved value, or `undefined` when
   *   every key in every tier is absent/null.
   */
  async read(repoPath, namespace, ...keys) {
    for (const file of this._tierFiles(repoPath)) {
      if (!file) {
        continue;
      }

      const config = await this._readJson(file);

      if (!config) {
        continue;
      }

      const namespaceSection = config[namespace];

      for (const key of keys) {
        const value = this._resolveKey(namespaceSection, key);

        if (value !== undefined && value !== null) {
          return value;
        }
      }
    }

    return undefined;
  }

  /**
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {string[]} the three tier files' paths, in precedence
   *   order (the global tier's path may be `null` when unresolvable).
   */
  _tierFiles(repoPath) {
    return [
      path.join(repoPath, '.claude', 'state', 'arcanum-config.json'),
      path.join(repoPath, '.claude', 'configuration', 'arcanum-repo-config.json'),
      this._globalConfigFile()
    ];
  }

  /**
   * @returns {string|null} the resolved global config file's path, or
   *   `null` when neither `CLAUDE_CONFIG_DIR` nor `HOME` is set.
   */
  _globalConfigFile() {
    const dir = this._env.CLAUDE_CONFIG_DIR || (this._env.HOME ? path.join(this._env.HOME, '.claude') : null);

    return dir ? path.join(dir, 'arcanum-config.json') : null;
  }

  /**
   * Resolves `key` (a flat key, or a dot-separated nested path) under
   * `section`, mirroring `repo_config_read`/`global_config_read`'s
   * `getpath`/direct-indexing split.
   * @param {*} section - the namespace's section value (may be
   *   `undefined`/`null`/non-object).
   * @param {string} key - the key to resolve.
   * @returns {*} the resolved value, or `undefined` when `section`
   *   isn't a usable object or the path doesn't resolve.
   */
  _resolveKey(section, key) {
    if (section === null || section === undefined || typeof section !== 'object') {
      return undefined;
    }

    if (!key.includes('.')) {
      return section[key];
    }

    let current = section;

    for (const part of key.split('.')) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }

      current = current[part];
    }

    return current;
  }

  /**
   * @param {string} file - the JSON file's path.
   * @returns {Promise<object|null>} the parsed JSON content when it's a
   *   non-null object, `null` when missing/unreadable/malformed/not an
   *   object.
   */
  async _readJson(file) {
    let raw;

    try {
      raw = await readFile(file, 'utf8');
    } catch {
      return null;
    }

    try {
      const parsed = JSON.parse(raw);

      return parsed !== null && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }
}

export default ConfigChain;
