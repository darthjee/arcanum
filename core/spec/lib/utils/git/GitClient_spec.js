import GitClient, { DETACHED_HEAD_MESSAGE } from '../../../../lib/utils/git/GitClient.js';

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

  describe('#requireCurrentBranch', () => {
    it('returns the trimmed current branch name', async () => {
      const execFileAsync = jasmine.createSpy().and.resolveTo({ stdout: 'issue-5\n', stderr: '' });
      const gitClient = new GitClient({ context: { repoPath: REPO_PATH }, execFileAsync });

      await expectAsync(gitClient.requireCurrentBranch()).toBeResolvedTo('issue-5');
    });

    it('rejects with the refusal message on a detached HEAD', async () => {
      const execFileAsync = jasmine.createSpy().and.resolveTo({ stdout: '\n', stderr: '' });
      const gitClient = new GitClient({ context: { repoPath: REPO_PATH }, execFileAsync });

      await expectAsync(gitClient.requireCurrentBranch())
        .toBeRejectedWithError('refusing to push: no current branch (detached HEAD?)');
    });

    it('exports the refusal message as DETACHED_HEAD_MESSAGE', () => {
      expect(DETACHED_HEAD_MESSAGE).toEqual('refusing to push: no current branch (detached HEAD?)');
    });
  });

  describe('#pushCurrentBranch', () => {
    it('pushes the current branch to origin under the same name and resolves to its stdout', async () => {
      const execFileAsync = jasmine.createSpy().and.callFake((cmd, args) => {
        if (args[0] === 'branch') {
          return Promise.resolve({ stdout: 'issue-5\n', stderr: '' });
        }

        return Promise.resolve({ stdout: 'pushed\n', stderr: '' });
      });
      const gitClient = new GitClient({ context: { repoPath: REPO_PATH }, execFileAsync });

      await expectAsync(gitClient.pushCurrentBranch()).toBeResolvedTo('pushed\n');
      expect(execFileAsync).toHaveBeenCalledWith(
        'git', ['push', '-u', 'origin', 'issue-5:issue-5'], { cwd: REPO_PATH }
      );
    });

    it('rejects on a detached HEAD without running git push', async () => {
      const execFileAsync = jasmine.createSpy().and.resolveTo({ stdout: '', stderr: '' });
      const gitClient = new GitClient({ context: { repoPath: REPO_PATH }, execFileAsync });

      await expectAsync(gitClient.pushCurrentBranch()).toBeRejectedWithError(DETACHED_HEAD_MESSAGE);
      expect(execFileAsync.calls.allArgs().map(([, args]) => args[0])).toEqual(['branch']);
    });

    it('rejects on a failure resolving the current branch', async () => {
      const execFileAsync = jasmine.createSpy().and.rejectWith(new Error('not a git repo'));
      const gitClient = new GitClient({ context: { repoPath: REPO_PATH }, execFileAsync });

      await expectAsync(gitClient.pushCurrentBranch()).toBeRejectedWithError('not a git repo');
    });

    it('rejects on a failed git push', async () => {
      const execFileAsync = jasmine.createSpy().and.callFake((cmd, args) => {
        if (args[0] === 'branch') {
          return Promise.resolve({ stdout: 'issue-5\n', stderr: '' });
        }

        return Promise.reject(new Error('non-fast-forward'));
      });
      const gitClient = new GitClient({ context: { repoPath: REPO_PATH }, execFileAsync });

      await expectAsync(gitClient.pushCurrentBranch()).toBeRejectedWithError('non-fast-forward');
    });
  });
});
