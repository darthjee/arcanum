import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import AutoFixAllQueue from '../../../lib/commands/auto-fix-all/AutoFixAllQueue.js';
import Lock from '../../../lib/utils/file/Lock.js';
import RepoContext from '../../../lib/context/RepoContext.js';
import RepoContextFactory from '../../../lib/context/RepoContextFactory.js';
import { fakeFetch } from '../utils/fakeFetch.js';

export const REPO = 'darthjee/arcanum';
export const TOKEN = 'fake-token';

/**
 * Build an `AutoFixAllQueue` wired through a fake-backed `RepoContext` +
 * `RepoContextFactory`, with a fast `Lock`/poll interval/no-op `sleepFn`
 * suited to specs.
 * @param {string} dir - the temp repo path backing the `RepoContext`.
 * @param {object} [overrides] - per-test wiring overrides.
 * @returns {AutoFixAllQueue} the assembled command instance.
 */
export function createAutoFixAllQueue(dir, overrides = {}) {
  const {
    repoPath = dir,
    origin = { resolveWithRef: async () => ({ domain: 'github.com', repo: REPO, repoRef: REPO }) },
    githubToken = { get: async () => TOKEN },
    fetchFn = fakeFetch(),
    ...rest
  } = overrides;

  const repoContext = new RepoContext({ repoPath, origin, githubToken });

  return new AutoFixAllQueue(repoContext, {
    lock: new Lock({ sleepMs: 5 }),
    repoContextFactory: new RepoContextFactory({ fetchFn }),
    pollIntervalMs: 5,
    sleepFn: async () => {},
    ...rest
  });
}

/**
 * Write the given entries to the queue file, creating its parent
 * directory first.
 * @param {string} queueFile - the queue file's absolute path.
 * @param {Array} entries - the queue entries to persist.
 * @returns {Promise<void>} resolves once the file is written.
 */
export async function writeQueueFile(queueFile, entries) {
  await mkdir(path.dirname(queueFile), { recursive: true });
  await writeFile(queueFile, JSON.stringify(entries));
}

/**
 * Read and parse the queue file's current contents.
 * @param {string} queueFile - the queue file's absolute path.
 * @returns {Promise<Array>} the parsed queue entries.
 */
export async function readQueueFile(queueFile) {
  return JSON.parse(await readFile(queueFile, 'utf8'));
}
