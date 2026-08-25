import GitBranch from '../../../../lib/utils/git/GitBranch.js';

describe('GitBranch', () => {
  function newGitBranch(branch) {
    const gitClient = { currentBranch: jasmine.createSpy().and.resolveTo(branch) };
    const gitBranch = new GitBranch({ context: {}, gitClient });

    return { gitBranch, gitClient };
  }

  describe('#currentBranch', () => {
    it('delegates to the injected gitClient', async () => {
      const { gitBranch, gitClient } = newGitBranch('issue-5');

      await expectAsync(gitBranch.currentBranch()).toBeResolvedTo('issue-5');
      expect(gitClient.currentBranch).toHaveBeenCalledWith();
    });
  });

  describe('#issueFromCurrentBranch', () => {
    it('returns the parsed id and branch when the branch matches issue-<id>', async () => {
      const { gitBranch } = newGitBranch('issue-42');

      await expectAsync(gitBranch.issueFromCurrentBranch()).toBeResolvedTo({ id: '42', branch: 'issue-42' });
    });

    it('returns null when the branch does not match issue-<id>', async () => {
      const { gitBranch } = newGitBranch('some-other-branch');

      await expectAsync(gitBranch.issueFromCurrentBranch()).toBeResolvedTo(null);
    });
  });
});
