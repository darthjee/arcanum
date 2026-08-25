import Git from '../../../../lib/utils/git/Git.js';

describe('Git', () => {
  function newGit() {
    const gitBranch = {
      currentBranch: jasmine.createSpy().and.resolveTo('issue-5'),
      issueFromCurrentBranch: jasmine.createSpy().and.resolveTo({ id: '5', branch: 'issue-5' })
    };
    const git = new Git({ context: {}, gitBranch });

    return { git, gitBranch };
  }

  describe('#currentBranch', () => {
    it('delegates to the internal GitBranch', async () => {
      const { git, gitBranch } = newGit();

      await expectAsync(git.currentBranch()).toBeResolvedTo('issue-5');
      expect(gitBranch.currentBranch).toHaveBeenCalledWith();
    });
  });

  describe('#issueFromCurrentBranch', () => {
    it('delegates to the internal GitBranch', async () => {
      const { git, gitBranch } = newGit();

      await expectAsync(git.issueFromCurrentBranch()).toBeResolvedTo({ id: '5', branch: 'issue-5' });
      expect(gitBranch.issueFromCurrentBranch).toHaveBeenCalledWith();
    });
  });
});
