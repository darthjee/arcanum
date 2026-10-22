import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/**
 * Create a fresh throwaway temp directory for a spec to use as a repo
 * checkout / state dir. Callers are responsible for calling
 * `removeTempDir` (typically in an `afterEach`).
 * @param {string} [prefix] - prefix for the temp dir name.
 * @returns {Promise<string>} the created directory's absolute path.
 */
export async function createTempDir(prefix = 'arcanum-core-spec-') {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

/**
 * Remove a temp directory created by `createTempDir`.
 * @param {string} dir - the directory to remove.
 * @returns {Promise<void>} resolves once removed.
 */
export async function removeTempDir(dir) {
  await rm(dir, { recursive: true, force: true });
}
