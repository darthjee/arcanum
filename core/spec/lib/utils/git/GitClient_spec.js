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
});
