import GitClient from '../../../../lib/utils/git/GitClient.js';

const REPO_PATH = '/fake/repo';

describe('GitClient', () => {
  describe('#currentBranch', () => {
    it('runs git branch --show-current with the given cwd and returns its trimmed stdout', async () => {
      const execFileAsync = jasmine.createSpy().and.resolveTo({ stdout: 'issue-5\n', stderr: '' });
      const gitClient = new GitClient({ execFileAsync });

      const branch = await gitClient.currentBranch(REPO_PATH);

      expect(execFileAsync).toHaveBeenCalledWith('git', ['branch', '--show-current'], { cwd: REPO_PATH });
      expect(branch).toEqual('issue-5');
    });
  });
});
