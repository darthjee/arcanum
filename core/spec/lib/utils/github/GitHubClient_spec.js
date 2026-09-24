import GitHubChecksClient from '../../../../lib/utils/github/GitHubChecksClient.js';
import GitHubClient from '../../../../lib/utils/github/GitHubClient.js';
import GitHubLabelClient from '../../../../lib/utils/github/GitHubLabelClient.js';
import GitHubPullRequestClient from '../../../../lib/utils/github/GitHubPullRequestClient.js';
import GitHubPullRequestFeedbackClient from '../../../../lib/utils/github/GitHubPullRequestFeedbackClient.js';
import GitHubUserClient from '../../../../lib/utils/github/GitHubUserClient.js';
import { newGitHubClient, REPO, TOKEN } from '../../../support/factories/githubClient.js';

describe('GitHubClient (delegating facade)', () => {
  const delegations = [
    [GitHubPullRequestClient, 'getPr', ['issue-5']],
    [GitHubPullRequestClient, 'getPrState', [7]],
    [GitHubPullRequestClient, 'getPrHeadSha', [7]],
    [GitHubPullRequestClient, 'getPrCommits', [7]],
    [GitHubPullRequestClient, 'createPr', ['title', 'body']],
    [GitHubPullRequestClient, 'mergePr', [7, { merge_method: 'squash' }]],
    [GitHubPullRequestClient, 'markPrReady', ['PR_node']],
    [GitHubPullRequestClient, 'deleteBranch', ['issue-5']],
    [GitHubPullRequestFeedbackClient, 'getPrReviews', [7]],
    [GitHubPullRequestFeedbackClient, 'getIssueComments', [7]],
    [GitHubPullRequestFeedbackClient, 'getPrReviewComments', [7]],
    [GitHubPullRequestFeedbackClient, 'addReaction', ['node', 'EYES']],
    [GitHubPullRequestFeedbackClient, 'removeReaction', ['node', 'EYES']],
    [GitHubChecksClient, 'getCheckRuns', ['abc123']],
    [GitHubUserClient, 'getCurrentUser', []],
    [GitHubLabelClient, 'listLabelNames', []],
    [GitHubLabelClient, 'createLabel', ['Bug', 'b60205']],
    [GitHubLabelClient, 'updateLabel', ['bug', 'Bug', 'b60205']]
  ];

  delegations.forEach(([ClientClass, method, args]) => {
    it(`#${method} delegates to ${ClientClass.name}#${method}`, async () => {
      const result = { from: ClientClass.name };
      const spy = spyOn(ClientClass.prototype, method).and.resolveTo(result);
      const client = newGitHubClient(jasmine.createSpy('fetch'));

      await expectAsync(client[method](...args)).toBeResolvedTo(result);
      expect(spy).toHaveBeenCalledOnceWith(...args);
    });
  });

  it('.prStateLabel delegates to GitHubPullRequestClient.prStateLabel', () => {
    const pull = { state: 'open' };
    const spy = spyOn(GitHubPullRequestClient, 'prStateLabel').and.returnValue('MERGED');

    expect(GitHubClient.prStateLabel(pull)).toEqual('MERGED');
    expect(spy).toHaveBeenCalledOnceWith(pull);
  });

  it('forwards git to the pull request client', async () => {
    const git = { currentBranch: jasmine.createSpy('currentBranch').and.resolveTo('issue-5') };
    const fetchFn = jasmine.createSpy('fetch').and.resolveTo({ ok: false });

    await expectAsync(newGitHubClient(fetchFn, git).createPr('t', 'b')).toBeRejected();
    expect(git.currentBranch).toHaveBeenCalled();
  });

  it('issues requests through the injected fetchFn with the timeout signal', async () => {
    const fetchFn = jasmine.createSpy('fetch').and.resolveTo({ ok: true, json: async () => ({ login: 'me' }) });

    await expectAsync(newGitHubClient(fetchFn).getCurrentUser()).toBeResolvedTo({ login: 'me' });
    expect(fetchFn).toHaveBeenCalledOnceWith('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${TOKEN}` },
      signal: jasmine.any(AbortSignal)
    });
  });

  it('routes every focused client through the same injected fetchFn', async () => {
    const fetchFn = jasmine.createSpy('fetch').and.resolveTo({ ok: true, json: async () => [] });
    const client = newGitHubClient(fetchFn);

    await client.getPrCommits(7);
    await client.getPrReviews(7);

    expect(fetchFn.calls.allArgs().map(([url]) => url)).toEqual([
      `https://api.github.com/repos/${REPO}/pulls/7/commits?per_page=100`,
      `https://api.github.com/repos/${REPO}/pulls/7/reviews?per_page=100`
    ]);
  });
});
