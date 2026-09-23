import { newGitHubClient, REPO } from '../../../support/factories/githubClient.js';

describe('GitHubClient (failed-request error mapping)', () => {
  describe('failed-request error mapping on read methods', () => {
    const malformedJson = async () => {
      throw new SyntaxError('Unexpected token');
    };
    const cases = [
      ['#getPr', (client) => client.getPr('issue-5'), `Error: no pull request found for the current branch on ${REPO}`],
      ['#getPrCommits', (client) => client.getPrCommits(7), `could not fetch commits for pull request #7 in ${REPO}`],
      ['#getPrHeadSha', (client) => client.getPrHeadSha(7), `Error: could not fetch pull request #7 from ${REPO}`],
      ['#getCheckRuns', (client) => client.getCheckRuns('abc123'), `Error: could not fetch check-runs for abc123 in ${REPO}`],
      ['#getCurrentUser', (client) => client.getCurrentUser(), 'could not fetch current user'],
      ['#getPrState', (client) => client.getPrState(7), `Error: could not fetch pull request #7 from ${REPO}`],
      ['#getPrReviews', (client) => client.getPrReviews(7), `could not fetch reviews for pull request #7 in ${REPO}`],
      ['#getIssueComments', (client) => client.getIssueComments(7), `could not fetch comments for pull request #7 in ${REPO}`],
      [
        '#getPrReviewComments',
        (client) => client.getPrReviewComments(7),
        `could not fetch review comments for pull request #7 in ${REPO}`
      ]
    ];

    cases.forEach(([name, call, message]) => {
      describe(name, () => {
        it('throws the domain error when fetch itself rejects (e.g. timeout)', async () => {
          const client = newGitHubClient(jasmine.createSpy().and.rejectWith(new Error('fetch failed')));

          await expectAsync(call(client)).toBeRejectedWithError(message);
        });

        it('throws the domain error when the response body is not valid JSON', async () => {
          const client = newGitHubClient(jasmine.createSpy().and.resolveTo({ ok: true, json: malformedJson }));

          await expectAsync(call(client)).toBeRejectedWithError(message);
        });
      });
    });
  });
});
