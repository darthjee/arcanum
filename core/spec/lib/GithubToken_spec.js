import GithubToken from '../../lib/GithubToken.js';

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
  });
});
