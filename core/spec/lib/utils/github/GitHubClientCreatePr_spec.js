import { newGitHubClient, REPO, TOKEN } from '../../../support/factories/githubClient.js';

describe('GitHubClient (pull request creation)', () => {
  describe('#createPr', () => {
    function fakeGit(branch = 'issue-5') {
      return { currentBranch: jasmine.createSpy().and.resolveTo(branch) };
    }

    it('resolves the default branch, then POSTs head/base/title/body and returns html_url', async () => {
      const fetchFn = jasmine.createSpy().and.callFake(async (url, options = {}) => {
        if (options.method === undefined) {
          return { ok: true, json: async () => ({ default_branch: 'main' }) };
        }

        return { ok: true, json: async () => ({ html_url: 'https://github.com/darthjee/arcanum/pull/9' }) };
      });
      const client = newGitHubClient(fetchFn, fakeGit('issue-5'));

      const result = await client.createPr('My PR', 'body text');

      expect(fetchFn).toHaveBeenCalledWith(
        `https://api.github.com/repos/${REPO}`,
        jasmine.objectContaining({ headers: { Authorization: `Bearer ${TOKEN}` } })
      );

      const postCall = fetchFn.calls.allArgs().find(([, options]) => options.method === 'POST');

      expect(postCall[0]).toEqual(`https://api.github.com/repos/${REPO}/pulls`);
      expect(JSON.parse(postCall[1].body)).toEqual({
        title: 'My PR',
        body: 'body text',
        head: 'issue-5',
        base: 'main'
      });
      expect(result).toEqual('https://github.com/darthjee/arcanum/pull/9');
    });

    it('throws when the default-branch lookup fails', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: false });
      const client = newGitHubClient(fetchFn, fakeGit());

      await expectAsync(client.createPr('My PR', 'body text')).toBeRejectedWithError(
        `could not create pull request on ${REPO}`
      );
    });

    it('throws when the pull-request creation POST fails', async () => {
      const fetchFn = jasmine.createSpy().and.callFake(async (url, options = {}) => {
        if (options.method === undefined) {
          return { ok: true, json: async () => ({ default_branch: 'main' }) };
        }

        return { ok: false };
      });
      const client = newGitHubClient(fetchFn, fakeGit());

      await expectAsync(client.createPr('My PR', 'body text')).toBeRejectedWithError(
        `could not create pull request on ${REPO}`
      );
    });

    it('throws when the created pull request has no html_url', async () => {
      const fetchFn = jasmine.createSpy().and.callFake(async (url, options = {}) => {
        if (options.method === undefined) {
          return { ok: true, json: async () => ({ default_branch: 'main' }) };
        }

        return { ok: true, json: async () => ({}) };
      });
      const client = newGitHubClient(fetchFn, fakeGit());

      await expectAsync(client.createPr('My PR', 'body text')).toBeRejectedWithError(
        `could not create pull request on ${REPO}`
      );
    });
  });

  describe('#createPr failed-request mapping', () => {
    const git = { currentBranch: () => Promise.resolve('issue-5') };

    it('throws the domain error when fetch itself rejects', async () => {
      const client = newGitHubClient(jasmine.createSpy().and.rejectWith(new Error('fetch failed')), git);

      await expectAsync(client.createPr('My PR', 'body')).toBeRejectedWithError(
        `could not create pull request on ${REPO}`
      );
    });

    it('throws the domain error when the created pull request body is not valid JSON', async () => {
      const fetchFn = jasmine.createSpy().and.callFake(async (url, options = {}) => {
        if (options.method === undefined) {
          return { ok: true, json: async () => ({ default_branch: 'main' }) };
        }

        return { ok: true, json: () => Promise.reject(new SyntaxError('Unexpected token')) };
      });
      const client = newGitHubClient(fetchFn, git);

      await expectAsync(client.createPr('My PR', 'body')).toBeRejectedWithError(
        `could not create pull request on ${REPO}`
      );
    });
  });
});
