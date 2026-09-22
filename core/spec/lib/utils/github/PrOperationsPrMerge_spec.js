import { newPrOperations } from '../../../support/factories/prOperations.js';
import { registerMergeBodyResolverSharedExamples } from '../../../support/sharedExamples/mergeBodyResolverSharedExamples.js';

describe('PrOperations#prMerge', () => {
  const PULL = { number: 7, title: 'My PR', html_url: 'https://github.com/darthjee/arcanum/pull/7', state: 'open' };

  it('merges with an empty body by default (merge_body_mode absent) and prints the PR URL', async () => {
    const { prOperations, githubClient } = newPrOperations({ pull: PULL });

    await expectAsync(prOperations.prMerge()).toBeResolvedTo(`${PULL.html_url}\n`);

    expect(githubClient.mergePr).toHaveBeenCalledWith(
      7, { merge_method: 'squash', commit_title: 'My PR (#7)', commit_message: '' }
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

    expect(mergeCall.args[0]).toEqual('123');
    expect(mergeCall.args[1].commit_title).toEqual('My PR (#123)');
  });

  registerMergeBodyResolverSharedExamples(async ({ commits, configValues, modelEmail }) => {
    const { prOperations, githubClient } = newPrOperations({ pull: PULL, commits, configValues });

    await prOperations.prMerge(modelEmail);

    const args = githubClient.mergePr.calls.mostRecent().args[1];

    return { included: 'commit_message' in args, body: args.commit_message ?? '' };
  });

  it('rejects with the merge-failure error when the merge REST call fails', async () => {
    const { prOperations } = newPrOperations({ pull: PULL, mergeOk: false });

    await expectAsync(prOperations.prMerge()).toBeRejectedWithError(
      'could not merge PR #7 on darthjee/arcanum'
    );
  });

  it('deletes the branch ref after a successful merge', async () => {
    const { prOperations, githubClient } = newPrOperations({ branch: 'issue-9', pull: PULL });

    await prOperations.prMerge();

    expect(githubClient.deleteBranch).toHaveBeenCalledWith('issue-9');
  });

  it('never calls context.getToken() or context.resolveWithRef() directly', async () => {
    const { prOperations, context } = newPrOperations({ pull: PULL });

    await prOperations.prMerge();

    expect(context._githubToken.get).not.toHaveBeenCalled();
    expect(context._origin.resolveWithRef).not.toHaveBeenCalled();
  });
});
