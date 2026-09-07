import path from 'node:path';
import IssueStatePaths from '../../../../lib/utils/file/IssueStatePaths.js';
import { createRepoContextMock } from '../../../support/factories/repoContextFactory.js';

describe('IssueStatePaths', () => {
  describe('#paths', () => {
    describe('when constructed with a repoContext', () => {
      it('resolves the state dir, state file, and lock file from the repoContext repoPath', () => {
        const repoContext = createRepoContextMock({ repoPath: '/repo' });
        const issueStatePaths = new IssueStatePaths(repoContext);

        expect(issueStatePaths.paths('42')).toEqual({
          stateDir: path.join('/repo', '.claude', 'state'),
          stateFile: path.join('/repo', '.claude', 'state', 'issue-42.json'),
          lockFile: path.join('/repo', '.claude', 'state', 'issue-42.lock')
        });
      });
    });
  });
});
