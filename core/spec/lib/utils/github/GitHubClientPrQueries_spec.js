import GitHubClient from '../../../../lib/utils/github/GitHubClient.js';
import { newGitHubClient, REPO, TOKEN } from '../../../support/factories/githubClient.js';

describe('GitHubClient (pull request queries)', () => {
  describe('#getPr', () => {
    it('requests the head-filtered, all-states pulls listing with the auth header', async () => {
      const pull = { number: 7, state: 'open' };
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: true, json: async () => [pull] });
      const client = newGitHubClient(fetchFn);

      const result = await client.getPr('issue-5');

      expect(fetchFn).toHaveBeenCalledWith(
        `https://api.github.com/repos/${REPO}/pulls?head=darthjee:issue-5&state=all`,
        jasmine.objectContaining({ headers: { Authorization: `Bearer ${TOKEN}` } })
      );
      expect(result).toEqual(pull);
    });

    it('throws the not-found error when the response is not ok', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: false });
      const client = newGitHubClient(fetchFn);

      await expectAsync(client.getPr('issue-5')).toBeRejectedWithError(
        'Error: no pull request found for the current branch on darthjee/arcanum'
      );
    });

    it('throws the not-found error when no pull matches', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: true, json: async () => [] });
      const client = newGitHubClient(fetchFn);

      await expectAsync(client.getPr('issue-5')).toBeRejectedWithError(
        'Error: no pull request found for the current branch on darthjee/arcanum'
      );
    });

    it('throws the not-found error when fetch itself rejects (e.g. timeout)', async () => {
      const fetchFn = jasmine.createSpy().and.rejectWith(new Error('timeout'));
      const client = newGitHubClient(fetchFn);

      await expectAsync(client.getPr('issue-5')).toBeRejectedWithError(
        'Error: no pull request found for the current branch on darthjee/arcanum'
      );
    });
  });

  describe('#getPrState', () => {
    it('requests the pull request and returns its raw object', async () => {
      const pull = { number: 7, state: 'closed', merged: true, merged_at: '2024-01-01T00:00:00Z' };
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: true, json: async () => pull });
      const client = newGitHubClient(fetchFn);

      const result = await client.getPrState(7);

      expect(fetchFn).toHaveBeenCalledWith(
        `https://api.github.com/repos/${REPO}/pulls/7`,
        jasmine.objectContaining({ headers: { Authorization: `Bearer ${TOKEN}` } })
      );
      expect(result).toEqual(pull);
    });

    it('throws when the response is not ok', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: false });
      const client = newGitHubClient(fetchFn);

      await expectAsync(client.getPrState(7)).toBeRejectedWithError(
        `Error: could not fetch pull request #7 from ${REPO}`
      );
    });
  });

  describe('.prStateLabel', () => {
    it('returns OPEN for an open, unmerged pull request', () => {
      expect(GitHubClient.prStateLabel({ state: 'open', merged: false, merged_at: null })).toEqual('OPEN');
    });

    it('returns MERGED for a merged pull request, even though its raw state is "closed"', () => {
      expect(GitHubClient.prStateLabel({ state: 'closed', merged: true, merged_at: '2024-01-01T00:00:00Z' }))
        .toEqual('MERGED');
    });

    it('returns CLOSED for a closed, unmerged pull request', () => {
      expect(GitHubClient.prStateLabel({ state: 'closed', merged: false, merged_at: null })).toEqual('CLOSED');
    });
  });

  describe('#getPrHeadSha', () => {
    it('requests the pull request and returns its head sha', async () => {
      const pull = { number: 7, head: { sha: 'abc123' } };
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: true, json: async () => pull });
      const client = newGitHubClient(fetchFn);

      const result = await client.getPrHeadSha(7);

      expect(fetchFn).toHaveBeenCalledWith(
        `https://api.github.com/repos/${REPO}/pulls/7`,
        jasmine.objectContaining({ headers: { Authorization: `Bearer ${TOKEN}` } })
      );
      expect(result).toEqual('abc123');
    });

    it('throws when the response is not ok', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: false });
      const client = newGitHubClient(fetchFn);

      await expectAsync(client.getPrHeadSha(7)).toBeRejectedWithError(
        `Error: could not fetch pull request #7 from ${REPO}`
      );
    });

    it('throws when the response has no head.sha', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: true, json: async () => ({ number: 7 }) });
      const client = newGitHubClient(fetchFn);

      await expectAsync(client.getPrHeadSha(7)).toBeRejectedWithError(
        `Error: could not resolve head commit for pull request #7 in ${REPO}`
      );
    });
  });

  describe('#getPrCommits', () => {
    it('requests the pull request\'s commits with the auth header', async () => {
      const commits = [{ commit: { author: { name: 'Alice', email: 'alice@x.com' } } }];
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: true, json: async () => commits });
      const client = newGitHubClient(fetchFn);

      const result = await client.getPrCommits(7);

      expect(fetchFn).toHaveBeenCalledWith(
        `https://api.github.com/repos/${REPO}/pulls/7/commits?per_page=100`,
        jasmine.objectContaining({ headers: { Authorization: `Bearer ${TOKEN}` } })
      );
      expect(result).toEqual(commits);
    });

    it('normalizes a malformed (non-array) response to []', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: true, json: async () => ({}) });
      const client = newGitHubClient(fetchFn);

      await expectAsync(client.getPrCommits(7)).toBeResolvedTo([]);
    });

    it('throws when the response is not ok', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: false });
      const client = newGitHubClient(fetchFn);

      await expectAsync(client.getPrCommits(7)).toBeRejectedWithError(
        'could not fetch commits for pull request #7 in darthjee/arcanum'
      );
    });
  });
});
