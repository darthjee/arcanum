import {
  createAutoFixAllGithub,
  fakeGithubFetch,
  fakeGitExecFileAsync
} from '../../../support/factories/autoFixAllGithub.js';

describe('AutoFixAllGithub (PR & branch subcommands)', () => {
  describe('#prNumber', () => {
    it('rejects when repoPath is missing', async () => {
      const github = createAutoFixAllGithub({ repoPath: '' });

      await expectAsync(github.prNumber()).toBeRejectedWithError('Usage: github.sh pr-number <repo_path>');
    });

    it('returns the cached pr_id when the branch matches issue-<id> and a cache entry exists', async () => {
      const fetchFn = fakeGithubFetch();
      const github = createAutoFixAllGithub({
        execFileAsync: fakeGitExecFileAsync({ branch: 'issue-5' }),
        issueStateService: { get: async (id, field) => (field === 'pr_id' ? '99' : '') },
        fetchFn
      });

      await expectAsync(github.prNumber()).toBeResolvedTo('99\n');
      expect(fetchFn).not.toHaveBeenCalled();
    });
  });

  describe('#prState', () => {
    it('rejects when repoPath is missing', async () => {
      const github = createAutoFixAllGithub({ repoPath: '' });

      await expectAsync(github.prState()).toBeRejectedWithError('Usage: github.sh pr-state <repo_path>');
    });

    it('prints STATE=OPEN for an open, unmerged pull request', async () => {
      const github = createAutoFixAllGithub({
        fetchFn: fakeGithubFetch({ pulls: [{ number: 7, state: 'open', merged: false, merged_at: null }] })
      });

      await expectAsync(github.prState()).toBeResolvedTo('STATE=OPEN\n');
    });
  });

  describe('#prMerge', () => {
    const PULL = { number: 7, title: 'My PR', html_url: 'https://github.com/darthjee/arcanum/pull/7', state: 'open' };

    it('rejects when repoPath is missing', async () => {
      const github = createAutoFixAllGithub({ repoPath: '' });

      await expectAsync(github.prMerge()).toBeRejectedWithError('Usage: github.sh pr-merge <repo_path> [model_email]');
    });

    it('merges with an empty body by default (merge_body_mode absent) and prints the PR URL', async () => {
      const fetchFn = fakeGithubFetch({ pulls: [PULL] });
      const github = createAutoFixAllGithub({ fetchFn });

      await expectAsync(github.prMerge()).toBeResolvedTo(`${PULL.html_url}\n`);

      const mergeCall = fetchFn.calls.allArgs().find(([, options]) => options.method === 'PUT');

      expect(JSON.parse(mergeCall[1].body)).toEqual({
        merge_method: 'squash',
        commit_title: 'My PR (#7)',
        commit_message: ''
      });
    });

    it('rejects with the merge-failure error when the merge REST call fails', async () => {
      const github = createAutoFixAllGithub({ fetchFn: fakeGithubFetch({ pulls: [PULL], mergeOk: false }) });

      await expectAsync(github.prMerge()).toBeRejectedWithError(
        'could not merge PR #7 on darthjee/arcanum'
      );
    });
  });

  describe('#cleanupBranch', () => {
    it('rejects when repoPath or id is missing', async () => {
      const github = createAutoFixAllGithub();

      await expectAsync(github.cleanupBranch()).toBeRejectedWithError(
        'Usage: github.sh cleanup-branch <repo_path> <id>'
      );
    });

    it('runs the remote delete, checkout, reset, and local delete, in order', async () => {
      const execFileAsync = fakeGitExecFileAsync();
      const github = createAutoFixAllGithub({ execFileAsync });

      await expectAsync(github.cleanupBranch('5')).toBeResolvedTo('');

      const calls = execFileAsync.calls.allArgs().map(([cmd, args]) => `${cmd} ${args.join(' ')}`);

      expect(calls).toEqual([
        'git push origin --delete issue-5',
        'git checkout main',
        'git reset --hard origin/main',
        'git branch -D issue-5'
      ]);
    });
  });
});
