import path from 'node:path';
import IssueStatePaths from '../../../../lib/utils/file/IssueStatePaths.js';
import { createRepoContextMock } from '../../../support/factories/repoContextFactory.js';

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

    describe('when constructed with a repoContext', () => {
      it('falls back to the repoContext repoPath when repoPath is omitted', () => {
        const repoContext = createRepoContextMock({ repoPath: '/repo' });
        const issueStatePaths = new IssueStatePaths({ repoContext });

        expect(issueStatePaths.paths(undefined, '42')).toEqual({
          stateDir: path.join('/repo', '.claude', 'state'),
          stateFile: path.join('/repo', '.claude', 'state', 'issue-42.json'),
          lockFile: path.join('/repo', '.claude', 'state', 'issue-42.lock')
        });
      });

      it('prefers an explicit repoPath over the constructor-injected repoContext', () => {
        const repoContext = createRepoContextMock({ repoPath: '/ctx-repo' });
        const issueStatePaths = new IssueStatePaths({ repoContext });

        expect(issueStatePaths.paths('/arg-repo', '42')).toEqual({
          stateDir: path.join('/arg-repo', '.claude', 'state'),
          stateFile: path.join('/arg-repo', '.claude', 'state', 'issue-42.json'),
          lockFile: path.join('/arg-repo', '.claude', 'state', 'issue-42.lock')
        });
      });
    });
  });
});
