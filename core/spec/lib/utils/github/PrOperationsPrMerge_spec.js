import { newPrOperations } from '../../../support/factories/prOperations.js';

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

  it('omits commit_message entirely in "full" mode', async () => {
    const { prOperations, githubClient } = newPrOperations({ pull: PULL, configValues: { merge_body_mode: 'full' } });

    await prOperations.prMerge();

    const mergeCall = githubClient.mergePr.calls.mostRecent();

    expect(mergeCall.args[1]).toEqual({ merge_method: 'squash', commit_title: 'My PR (#7)' });
  });

  it('sends an empty commit_message in "empty" mode', async () => {
    const { prOperations, githubClient } = newPrOperations({ pull: PULL, configValues: { merge_body_mode: 'empty' } });

    await prOperations.prMerge();

    const mergeCall = githubClient.mergePr.calls.mostRecent();

    expect(mergeCall.args[1].commit_message).toEqual('');
  });

  describe('"coauthors" mode', () => {
    it('builds a deduped, email-sorted Co-authored-by block from the PR commits', async () => {
      const commits = [
        { commit: { author: { name: 'Bob', email: 'bob@x.com' } }, author: { login: 'bob' } },
        { commit: { author: { name: 'Alice', email: 'alice@x.com' } }, author: { login: 'alice' } }
      ];
      const { prOperations, githubClient } = newPrOperations({
        pull: PULL,
        commits,
        user: { login: 'merger' },
        configValues: { merge_body_mode: 'coauthors' }
      });

      await prOperations.prMerge();

      const mergeCall = githubClient.mergePr.calls.mostRecent();

      expect(mergeCall.args[1].commit_message).toEqual(
        'Co-authored-by: Alice <alice@x.com>\nCo-authored-by: Bob <bob@x.com>\n'
      );
    });

    it('falls back to "full" mode\'s behavior (omit commit_message) when the resulting list is empty', async () => {
      const commits = [
        { commit: { author: { name: 'Merger', email: 'merger@x.com' } }, author: { login: 'merger' } }
      ];
      const { prOperations, githubClient } = newPrOperations({
        pull: PULL,
        commits,
        user: { login: 'merger' },
        configValues: { merge_body_mode: 'coauthors' }
      });

      await prOperations.prMerge();

      const mergeCall = githubClient.mergePr.calls.mostRecent();

      expect(mergeCall.args[1]).toEqual({ merge_method: 'squash', commit_title: 'My PR (#7)' });
    });
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
