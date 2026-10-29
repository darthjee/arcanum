import { createTempDir, removeTempDir } from './tempDir.js';

/**
 * Isolate the global config tier (`${CLAUDE_CONFIG_DIR}/arcanum-config.json`)
 * for the enclosing `describe`: registers a `beforeAll` creating an
 * empty temp dir and an `afterAll` removing it, so commands run with
 * the returned env never read the developer's real global config.
 * Call it inside a `describe` block (not at module top level, where
 * jasmine would apply the hooks to every spec in the run).
 * @returns {function(): object} returns `process.env` with
 *   `CLAUDE_CONFIG_DIR` pointed at the isolated (empty) dir — only
 *   valid once the `beforeAll` hook has run.
 */
export function isolateGlobalConfig() {
  const state = {};

  beforeAll(async () => {
    state.dir = await createTempDir('arcanum-core-global-config-');
  });

  afterAll(async () => {
    await removeTempDir(state.dir);
  });

  return () => ({ ...process.env, CLAUDE_CONFIG_DIR: state.dir });
}
