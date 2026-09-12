import GitClient from '../../../../lib/utils/git/GitClient.js';

const REPO_PATH = '/fake/repo';

describe('GitClient', () => {
  describe('#currentBranch', () => {
    it('runs git branch --show-current with the context repoPath as cwd and returns its trimmed stdout', async () => {
      const execFileAsync = jasmine.createSpy().and.resolveTo({ stdout: 'issue-5\n', stderr: '' });
      const gitClient = new GitClient({ context: { repoPath: REPO_PATH }, execFileAsync });

      const branch = await gitClient.currentBranch();

      expect(execFileAsync).toHaveBeenCalledWith('git', ['branch', '--show-current'], { cwd: REPO_PATH });
      expect(branch).toEqual('issue-5');
    });
  });

  describe('#pushCurrentBranch', () => {
    it('pushes the current branch to origin under the same name', async () => {
      const execFileAsync = jasmine.createSpy().and.resolveTo({ stdout: '', stderr: '' });
      const gitClient = new GitClient({ context: { repoPath: REPO_PATH }, execFileAsync });

      execFileAsync.and.callFake((cmd, args) => {
        if (args[0] === 'branch') {
          return Promise.resolve({ stdout: 'issue-5\n', stderr: '' });
        }

        return Promise.resolve({ stdout: '', stderr: '' });
      });

      await gitClient.pushCurrentBranch();

      expect(execFileAsync).toHaveBeenCalledWith(
        'git', ['push', '-u', 'origin', 'issue-5:issue-5'], { cwd: REPO_PATH }
      );
    });

    it('tolerates a failure resolving the current branch', async () => {
      const execFileAsync = jasmine.createSpy().and.rejectWith(new Error('not a git repo'));
      const gitClient = new GitClient({ context: { repoPath: REPO_PATH }, execFileAsync });

      await expectAsync(gitClient.pushCurrentBranch()).toBeResolved();
    });

    it('tolerates a failed git push', async () => {
      const execFileAsync = jasmine.createSpy().and.callFake((cmd, args) => {
        if (args[0] === 'branch') {
          return Promise.resolve({ stdout: 'issue-5\n', stderr: '' });
        }

        return Promise.reject(new Error('non-fast-forward'));
      });
      const gitClient = new GitClient({ context: { repoPath: REPO_PATH }, execFileAsync });

      await expectAsync(gitClient.pushCurrentBranch()).toBeResolved();
    });
  });
});
