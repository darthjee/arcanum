import { newGitHubClient, REPO, TOKEN } from '../../../support/factories/githubClient.js';

describe('GitHubClient (pull request mutations)', () => {
  describe('#mergePr', () => {
    it('PUTs the given payload to the merge endpoint with the auth + content-type headers', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: true });
      const client = newGitHubClient(fetchFn);
      const payload = { merge_method: 'squash', commit_title: 'My PR (#7)' };

      await client.mergePr(7, payload);

      expect(fetchFn).toHaveBeenCalledWith(`https://api.github.com/repos/${REPO}/pulls/7/merge`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: jasmine.anything()
      });
    });

    it('throws when the response is not ok', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: false });
      const client = newGitHubClient(fetchFn);

      await expectAsync(client.mergePr(7, {})).toBeRejectedWithError(
        'could not merge PR #7 on darthjee/arcanum'
      );
    });

    it('throws the domain error when fetch itself rejects (e.g. timeout)', async () => {
      const fetchFn = jasmine.createSpy().and.rejectWith(new Error('fetch failed'));
      const client = newGitHubClient(fetchFn);

      await expectAsync(client.mergePr(7, {})).toBeRejectedWithError(
        'could not merge PR #7 on darthjee/arcanum'
      );
    });
  });

  describe('#markPrReady', () => {
    it('POSTs the markPullRequestReadyForReview mutation with the node id and the auth header', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: true, json: async () => ({ data: {} }) });
      const client = newGitHubClient(fetchFn);

      await client.markPrReady('PR_kwABC');

      expect(fetchFn).toHaveBeenCalledWith('https://api.github.com/graphql', jasmine.objectContaining({
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
      }));

      const [, options] = fetchFn.calls.mostRecent().args;
      const payload = JSON.parse(options.body);

      expect(payload.variables).toEqual({ id: 'PR_kwABC' });
      expect(payload.query).toContain('markPullRequestReadyForReview');
    });

    it('throws when the response is not ok', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: false });
      const client = newGitHubClient(fetchFn);

      await expectAsync(client.markPrReady('PR_kwABC')).toBeRejectedWithError(
        'could not mark pull request ready for review'
      );
    });

    it('throws when fetch itself rejects', async () => {
      const client = newGitHubClient(jasmine.createSpy().and.rejectWith(new Error('fetch failed')));

      await expectAsync(client.markPrReady('PR_kwABC')).toBeRejectedWithError(
        'could not mark pull request ready for review'
      );
    });

    it('throws when the GraphQL response reports errors', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({
        ok: true,
        json: async () => ({ errors: [{ message: 'not found' }] })
      });
      const client = newGitHubClient(fetchFn);

      await expectAsync(client.markPrReady('PR_kwABC')).toBeRejectedWithError(
        'could not mark pull request ready for review'
      );
    });
  });

  describe('#deleteBranch', () => {
    it('DELETEs the branch ref with the auth header', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: true });
      const client = newGitHubClient(fetchFn);

      await client.deleteBranch('issue-5');

      expect(fetchFn).toHaveBeenCalledWith(`https://api.github.com/repos/${REPO}/git/refs/heads/issue-5`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${TOKEN}` },
        signal: jasmine.anything()
      });
    });

    it('tolerates a non-ok response', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: false });
      const client = newGitHubClient(fetchFn);

      await expectAsync(client.deleteBranch('issue-5')).toBeResolved();
    });

    it('tolerates a rejected fetch call', async () => {
      const fetchFn = jasmine.createSpy().and.rejectWith(new Error('network error'));
      const client = newGitHubClient(fetchFn);

      await expectAsync(client.deleteBranch('issue-5')).toBeResolved();
    });
  });
});
