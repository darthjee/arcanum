import GithubToken from '../../../../lib/utils/github/GithubToken.js';

describe('GithubToken', () => {
  describe('#get', () => {
    it('returns the token from `gh auth token`', async () => {
      const execFileSpy = jasmine.createSpy('execFileAsync').and.callFake((file, args) => {
        if (args[0] === 'config') {
          return Promise.reject(new Error('not set'));
        }

        if (args.join(' ') === 'auth token') {
          return Promise.resolve({ stdout: 'gh-token-123\n', stderr: '' });
        }

        return Promise.reject(new Error('unexpected call'));
      });
      const githubToken = new GithubToken({ execFileAsync: execFileSpy });

      await expectAsync(githubToken.get('/repo')).toBeResolvedTo('gh-token-123');
    });

    it('falls back to `gh auth token --hostname github.com` when the plain call fails', async () => {
      const execFileSpy = jasmine.createSpy('execFileAsync').and.callFake((file, args) => {
        if (args[0] === 'config') {
          return Promise.reject(new Error('not set'));
        }

        if (args.join(' ') === 'auth token') {
          return Promise.reject(new Error('no default token'));
        }

        if (args.join(' ') === 'auth token --hostname github.com') {
          return Promise.resolve({ stdout: 'fallback-token\n', stderr: '' });
        }

        return Promise.reject(new Error('unexpected call'));
      });
      const githubToken = new GithubToken({ execFileAsync: execFileSpy });

      await expectAsync(githubToken.get('/repo')).toBeResolvedTo('fallback-token');
    });

    it('throws the exact auth-failure message when both token lookups fail', async () => {
      const execFileSpy = jasmine.createSpy('execFileAsync').and.returnValue(Promise.reject(new Error('nope')));
      const githubToken = new GithubToken({ execFileAsync: execFileSpy });

      await expectAsync(githubToken.get('/repo')).toBeRejectedWithError(
        'Error: could not obtain GitHub token via gh auth token'
      );
    });

    it('switches gh user first when git config user.ghuser is set locally', async () => {
      const calls = [];
      const execFileSpy = jasmine.createSpy('execFileAsync').and.callFake((file, args) => {
        calls.push(args);

        if (args.join(' ') === 'config user.ghuser') {
          return Promise.resolve({ stdout: 'octocat\n', stderr: '' });
        }

        if (args.join(' ') === 'auth switch --user octocat') {
          return Promise.resolve({ stdout: '', stderr: '' });
        }

        if (args.join(' ') === 'auth token') {
          return Promise.resolve({ stdout: 'token\n', stderr: '' });
        }

        return Promise.reject(new Error('unexpected call'));
      });
      const githubToken = new GithubToken({ execFileAsync: execFileSpy });

      await githubToken.get('/repo');

      expect(calls).toContain(['auth', 'switch', '--user', 'octocat']);
    });

    it('does not fail the whole call when gh auth switch itself fails', async () => {
      const execFileSpy = jasmine.createSpy('execFileAsync').and.callFake((file, args) => {
        if (args.join(' ') === 'config user.ghuser') {
          return Promise.resolve({ stdout: 'octocat\n', stderr: '' });
        }

        if (args.join(' ') === 'auth switch --user octocat') {
          return Promise.reject(new Error('switch failed'));
        }

        if (args.join(' ') === 'auth token') {
          return Promise.resolve({ stdout: 'token\n', stderr: '' });
        }

        return Promise.reject(new Error('unexpected call'));
      });
      const githubToken = new GithubToken({ execFileAsync: execFileSpy });

      await expectAsync(githubToken.get('/repo')).toBeResolvedTo('token');
    });

    it('falls back to `repoContext.repoPath` when no `repoPath` argument is passed', async () => {
      const calls = [];
      const execFileSpy = jasmine.createSpy('execFileAsync').and.callFake((file, args, options) => {
        calls.push({ args, options });

        if (args.join(' ') === 'config user.ghuser') {
          return Promise.reject(new Error('not set'));
        }

        if (args.join(' ') === 'auth token') {
          return Promise.resolve({ stdout: 'context-token\n', stderr: '' });
        }

        return Promise.reject(new Error('unexpected call'));
      });
      const githubToken = new GithubToken({ execFileAsync: execFileSpy, repoContext: { repoPath: '/repo' } });

      await expectAsync(githubToken.get()).toBeResolvedTo('context-token');

      const configCall = calls.find(({ args }) => args.join(' ') === 'config user.ghuser');

      expect(configCall.options).toEqual({ cwd: '/repo' });
    });

    it('prefers an explicit `repoPath` argument over the constructor `repoContext`', async () => {
      const calls = [];
      const execFileSpy = jasmine.createSpy('execFileAsync').and.callFake((file, args, options) => {
        calls.push({ args, options });

        if (args.join(' ') === 'config user.ghuser') {
          return Promise.reject(new Error('not set'));
        }

        if (args.join(' ') === 'auth token') {
          return Promise.resolve({ stdout: 'explicit-token\n', stderr: '' });
        }

        return Promise.reject(new Error('unexpected call'));
      });
      const githubToken = new GithubToken({ execFileAsync: execFileSpy, repoContext: { repoPath: '/repo' } });

      await expectAsync(githubToken.get('/other')).toBeResolvedTo('explicit-token');

      const configCall = calls.find(({ args }) => args.join(' ') === 'config user.ghuser');

      expect(configCall.options).toEqual({ cwd: '/other' });
    });
  });

  describe('#ghUser', () => {
    it('returns the local git config user.ghuser value, without switching or fetching a token', async () => {
      const execFileSpy = jasmine.createSpy('execFileAsync').and.callFake((file, args) => {
        if (args.join(' ') === 'config user.ghuser') {
          return Promise.resolve({ stdout: 'octocat\n', stderr: '' });
        }

        return Promise.reject(new Error('unexpected call'));
      });
      const githubToken = new GithubToken({ execFileAsync: execFileSpy });

      await expectAsync(githubToken.ghUser('/repo')).toBeResolvedTo('octocat');
      expect(execFileSpy).toHaveBeenCalledTimes(1);
    });

    it('falls back to the global git config value when the local one is unset', async () => {
      const execFileSpy = jasmine.createSpy('execFileAsync').and.callFake((file, args) => {
        if (args.join(' ') === 'config user.ghuser') {
          return Promise.reject(new Error('not set'));
        }

        if (args.join(' ') === 'config --global user.ghuser') {
          return Promise.resolve({ stdout: 'global-user\n', stderr: '' });
        }

        return Promise.reject(new Error('unexpected call'));
      });
      const githubToken = new GithubToken({ execFileAsync: execFileSpy });

      await expectAsync(githubToken.ghUser('/repo')).toBeResolvedTo('global-user');
    });

    it('resolves to an empty string when unset at both levels', async () => {
      const execFileSpy = jasmine.createSpy('execFileAsync').and.returnValue(Promise.reject(new Error('not set')));
      const githubToken = new GithubToken({ execFileAsync: execFileSpy });

      await expectAsync(githubToken.ghUser('/repo')).toBeResolvedTo('');
    });

    it('falls back to `repoContext.repoPath` when no `repoPath` argument is passed', async () => {
      const calls = [];
      const execFileSpy = jasmine.createSpy('execFileAsync').and.callFake((file, args, options) => {
        calls.push({ args, options });

        if (args.join(' ') === 'config user.ghuser') {
          return Promise.resolve({ stdout: 'octocat\n', stderr: '' });
        }

        return Promise.reject(new Error('unexpected call'));
      });
      const githubToken = new GithubToken({ execFileAsync: execFileSpy, repoContext: { repoPath: '/repo' } });

      await expectAsync(githubToken.ghUser()).toBeResolvedTo('octocat');
      expect(calls[0].options).toEqual({ cwd: '/repo' });
    });
  });
});
