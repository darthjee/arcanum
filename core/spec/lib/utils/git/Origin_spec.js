import Origin from '../../../../lib/utils/git/Origin.js';

describe('Origin', () => {
  /**
   * @param {string} stdout - the stubbed `git remote get-url origin` stdout.
   * @returns {Origin} an Origin instance whose execFileAsync always resolves to <stdout>.
   */
  function originWithStdout(stdout) {
    return new Origin({ execFileAsync: async () => ({ stdout, stderr: '' }) });
  }

  describe('#resolve', () => {
    it('parses an ssh (git@) origin url', async () => {
      const origin = originWithStdout('git@github.com:darthjee/arcanum.git\n');

      await expectAsync(origin.resolve('/repo')).toBeResolvedTo({
        domain: 'github.com',
        repo: 'darthjee/arcanum'
      });
    });

    it('parses an https origin url', async () => {
      const origin = originWithStdout('https://github.com/darthjee/arcanum.git\n');

      await expectAsync(origin.resolve('/repo')).toBeResolvedTo({
        domain: 'github.com',
        repo: 'darthjee/arcanum'
      });
    });

    it('parses an https origin url without a trailing .git', async () => {
      const origin = originWithStdout('https://github.com/darthjee/arcanum\n');

      await expectAsync(origin.resolve('/repo')).toBeResolvedTo({
        domain: 'github.com',
        repo: 'darthjee/arcanum'
      });
    });

    it('supports non-github.com ssh domains', async () => {
      const origin = originWithStdout('git@github.enterprise.example.com:owner/repo.git\n');

      await expectAsync(origin.resolve('/repo')).toBeResolvedTo({
        domain: 'github.enterprise.example.com',
        repo: 'owner/repo'
      });
    });

    it('parses an ssh:// origin url', async () => {
      const origin = originWithStdout('ssh://git@github.com/darthjee/arcanum.git\n');

      await expectAsync(origin.resolve('/repo')).toBeResolvedTo({
        domain: 'github.com',
        repo: 'darthjee/arcanum'
      });
    });

    it('parses an ssh:// origin url with a port, stripping it from the domain', async () => {
      const origin = originWithStdout('ssh://git@github.com:22/darthjee/arcanum.git\n');

      await expectAsync(origin.resolve('/repo')).toBeResolvedTo({
        domain: 'github.com',
        repo: 'darthjee/arcanum'
      });
    });

    it('parses an ssh:// origin url without a user', async () => {
      const origin = originWithStdout('ssh://github.com/darthjee/arcanum.git\n');

      await expectAsync(origin.resolve('/repo')).toBeResolvedTo({
        domain: 'github.com',
        repo: 'darthjee/arcanum'
      });
    });

    it('errors when the repo has no origin remote', async () => {
      const origin = new Origin({
        execFileAsync: async () => {
          throw new Error('not a git repo');
        }
      });

      await expectAsync(origin.resolve('/repo')).toBeRejectedWithError(
        'Error: \'/repo\' is not a git repository or has no \'origin\' remote'
      );
    });

    it('errors on an unrecognized origin url format', async () => {
      const origin = originWithStdout('/local/path/to/remote.git\n');

      await expectAsync(origin.resolve('/repo')).toBeRejectedWithError(
        'Error: unrecognized origin format: /local/path/to/remote.git'
      );
    });

    it('falls back to `repoContext.repoPath` when no `repoPath` argument is passed', async () => {
      const calls = [];
      const execFileSpy = jasmine.createSpy('execFileAsync').and.callFake((file, args) => {
        calls.push(args);

        return Promise.resolve({ stdout: 'git@github.com:darthjee/arcanum.git\n', stderr: '' });
      });
      const origin = new Origin({ execFileAsync: execFileSpy, repoContext: { repoPath: '/repo' } });

      await expectAsync(origin.resolve()).toBeResolvedTo({
        domain: 'github.com',
        repo: 'darthjee/arcanum'
      });

      expect(calls).toContain(['-C', '/repo', 'remote', 'get-url', 'origin']);
    });

    it('prefers an explicit `repoPath` argument over the constructor `repoContext`', async () => {
      const calls = [];
      const execFileSpy = jasmine.createSpy('execFileAsync').and.callFake((file, args) => {
        calls.push(args);

        return Promise.resolve({ stdout: 'git@github.com:darthjee/arcanum.git\n', stderr: '' });
      });
      const origin = new Origin({ execFileAsync: execFileSpy, repoContext: { repoPath: '/repo' } });

      await expectAsync(origin.resolve('/other')).toBeResolvedTo({
        domain: 'github.com',
        repo: 'darthjee/arcanum'
      });

      expect(calls).toContain(['-C', '/other', 'remote', 'get-url', 'origin']);
    });
  });

  describe('#resolveWithRef', () => {
    it('leaves the repoRef unqualified for a github.com origin', async () => {
      const origin = originWithStdout('git@github.com:darthjee/arcanum.git\n');

      await expectAsync(origin.resolveWithRef('/repo')).toBeResolvedTo({
        domain: 'github.com',
        repo: 'darthjee/arcanum',
        repoRef: 'darthjee/arcanum'
      });
    });

    it('domain-qualifies the repoRef for a non-github.com origin', async () => {
      const origin = originWithStdout('git@github.enterprise.example.com:owner/repo.git\n');

      await expectAsync(origin.resolveWithRef('/repo')).toBeResolvedTo({
        domain: 'github.enterprise.example.com',
        repo: 'owner/repo',
        repoRef: 'github.enterprise.example.com/owner/repo'
      });
    });

    it('propagates a resolve failure', async () => {
      const origin = new Origin({
        execFileAsync: async () => {
          throw new Error('not a git repo');
        }
      });

      await expectAsync(origin.resolveWithRef('/repo')).toBeRejectedWithError(
        'Error: \'/repo\' is not a git repository or has no \'origin\' remote'
      );
    });

    it('falls back to `repoContext.repoPath` when no `repoPath` argument is passed', async () => {
      const calls = [];
      const execFileSpy = jasmine.createSpy('execFileAsync').and.callFake((file, args) => {
        calls.push(args);

        return Promise.resolve({ stdout: 'git@github.com:darthjee/arcanum.git\n', stderr: '' });
      });
      const origin = new Origin({ execFileAsync: execFileSpy, repoContext: { repoPath: '/repo' } });

      await expectAsync(origin.resolveWithRef()).toBeResolvedTo({
        domain: 'github.com',
        repo: 'darthjee/arcanum',
        repoRef: 'darthjee/arcanum'
      });

      expect(calls).toContain(['-C', '/repo', 'remote', 'get-url', 'origin']);
    });

    it('prefers an explicit `repoPath` argument over the constructor `repoContext`', async () => {
      const calls = [];
      const execFileSpy = jasmine.createSpy('execFileAsync').and.callFake((file, args) => {
        calls.push(args);

        return Promise.resolve({ stdout: 'git@github.com:darthjee/arcanum.git\n', stderr: '' });
      });
      const origin = new Origin({ execFileAsync: execFileSpy, repoContext: { repoPath: '/repo' } });

      await expectAsync(origin.resolveWithRef('/other')).toBeResolvedTo({
        domain: 'github.com',
        repo: 'darthjee/arcanum',
        repoRef: 'darthjee/arcanum'
      });

      expect(calls).toContain(['-C', '/other', 'remote', 'get-url', 'origin']);
    });
  });
});
