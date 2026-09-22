import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createTempDir, removeTempDir } from '../utils/tempDir.js';

/**
 * Wires up the `beforeEach`/`afterEach` temp-repo lifecycle shared by the
 * `arcanum-split-issue` command specs (and `IssueState_spec.js`): creates a
 * fresh temp dir before each example, optionally seeds a file into it, and
 * removes it afterwards.
 * @param {object} [options] - fixture options.
 * @param {string} [options.prefix] - temp dir prefix, forwarded to
 *   `createTempDir` (falls back to its own default when omitted).
 * @param {object} [options.seedFile] - a file to seed into the temp repo,
 *   as `{ name, content }` — `name` is joined onto the temp repo path and
 *   `content` defaults to the empty string when omitted.
 * @returns {object} a mutable state object — `{ repoPath, seedFilePath }` —
 *   populated once `beforeEach` runs; read from inside `it` blocks the same
 *   way the specs previously read their own closure variables.
 */
export function splitIssueCommandFixture({ prefix, seedFile } = {}) {
  const state = { repoPath: undefined, seedFilePath: undefined };

  beforeEach(async () => {
    state.repoPath = await createTempDir(prefix);

    if (seedFile) {
      state.seedFilePath = path.join(state.repoPath, seedFile.name);
      await writeFile(state.seedFilePath, seedFile.content ?? '');
    }
  });

  afterEach(async () => {
    await removeTempDir(state.repoPath);
  });

  return state;
}
