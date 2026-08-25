import GitHubClient from '../../../../lib/utils/github/GitHubClient.js';

const REPO = 'darthjee/arcanum';
const TOKEN = 'fake-token';

describe('GitHubClient', () => {
  function newClient(fetchFn) {
    return new GitHubClient({ fetchFn, timeoutMs: 5 });
  }

  describe('#getPr', () => {
    it('requests the head-filtered, all-states pulls listing with the auth header', async () => {
      const pull = { number: 7, state: 'open' };
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: true, json: async () => [pull] });
      const client = newClient(fetchFn);

      const result = await client.getPr(REPO, 'issue-5', TOKEN, REPO);

      expect(fetchFn).toHaveBeenCalledWith(
        `https://api.github.com/repos/${REPO}/pulls?head=darthjee:issue-5&state=all`,
        jasmine.objectContaining({ headers: { Authorization: `Bearer ${TOKEN}` } })
      );
      expect(result).toEqual(pull);
    });

    it('throws the not-found error when the response is not ok', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: false });
      const client = newClient(fetchFn);

      await expectAsync(client.getPr(REPO, 'issue-5', TOKEN, REPO)).toBeRejectedWithError(
        'Error: no pull request found for the current branch on darthjee/arcanum'
      );
    });

    it('throws the not-found error when no pull matches', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: true, json: async () => [] });
      const client = newClient(fetchFn);

      await expectAsync(client.getPr(REPO, 'issue-5', TOKEN, REPO)).toBeRejectedWithError(
        'Error: no pull request found for the current branch on darthjee/arcanum'
      );
    });

    it('throws the not-found error when fetch itself rejects (e.g. timeout)', async () => {
      const fetchFn = jasmine.createSpy().and.rejectWith(new Error('timeout'));
      const client = newClient(fetchFn);

      await expectAsync(client.getPr(REPO, 'issue-5', TOKEN, REPO)).toBeRejectedWithError(
        'Error: no pull request found for the current branch on darthjee/arcanum'
      );
    });
  });

  describe('#getPrCommits', () => {
    it('requests the pull request\'s commits with the auth header', async () => {
      const commits = [{ commit: { author: { name: 'Alice', email: 'alice@x.com' } } }];
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: true, json: async () => commits });
      const client = newClient(fetchFn);

      const result = await client.getPrCommits(REPO, 7, TOKEN);

      expect(fetchFn).toHaveBeenCalledWith(
        `https://api.github.com/repos/${REPO}/pulls/7/commits?per_page=100`,
        jasmine.objectContaining({ headers: { Authorization: `Bearer ${TOKEN}` } })
      );
      expect(result).toEqual(commits);
    });

    it('normalizes a malformed (non-array) response to []', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: true, json: async () => ({}) });
      const client = newClient(fetchFn);

      await expectAsync(client.getPrCommits(REPO, 7, TOKEN)).toBeResolvedTo([]);
    });

    it('throws when the response is not ok', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: false });
      const client = newClient(fetchFn);

      await expectAsync(client.getPrCommits(REPO, 7, TOKEN)).toBeRejectedWithError(
        'could not fetch commits for pull request #7 in darthjee/arcanum'
      );
    });
  });

  describe('#mergePr', () => {
    it('PUTs the given payload to the merge endpoint with the auth + content-type headers', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: true });
      const client = newClient(fetchFn);
      const payload = { merge_method: 'squash', commit_title: 'My PR (#7)' };

      await client.mergePr(REPO, 7, TOKEN, payload);

      expect(fetchFn).toHaveBeenCalledWith(`https://api.github.com/repos/${REPO}/pulls/7/merge`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: jasmine.anything()
      });
    });

    it('throws when the response is not ok', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: false });
      const client = newClient(fetchFn);

      await expectAsync(client.mergePr(REPO, 7, TOKEN, {})).toBeRejectedWithError(
        'could not merge PR #7 on darthjee/arcanum'
      );
    });
  });

  describe('#deleteBranch', () => {
    it('DELETEs the branch ref with the auth header', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: true });
      const client = newClient(fetchFn);

      await client.deleteBranch(REPO, 'issue-5', TOKEN);

      expect(fetchFn).toHaveBeenCalledWith(`https://api.github.com/repos/${REPO}/git/refs/heads/issue-5`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${TOKEN}` },
        signal: jasmine.anything()
      });
    });

    it('tolerates a non-ok response', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: false });
      const client = newClient(fetchFn);

      await expectAsync(client.deleteBranch(REPO, 'issue-5', TOKEN)).toBeResolved();
    });

    it('tolerates a rejected fetch call', async () => {
      const fetchFn = jasmine.createSpy().and.rejectWith(new Error('network error'));
      const client = newClient(fetchFn);

      await expectAsync(client.deleteBranch(REPO, 'issue-5', TOKEN)).toBeResolved();
    });
  });

  describe('#getCurrentUser', () => {
    it('requests the current user with the auth header', async () => {
      const user = { login: 'fake-merger' };
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: true, json: async () => user });
      const client = newClient(fetchFn);

      const result = await client.getCurrentUser(TOKEN);

      expect(fetchFn).toHaveBeenCalledWith(
        'https://api.github.com/user',
        jasmine.objectContaining({ headers: { Authorization: `Bearer ${TOKEN}` } })
      );
      expect(result).toEqual(user);
    });

    it('throws when the response is not ok', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: false });
      const client = newClient(fetchFn);

      await expectAsync(client.getCurrentUser(TOKEN)).toBeRejectedWithError('could not fetch current user');
    });
  });
});
