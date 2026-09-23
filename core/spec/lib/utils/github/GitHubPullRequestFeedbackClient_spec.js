import GitHubPullRequestFeedbackClient from '../../../../lib/utils/github/GitHubPullRequestFeedbackClient.js';
import { newFocusedClient, REPO, TOKEN } from '../../../support/factories/githubClient.js';

const newClient = (fetchFn) => newFocusedClient(GitHubPullRequestFeedbackClient, fetchFn);

describe('GitHubPullRequestFeedbackClient (pull request feedback)', () => {
  describe('#getPrReviews', () => {
    it('requests the pull request\'s reviews', async () => {
      const reviews = [{ user: { login: 'octocat' }, state: 'APPROVED' }];
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: true, json: async () => reviews });
      const client = newClient(fetchFn);

      const result = await client.getPrReviews(7);

      expect(fetchFn).toHaveBeenCalledWith(
        `https://api.github.com/repos/${REPO}/pulls/7/reviews?per_page=100`,
        jasmine.objectContaining({ headers: { Authorization: `Bearer ${TOKEN}` } })
      );
      expect(result).toEqual(reviews);
    });

    it('normalizes a malformed (non-array) response to []', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: true, json: async () => ({}) });
      const client = newClient(fetchFn);

      await expectAsync(client.getPrReviews(7)).toBeResolvedTo([]);
    });

    it('throws when the response is not ok', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: false });
      const client = newClient(fetchFn);

      await expectAsync(client.getPrReviews(7)).toBeRejectedWithError(
        `could not fetch reviews for pull request #7 in ${REPO}`
      );
    });
  });

  describe('#getIssueComments', () => {
    it('requests the pull request\'s conversation comments via the issues endpoint', async () => {
      const comments = [{ user: { login: 'octocat' }, body: 'hi' }];
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: true, json: async () => comments });
      const client = newClient(fetchFn);

      const result = await client.getIssueComments(7);

      expect(fetchFn).toHaveBeenCalledWith(
        `https://api.github.com/repos/${REPO}/issues/7/comments?per_page=100`,
        jasmine.objectContaining({ headers: { Authorization: `Bearer ${TOKEN}` } })
      );
      expect(result).toEqual(comments);
    });

    it('normalizes a malformed (non-array) response to []', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: true, json: async () => ({}) });
      const client = newClient(fetchFn);

      await expectAsync(client.getIssueComments(7)).toBeResolvedTo([]);
    });

    it('throws when the response is not ok', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: false });
      const client = newClient(fetchFn);

      await expectAsync(client.getIssueComments(7)).toBeRejectedWithError(
        `could not fetch comments for pull request #7 in ${REPO}`
      );
    });
  });

  describe('#getPrReviewComments', () => {
    it('requests the pull request\'s inline review comments', async () => {
      const comments = [{ user: { login: 'octocat' }, body: 'hi' }];
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: true, json: async () => comments });
      const client = newClient(fetchFn);

      const result = await client.getPrReviewComments(7);

      expect(fetchFn).toHaveBeenCalledWith(
        `https://api.github.com/repos/${REPO}/pulls/7/comments?per_page=100`,
        jasmine.objectContaining({ headers: { Authorization: `Bearer ${TOKEN}` } })
      );
      expect(result).toEqual(comments);
    });

    it('normalizes a malformed (non-array) response to []', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: true, json: async () => ({}) });
      const client = newClient(fetchFn);

      await expectAsync(client.getPrReviewComments(7)).toBeResolvedTo([]);
    });

    it('throws when the response is not ok', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: false });
      const client = newClient(fetchFn);

      await expectAsync(client.getPrReviewComments(7)).toBeRejectedWithError(
        `could not fetch review comments for pull request #7 in ${REPO}`
      );
    });
  });

  describe('#addReaction / #removeReaction', () => {
    it('POSTs the addReaction mutation with the node id/content and the auth header', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: true, json: async () => ({ data: {} }) });
      const client = newClient(fetchFn);

      await client.addReaction('IC_kwABC', 'EYES');

      expect(fetchFn).toHaveBeenCalledWith('https://api.github.com/graphql', jasmine.objectContaining({
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
      }));

      const [, options] = fetchFn.calls.mostRecent().args;
      const payload = JSON.parse(options.body);

      expect(payload.variables).toEqual({ id: 'IC_kwABC', content: 'EYES' });
      expect(payload.query).toContain('addReaction');
    });

    it('POSTs the removeReaction mutation with the node id/content', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: true, json: async () => ({ data: {} }) });
      const client = newClient(fetchFn);

      await client.removeReaction('IC_kwABC', 'THUMBS_UP');

      const [, options] = fetchFn.calls.mostRecent().args;
      const payload = JSON.parse(options.body);

      expect(payload.variables).toEqual({ id: 'IC_kwABC', content: 'THUMBS_UP' });
      expect(payload.query).toContain('removeReaction');
    });

    it('tolerates a non-ok response', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: false });
      const client = newClient(fetchFn);

      await expectAsync(client.addReaction('IC_kwABC', 'EYES')).toBeResolved();
    });

    it('tolerates a rejected fetch call', async () => {
      const fetchFn = jasmine.createSpy().and.rejectWith(new Error('network error'));
      const client = newClient(fetchFn);

      await expectAsync(client.removeReaction('IC_kwABC', 'EYES')).toBeResolved();
    });
  });
});
