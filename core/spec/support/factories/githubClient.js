import GitHubClient from '../../../lib/utils/github/GitHubClient.js';
import { createRepoContextMock } from './repoContextFactory.js';

export const REPO = 'darthjee/arcanum';
export const TOKEN = 'fake-token';

/**
 * Build a `GitHubClient` bound to a spy-backed `RepoContext` whose origin
 * resolves to `REPO` on github.com and whose GitHub token resolves to
 * `TOKEN`.
 * @param {(url: string, options?: object) => Promise<object>} fetchFn - the
 *   (fake) `fetch` the client issues its requests through.
 * @param {object} [git] - the (fake) `Git` facade, used by `createPr`.
 * @returns {GitHubClient} the client under test.
 */
export function newGitHubClient(fetchFn, git) {
  const context = createRepoContextMock({
    origin: { resolveWithRef: jasmine.createSpy().and.resolveTo({ domain: 'github.com', repo: REPO, repoRef: REPO }) },
    githubToken: { get: jasmine.createSpy().and.resolveTo(TOKEN) }
  });

  return new GitHubClient({ context, fetchFn, timeoutMs: 5, git });
}
