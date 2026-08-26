import path from 'node:path';
import IssueStatePaths from '../../../../lib/utils/file/IssueStatePaths.js';

describe('IssueStatePaths', () => {
  describe('#paths', () => {
    it('resolves the state dir, state file, and lock file for the given repoPath/id', () => {
      const issueStatePaths = new IssueStatePaths();

      expect(issueStatePaths.paths('/repo', '42')).toEqual({
        stateDir: path.join('/repo', '.claude', 'state'),
        stateFile: path.join('/repo', '.claude', 'state', 'issue-42.json'),
        lockFile: path.join('/repo', '.claude', 'state', 'issue-42.lock')
      });
    });

    it('interpolates the given id into the file names', () => {
      const issueStatePaths = new IssueStatePaths();

      const { stateFile, lockFile } = issueStatePaths.paths('/repo', '7');

      expect(stateFile).toEqual(path.join('/repo', '.claude', 'state', 'issue-7.json'));
      expect(lockFile).toEqual(path.join('/repo', '.claude', 'state', 'issue-7.lock'));
    });
  });
});
