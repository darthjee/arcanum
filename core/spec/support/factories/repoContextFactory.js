import RepoContext from '../../../lib/context/RepoContext.js';

/**
 * Build a `RepoContext` wired to jasmine spies for its 5 collaborators,
 * for reuse across specs that only care about the `RepoContext`
 * boundary (not `Origin`/`GithubToken`/`IssueStateService`/
 * `ConfigChain`/`GithubIssueService`'s own internals).
 * @param {object} [opts] - behavior overrides.
 * @param {string} [opts.repoPath] - the target repo's local checkout
 *   path.
 * @param {object} [opts.origin] - `origin` spy overrides.
 * @param {object} [opts.githubToken] - `githubToken` spy overrides.
 * @param {object} [opts.issueStateService] - `issueStateService` spy
 *   overrides.
 * @param {object} [opts.configChain] - `configChain` spy overrides.
 * @param {object} [opts.githubIssueService] - `githubIssueService` spy
 *   overrides.
 * @returns {RepoContext} a `RepoContext` instance ready for spec use.
 */
export function createRepoContextMock({ repoPath = '/fake/repo', ...overrides } = {}) {
  const origin = { resolveWithRef: jasmine.createSpy(), resolve: jasmine.createSpy(), ...overrides.origin };
  const githubToken = { get: jasmine.createSpy(), ...overrides.githubToken };
  const issueStateService = { get: jasmine.createSpy(), appendJson: jasmine.createSpy(), ...overrides.issueStateService };
  const configChain = { read: jasmine.createSpy(), ...overrides.configChain };
  const githubIssueService = { create: jasmine.createSpy(), ...overrides.githubIssueService };

  return new RepoContext({ repoPath, origin, githubToken, issueStateService, configChain, githubIssueService });
}
