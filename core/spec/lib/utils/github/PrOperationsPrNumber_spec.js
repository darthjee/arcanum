import { newPrOperations } from '../../../support/factories/prOperations.js';

describe('PrOperations#prNumber', () => {
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

  it('never calls context.getToken() or context.resolveWithRef() directly', async () => {
    const { prOperations, context } = newPrOperations({ branch: 'some-other-branch' });

    await prOperations.prNumber();

    expect(context._githubToken.get).not.toHaveBeenCalled();
    expect(context._origin.resolveWithRef).not.toHaveBeenCalled();
  });
});
