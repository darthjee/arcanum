import PrOperations from '../../../../lib/utils/github/PrOperations.js';
import { createRepoContextMock } from '../../../support/factories/repoContextFactory.js';

const REPO = 'darthjee/arcanum';
const REPO_REF = 'darthjee/arcanum';
const TOKEN = 'fake-token';

/**
 * Build a fake `GitClient`, answering `currentBranch` with `branch`.
 * @param {object} [opts] - behavior overrides.
 * @param {string} [opts.branch] - the current branch's name.
 * @returns {object} a fake `GitClient`.
 */
function fakeGitClient({ branch = 'issue-5' } = {}) {
  return { currentBranch: jasmine.createSpy().and.resolveTo(branch) };
}

/**
 * Build a fake `GitHubClient`, routing every call to a configurable
 * canned response.
 * @param {object} [config] - behavior overrides.
 * @param {object} [config.pull] - the `getPr` resolved pull request, or
 *   `null` to reject with the not-found error.
 * @param {Array} [config.commits] - the `getPrCommits` resolved commits.
 * @param {object} [config.user] - the `getCurrentUser` resolved user.
 * @param {boolean} [config.mergeOk] - whether `mergePr` resolves.
 * @returns {object} a fake `GitHubClient`.
 */
function fakeGithubClient({
  pull = { number: 7, title: 'My PR', html_url: 'https://github.com/darthjee/arcanum/pull/7', state: 'open' },
  commits = [],
  user = { login: 'fake-merger' },
  mergeOk = true
} = {}) {
  return {
    getPr: jasmine.createSpy().and.callFake(async (repo, branch, token, repoRef) => {
      if (!pull) {
        throw new Error(`Error: no pull request found for the current branch on ${repoRef}`);
      }

      return pull;
    }),
    getPrCommits: jasmine.createSpy().and.resolveTo(commits),
    getCurrentUser: jasmine.createSpy().and.resolveTo(user),
    mergePr: jasmine.createSpy().and.callFake(async () => {
      if (!mergeOk) {
        throw new Error(`could not merge PR #${pull.number} on ${REPO}`);
      }
    }),
    deleteBranch: jasmine.createSpy().and.resolveTo(undefined)
  };
}

describe('PrOperations', () => {
  function newPrOperations({ branch, pull, commits, user, mergeOk, configValues = {}, issueStateValues = {} } = {}) {
    const context = createRepoContextMock({
      origin: { resolveWithRef: jasmine.createSpy().and.resolveTo({ domain: 'github.com', repo: REPO, repoRef: REPO_REF }) },
      githubToken: { get: jasmine.createSpy().and.resolveTo(TOKEN) },
      issueState: { get: jasmine.createSpy().and.callFake(async (repoPath, id, field) => issueStateValues[field] ?? '') },
      configChain: { read: jasmine.createSpy().and.callFake(async (repoPath, scope, key) => configValues[key]) }
    });
    const githubClient = fakeGithubClient({ pull, commits, user, mergeOk });
    const prOperations = new PrOperations({ context, gitClient: fakeGitClient({ branch }), githubClient });

    return { prOperations, githubClient };
  }

  describe('#prNumber', () => {
    it('returns the cached pr_id when the branch matches issue-<id> and a cache entry exists', async () => {
      const { prOperations } = newPrOperations({ branch: 'issue-5', issueStateValues: { pr_id: '99' } });

      await expectAsync(prOperations.prNumber()).toBeResolvedTo('99\n');
    });

    it('falls back to a REST lookup when the branch does not match issue-<id>', async () => {
      const { prOperations } = newPrOperations({ branch: 'some-other-branch' });

      await expectAsync(prOperations.prNumber()).toBeResolvedTo('7\n');
    });

    it('falls back to a REST lookup when the branch matches issue-<id> but no cache entry exists', async () => {
      const { prOperations } = newPrOperations({ branch: 'issue-5' });

      await expectAsync(prOperations.prNumber()).toBeResolvedTo('7\n');
    });

    it('rejects with the not-found error when no pull request is found', async () => {
      const { prOperations } = newPrOperations({ branch: 'some-other-branch', pull: null });

      await expectAsync(prOperations.prNumber()).toBeRejectedWithError(
        'Error: no pull request found for the current branch on darthjee/arcanum'
      );
    });
  });

  describe('#prState', () => {
    it('prints STATE=OPEN for an open, unmerged pull request', async () => {
      const { prOperations } = newPrOperations({ pull: { number: 7, state: 'open', merged: false, merged_at: null } });

      await expectAsync(prOperations.prState()).toBeResolvedTo('STATE=OPEN\n');
    });

    it('prints STATE=MERGED for a merged pull request, even though its raw state is "closed"', async () => {
      const { prOperations } = newPrOperations({
        pull: { number: 7, state: 'closed', merged: true, merged_at: '2024-01-01T00:00:00Z' }
      });

      await expectAsync(prOperations.prState()).toBeResolvedTo('STATE=MERGED\n');
    });

    it('prints STATE=CLOSED for a closed, unmerged pull request', async () => {
      const { prOperations } = newPrOperations({ pull: { number: 7, state: 'closed', merged: false, merged_at: null } });

      await expectAsync(prOperations.prState()).toBeResolvedTo('STATE=CLOSED\n');
    });

    it('rejects with the not-found error when no pull request is found', async () => {
      const { prOperations } = newPrOperations({ pull: null });

      await expectAsync(prOperations.prState()).toBeRejectedWithError(
        'Error: no pull request found for the current branch on darthjee/arcanum'
      );
    });
  });

  describe('#prMerge', () => {
    const PULL = { number: 7, title: 'My PR', html_url: 'https://github.com/darthjee/arcanum/pull/7', state: 'open' };

    it('merges with an empty body by default (merge_body_mode absent) and prints the PR URL', async () => {
      const { prOperations, githubClient } = newPrOperations({ pull: PULL });

      await expectAsync(prOperations.prMerge()).toBeResolvedTo(`${PULL.html_url}\n`);

      expect(githubClient.mergePr).toHaveBeenCalledWith(
        REPO, 7, TOKEN, { merge_method: 'squash', commit_title: 'My PR (#7)', commit_message: '' }
      );
    });

    it('uses the cached pr_id/pr_url when the branch matches issue-<id> and both are cached, but still re-fetches the title via REST', async () => {
      const { prOperations, githubClient } = newPrOperations({
        branch: 'issue-5',
        pull: PULL,
        issueStateValues: { pr_id: '123', pr_url: 'https://cached/url' }
      });

      await expectAsync(prOperations.prMerge()).toBeResolvedTo('https://cached/url\n');

      const mergeCall = githubClient.mergePr.calls.mostRecent();

      expect(mergeCall.args[0]).toEqual(REPO);
      expect(mergeCall.args[1]).toEqual('123');
      expect(mergeCall.args[3].commit_title).toEqual('My PR (#123)');
    });

    it('omits commit_message entirely in "full" mode', async () => {
      const { prOperations, githubClient } = newPrOperations({ pull: PULL, configValues: { merge_body_mode: 'full' } });

      await prOperations.prMerge();

      const mergeCall = githubClient.mergePr.calls.mostRecent();

      expect(mergeCall.args[3]).toEqual({ merge_method: 'squash', commit_title: 'My PR (#7)' });
    });

    it('sends an empty commit_message in "empty" mode', async () => {
      const { prOperations, githubClient } = newPrOperations({ pull: PULL, configValues: { merge_body_mode: 'empty' } });

      await prOperations.prMerge();

      const mergeCall = githubClient.mergePr.calls.mostRecent();

      expect(mergeCall.args[3].commit_message).toEqual('');
    });

    describe('"coauthors" mode', () => {
      it('builds a deduped, email-sorted Co-authored-by block from the PR commits', async () => {
        const commits = [
          { commit: { author: { name: 'Bob', email: 'bob@x.com' } }, author: { login: 'bob' } },
          { commit: { author: { name: 'Alice', email: 'alice@x.com' } }, author: { login: 'alice' } }
        ];
        const { prOperations, githubClient } = newPrOperations({
          pull: PULL,
          commits,
          user: { login: 'merger' },
          configValues: { merge_body_mode: 'coauthors' }
        });

        await prOperations.prMerge();

        const mergeCall = githubClient.mergePr.calls.mostRecent();

        expect(mergeCall.args[3].commit_message).toEqual(
          'Co-authored-by: Alice <alice@x.com>\nCo-authored-by: Bob <bob@x.com>\n'
        );
      });

      it('falls back to "full" mode\'s behavior (omit commit_message) when the resulting list is empty', async () => {
        const commits = [
          { commit: { author: { name: 'Merger', email: 'merger@x.com' } }, author: { login: 'merger' } }
        ];
        const { prOperations, githubClient } = newPrOperations({
          pull: PULL,
          commits,
          user: { login: 'merger' },
          configValues: { merge_body_mode: 'coauthors' }
        });

        await prOperations.prMerge();

        const mergeCall = githubClient.mergePr.calls.mostRecent();

        expect(mergeCall.args[3]).toEqual({ merge_method: 'squash', commit_title: 'My PR (#7)' });
      });
    });

    it('rejects with the merge-failure error when the merge REST call fails', async () => {
      const { prOperations } = newPrOperations({ pull: PULL, mergeOk: false });

      await expectAsync(prOperations.prMerge()).toBeRejectedWithError(
        'Error: could not merge PR #7 on darthjee/arcanum'
      );
    });

    it('deletes the branch ref after a successful merge', async () => {
      const { prOperations, githubClient } = newPrOperations({ branch: 'issue-9', pull: PULL });

      await prOperations.prMerge();

      expect(githubClient.deleteBranch).toHaveBeenCalledWith(REPO, 'issue-9', TOKEN);
    });
  });
});
