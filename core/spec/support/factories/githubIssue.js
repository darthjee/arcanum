import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

/**
 * @param {string} name - the fixture file's name.
 * @returns {Promise<object>} the parsed fixture JSON.
 */
export async function loadFixture(name) {
  return JSON.parse(await readFile(path.join(fixturesDir, name), 'utf8'));
}

/**
 * @param {object} [overrides] - collaborator overrides.
 * @returns {object} a set of stub collaborators for GithubIssue.
 */
export function stubDeps(overrides = {}) {
  return {
    origin: {
      resolve: async () => ({ domain: 'github.com', repo: 'darthjee/arcanum' }),
      resolveWithRef: async () => ({ domain: 'github.com', repo: 'darthjee/arcanum', repoRef: 'darthjee/arcanum' })
    },
    githubToken: { get: async () => 'fake-token' },
    ...overrides
  };
}
