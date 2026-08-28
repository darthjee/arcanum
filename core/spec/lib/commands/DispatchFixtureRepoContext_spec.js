import DispatchFixtureRepoContext from '../../../lib/commands/DispatchFixtureRepoContext.js';

describe('DispatchFixtureRepoContext', () => {
  let fixture;

  beforeEach(() => {
    fixture = new DispatchFixtureRepoContext({ repoPath: '/fake/repo' });
  });

  describe('#run', () => {
    it('echoes the repoContext repoPath and joins its args', () => {
      expect(fixture.run('a', 'b')).toEqual('dispatch-fixture: repoPath=/fake/repo args=a,b\n');
    });

    it('handles being called with no args', () => {
      expect(fixture.run()).toEqual('dispatch-fixture: repoPath=/fake/repo args=\n');
    });
  });
});
