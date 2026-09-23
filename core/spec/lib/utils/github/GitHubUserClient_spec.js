import GitHubUserClient from '../../../../lib/utils/github/GitHubUserClient.js';
import { newFocusedClient, TOKEN } from '../../../support/factories/githubClient.js';

const newClient = (fetchFn) => newFocusedClient(GitHubUserClient, fetchFn);

describe('GitHubUserClient', () => {
  describe('#getCurrentUser', () => {
    it('requests the current user with the auth header', async () => {
      const user = { login: 'fake-merger' };
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: true, json: async () => user });
      const client = newClient(fetchFn);

      const result = await client.getCurrentUser();

      expect(fetchFn).toHaveBeenCalledWith(
        'https://api.github.com/user',
        jasmine.objectContaining({ headers: { Authorization: `Bearer ${TOKEN}` } })
      );
      expect(result).toEqual(user);
    });

    it('throws when the response is not ok', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: false });
      const client = newClient(fetchFn);

      await expectAsync(client.getCurrentUser()).toBeRejectedWithError('could not fetch current user');
    });
  });
});
