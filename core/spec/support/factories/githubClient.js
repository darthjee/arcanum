import GitHubClient from '../../../lib/utils/github/GitHubClient.js';
import GitHubTransport from '../../../lib/utils/github/GitHubTransport.js';
import { createRepoContextMock } from './repoContextFactory.js';

export const REPO = 'darthjee/arcanum';
export const TOKEN = 'fake-token';
const TIMEOUT_MS = 5;

/**
 * Build a spy-backed `RepoContext` whose origin resolves to `REPO` on
 * github.com and whose GitHub token resolves to `TOKEN`.
 * @returns {object} the context mock.
 */
function newGitHubContext() {
  return createRepoContextMock({
    origin: { resolveWithRef: jasmine.createSpy().and.resolveTo({ domain: 'github.com', repo: REPO, repoRef: REPO }) },
    githubToken: { get: jasmine.createSpy().and.resolveTo(TOKEN) }
  });
}

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
  return new GitHubClient({ context: newGitHubContext(), fetchFn, timeoutMs: TIMEOUT_MS, git });
}

/**
 * Build a `GitHubTransport` bound to the same spy-backed context as
 * `newGitHubClient`.
 * @param {(url: string, options?: object) => Promise<object>} fetchFn - the
 *   (fake) `fetch` the transport issues its requests through.
 * @returns {GitHubTransport} the transport.
 */
export function newGitHubTransport(fetchFn) {
  return new GitHubTransport({ context: newGitHubContext(), fetchFn, timeoutMs: TIMEOUT_MS });
}

/**
 * Build one of `GitHubClient`'s focused clients (e.g.
 * `GitHubPullRequestClient`) over a `newGitHubTransport(fetchFn)`.
 * @param {new (deps: object) => object} ClientClass - the focused client class.
 * @param {(url: string, options?: object) => Promise<object>} fetchFn - the
 *   (fake) `fetch` the client issues its requests through.
 * @param {object} [extraDeps] - extra constructor deps (e.g. `{ git }`).
 * @returns {object} the client under test.
 */
export function newFocusedClient(ClientClass, fetchFn, extraDeps = {}) {
  return new ClientClass({ transport: newGitHubTransport(fetchFn), ...extraDeps });
}
