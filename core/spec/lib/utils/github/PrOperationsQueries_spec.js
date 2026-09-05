import { newPrOperations } from '../../../support/factories/prOperations.js';

describe('PrOperations (query methods)', () => {
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

    it('never calls context.getToken() or context.resolveWithRef() directly', async () => {
      const { prOperations, context } = newPrOperations({});

      await prOperations.prState();

      expect(context._githubToken.get).not.toHaveBeenCalled();
      expect(context._origin.resolveWithRef).not.toHaveBeenCalled();
    });
  });

  describe('#headSha', () => {
    it('delegates to githubClient.getPrHeadSha() and returns its result', async () => {
      const { prOperations, githubClient } = newPrOperations({});

      await expectAsync(prOperations.headSha(7)).toBeResolvedTo('abc123');

      expect(githubClient.getPrHeadSha).toHaveBeenCalledWith(7);
    });
  });

  describe('#checkRuns', () => {
    it('delegates to githubClient.getCheckRuns() and returns its result', async () => {
      const checkRuns = [{ name: 'build', status: 'completed', conclusion: 'success' }];
      const { prOperations, githubClient } = newPrOperations({});

      githubClient.getCheckRuns.and.resolveTo(checkRuns);

      await expectAsync(prOperations.checkRuns('abc123')).toBeResolvedTo(checkRuns);

      expect(githubClient.getCheckRuns).toHaveBeenCalledWith('abc123');
    });
  });
});
