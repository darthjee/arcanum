import GitHubChecksClient from '../../../../lib/utils/github/GitHubChecksClient.js';
import { newFocusedClient, REPO, TOKEN } from '../../../support/factories/githubClient.js';

const newClient = (fetchFn) => newFocusedClient(GitHubChecksClient, fetchFn);

describe('GitHubChecksClient', () => {
  describe('#getCheckRuns', () => {
    it('requests the commit\'s check-runs and returns the check_runs array', async () => {
      const checkRuns = [{ name: 'build', status: 'completed', conclusion: 'success' }];
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: true, json: async () => ({ check_runs: checkRuns }) });
      const client = newClient(fetchFn);

      const result = await client.getCheckRuns('abc123');

      expect(fetchFn).toHaveBeenCalledWith(
        `https://api.github.com/repos/${REPO}/commits/abc123/check-runs?per_page=100`,
        jasmine.objectContaining({ headers: { Authorization: `Bearer ${TOKEN}` } })
      );
      expect(result).toEqual(checkRuns);
    });

    it('throws when the response is not ok', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: false });
      const client = newClient(fetchFn);

      await expectAsync(client.getCheckRuns('abc123')).toBeRejectedWithError(
        `Error: could not fetch check-runs for abc123 in ${REPO}`
      );
    });

    it('throws when check_runs is not an array', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: true, json: async () => ({}) });
      const client = newClient(fetchFn);

      await expectAsync(client.getCheckRuns('abc123')).toBeRejectedWithError(
        `Error: malformed check-runs response for abc123 in ${REPO}`
      );
    });
  });
});
