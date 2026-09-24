import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** Default label-config path, relative to the caller's working directory. */
export const DEFAULT_LABEL_CONFIG_PATH = '.claude/state/init-claude-config.json';

/**
 * The 22 default `<name>:<color>` pairs, in
 * `init-claude/scripts/lib/label_config.sh`'s order.
 */
export const DEFAULT_LABEL_PAIRS = Object.freeze([
  'Bug:b60205',
  'Documentation:0075ca',
  'Enqueued:e8e639',
  'Feature:e9a20f',
  'Ready:247b61',
  'Refined:418193',
  'Ready for Work:ffaa04',
  'Refactor:983e7f',
  'shipit:0e8a16',
  'Created:024fa5',
  'Working:c314d7',
  'Question:5319e7',
  'Fetched:bfd4f2',
  'Idea:fbca04',
  'Writting:79ff12',
  'Enhancing:335ecc',
  'PR:31a5e0',
  'auto-shipit:ffb004',
  'Automated:d93f0b',
  'Planning:c5def5',
  'Split:000000',
  'Spawned:6a737d'
]);

const HEX_COLOR = /^[0-9A-Fa-f]{6}$/;

/**
 * Native port of `init-claude/scripts/lib/label_config.sh`: reads and
 * writes the `{"labels":[{"name":..,"color":..}]}` label-config JSON.
 * Validation returns error messages instead of writing to stderr — the
 * command layer owns stderr and exit codes.
 */
class LabelConfig {
  /**
   * Split a `<name>:<color>` pair on its first `:`, like the shell's
   * `${pair%%:*}` / `${pair#*:}`.
   * @param {string} pair - the raw pair.
   * @returns {{name: string, color: string}} the split pair.
   */
  splitPair(pair) {
    const index = pair.indexOf(':');

    if (index === -1) {
      return { name: pair, color: pair };
    }

    return { name: pair.slice(0, index), color: pair.slice(index + 1) };
  }

  /**
   * Port of `label_config_validate_pair`.
   * @param {string} pair - a `<name>:<color>` pair.
   * @returns {string|null} `null` when valid, else the exact stderr
   *   message (without trailing newline).
   */
  validatePair(pair) {
    if (!pair.includes(':')) {
      return `Error: invalid pair '${pair}' — expected <label name>:<hex color>`;
    }

    const { name, color } = this.splitPair(pair);

    if (name === '') {
      return `Error: invalid pair '${pair}' — label name is empty`;
    }

    if (!HEX_COLOR.test(color)) {
      return `Error: invalid color '${color}' for label '${name}' — expected exactly 6 hex digits`;
    }

    return null;
  }

  /**
   * Validate every pair, returning the first error message.
   * @param {string[]} pairs - `<name>:<color>` pairs.
   * @returns {string|null} the first error message, or `null`.
   */
  validatePairs(pairs) {
    for (const pair of pairs) {
      const error = this.validatePair(pair);

      if (error !== null) {
        return error;
      }
    }

    return null;
  }

  /**
   * Port of `label_config_read_pairs`. A missing, zero-size or
   * unparseable file, or a missing/null/empty `labels` array, yields
   * `[]`. Entries are rebuilt as `.name + ":" + .color` and re-split on
   * the first `:`, like the shell's round-trip.
   * @param {string} configPath - the config file's path.
   * @returns {Promise<Array<{name: string, color: string}>>} the labels.
   */
  async readPairs(configPath) {
    const labels = await this._readLabels(configPath);

    return labels.map((label) => {
      const entry = label ?? {};
      const line = `${entry.name ?? ''}:${entry.color ?? ''}`;

      return this.splitPair(line);
    });
  }

  /**
   * Port of `label_config_write`'s writing half: `mkdir -p` the parent,
   * write `<path>.tmp`, then rename it over `configPath`.
   * @param {string} configPath - the config file's path.
   * @param {Array<{name: string, color: string}>} pairs - the labels.
   * @returns {Promise<void>}
   */
  async write(configPath, pairs) {
    const labels = pairs.map(({ name, color }) => ({ name, color }));
    const content = `${JSON.stringify({ labels }, null, 2)}\n`;
    const tmpPath = `${configPath}.tmp`;

    await mkdir(path.dirname(configPath), { recursive: true });
    await writeFile(tmpPath, content);
    await rename(tmpPath, configPath);
  }

  /**
   * Port of `label_config_write` used as `replace`: validates, then
   * overwrites the whole array.
   * @param {string} configPath - the config file's path.
   * @param {string[]} rawPairs - `<name>:<color>` pairs.
   * @returns {Promise<string|null>} an error message (nothing written),
   *   or `null` on success.
   */
  async replace(configPath, rawPairs) {
    const error = this.validatePairs(rawPairs);

    if (error !== null) {
      return error;
    }

    await this.write(configPath, rawPairs.map((pair) => this.splitPair(pair)));

    return null;
  }

  /**
   * Port of `label_config_ensure_defaults`: writes the defaults when the
   * config is missing/empty/malformed or has no labels.
   * @param {string} configPath - the config file's path.
   * @returns {Promise<void>}
   */
  async ensureDefaults(configPath) {
    const labels = await this._readLabels(configPath);

    if (labels.length === 0) {
      await this.write(configPath, DEFAULT_LABEL_PAIRS.map((pair) => this.splitPair(pair)));
    }
  }

  /**
   * Port of `label_config_remove`: drops entries whose name exactly
   * matches any given name, then rewrites the file (even when empty).
   * @param {string} configPath - the config file's path.
   * @param {string[]} names - bare label names.
   * @returns {Promise<string|null>} an error message (nothing written),
   *   or `null` on success.
   */
  async remove(configPath, names) {
    const invalid = names.find((name) => name.includes(':'));

    if (invalid !== undefined) {
      return `Error: invalid label name '${invalid}' — remove takes bare names, not <name>:<color> pairs`;
    }

    const existing = await this.readPairs(configPath);
    const remaining = existing.filter(({ name }) => !names.includes(name));

    await this.write(configPath, remaining);

    return null;
  }

  /**
   * Port of `label_config_add`: upserts each pair by exact name,
   * replacing in place or appending, then rewrites the file.
   * @param {string} configPath - the config file's path.
   * @param {string[]} rawPairs - `<name>:<color>` pairs.
   * @returns {Promise<string|null>} an error message (nothing written),
   *   or `null` on success.
   */
  async add(configPath, rawPairs) {
    const error = this.validatePairs(rawPairs);

    if (error !== null) {
      return error;
    }

    const existing = await this.readPairs(configPath);

    for (const pair of rawPairs) {
      const incoming = this.splitPair(pair);
      const index = existing.findIndex(({ name }) => name === incoming.name);

      if (index === -1) {
        existing.push(incoming);
      } else {
        existing[index] = incoming;
      }
    }

    await this.write(configPath, existing);

    return null;
  }

  /**
   * Read `.labels` as a non-empty array, or `[]` for any
   * missing/empty/malformed case.
   * @param {string} configPath - the config file's path.
   * @returns {Promise<Array>} the raw label entries.
   * @private
   */
  async _readLabels(configPath) {
    let raw;

    try {
      raw = await readFile(configPath, 'utf8');
    } catch {
      return [];
    }

    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }

    const labels = parsed?.labels;

    return Array.isArray(labels) ? labels : [];
  }
}

export default LabelConfig;
