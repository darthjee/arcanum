import PrOperations from '../../../lib/utils/github/PrOperations.js';
import { createRepoContextMock } from './repoContextFactory.js';

export const REPO = 'darthjee/arcanum';

/**
 * Build a fake `Git` facade, answering `currentBranch`/
 * `issueFromCurrentBranch` from `branch`.
 * @param {object} [opts] - behavior overrides.
 * @param {string} [opts.branch] - the current branch's name.
 * @returns {object} a fake `Git` facade.
 */
export function fakeGit({ branch = 'issue-5' } = {}) {
  const idMatch = branch.match(/^issue-(\d+)$/);
  const issue = idMatch ? { id: idMatch[1], branch } : null;

  return {
    currentBranch: jasmine.createSpy().and.resolveTo(branch),
    issueFromCurrentBranch: jasmine.createSpy().and.resolveTo(issue)
  };
}

/**
 * Build a fake `GitHubClient`, routing every call to a configurable
 * canned response. Every method drops `repo`/`token`/`repoRef`, per the
 * context-bound `GitHubClient` from step 03.
 * @param {object} [config] - behavior overrides.
 * @param {object} [config.pull] - the `getPr` resolved pull request, or
 *   `null` to reject with the not-found error.
 * @param {Array} [config.commits] - the `getPrCommits` resolved commits.
 * @param {object} [config.user] - the `getCurrentUser` resolved user.
 * @param {boolean} [config.mergeOk] - whether `mergePr` resolves.
 * @returns {object} a fake `GitHubClient`.
 */
export function fakeGithubClient({
  pull = { number: 7, title: 'My PR', html_url: 'https://github.com/darthjee/arcanum/pull/7', state: 'open' },
  commits = [],
  user = { login: 'fake-merger' },
  mergeOk = true
} = {}) {
  return {
    getPr: jasmine.createSpy().and.callFake(async () => {
      if (!pull) {
        throw new Error(`Error: no pull request found for the current branch on ${REPO}`);
      }

      return pull;
    }),
    getPrCommits: jasmine.createSpy().and.resolveTo(commits),
    getCurrentUser: jasmine.createSpy().and.resolveTo(user),
    getPrHeadSha: jasmine.createSpy().and.resolveTo('abc123'),
    getCheckRuns: jasmine.createSpy().and.resolveTo([]),
    mergePr: jasmine.createSpy().and.callFake(async () => {
      if (!mergeOk) {
        throw new Error(`could not merge PR #${pull.number} on ${REPO}`);
      }
    }),
    deleteBranch: jasmine.createSpy().and.resolveTo(undefined)
  };
}

/**
 * Build a `PrOperations` wired to fake `Git`/`GitHubClient` collaborators
 * plus a spy-backed `RepoContext`.
 * @param {object} [opts] - behavior overrides.
 * @param {string} [opts.branch] - the current branch's name, forwarded to
 *   `fakeGit`.
 * @param {object} [opts.pull] - the `getPr` resolved pull request,
 *   forwarded to `fakeGithubClient`.
 * @param {Array} [opts.commits] - the `getPrCommits` resolved commits,
 *   forwarded to `fakeGithubClient`.
 * @param {object} [opts.user] - the `getCurrentUser` resolved user,
 *   forwarded to `fakeGithubClient`.
 * @param {boolean} [opts.mergeOk] - whether `mergePr` resolves, forwarded
 *   to `fakeGithubClient`.
 * @param {object} [opts.configValues] - `key -> value` map answered by the
 *   context's `configChain.read`.
 * @param {object} [opts.issueStateValues] - `field -> value` map answered
 *   by the context's `issueStateService.get`.
 * @returns {object} `{ prOperations, githubClient, context }`.
 */
export function newPrOperations({ branch, pull, commits, user, mergeOk, configValues = {}, issueStateValues = {} } = {}) {
  const context = createRepoContextMock({
    origin: { resolveWithRef: jasmine.createSpy() },
    githubToken: { get: jasmine.createSpy() },
    issueStateService: { get: jasmine.createSpy().and.callFake(async (id, field) => issueStateValues[field] ?? '') },
    configChain: { read: jasmine.createSpy().and.callFake(async (repoPath, scope, key) => configValues[key]) }
  });
  const githubClient = fakeGithubClient({ pull, commits, user, mergeOk });
  const prOperations = new PrOperations({ context, git: fakeGit({ branch }), githubClient });

  return { prOperations, githubClient, context };
}
