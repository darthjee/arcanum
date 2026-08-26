import { readFile } from 'node:fs/promises';

/**
 * Reads and parses a JSON file, degrading to `{}` for any failure
 * (missing file, empty content, invalid JSON) instead of throwing.
 */
class JsonReader {
  /**
   * @param {string} stateFile - the JSON file's path.
   * @returns {Promise<object>} the parsed content, or `{}` if
   *   absent/empty/invalid.
   */
  async read(stateFile) {
    let raw;

    try {
      raw = await readFile(stateFile, 'utf8');
    } catch {
      return {};
    }

    if (!raw.trim()) {
      return {};
    }

    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
}

export default JsonReader;
