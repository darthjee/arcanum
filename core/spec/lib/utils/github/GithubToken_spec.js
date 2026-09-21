import GithubToken from '../../../../lib/utils/github/GithubToken.js';

// Builds a `execFileAsync` fake keyed by the `gh`/`git` argument string
// (e.g. `'auth token'`, `'config user.ghuser'`). `responses` maps that key
// to either a `{ stdout, stderr }` success payload or an `Error` to reject
// with; any call whose args aren't a listed key rejects with a generic
// `'unexpected call'` error. This removes the repeated
// `if (args.join(' ') === ...) { return ...; }` chains that used to be
// hand-copied into every test below.
function fakeExecFileAsync(responses) {
  return jasmine.createSpy('execFileAsync').and.callFake((file, args) => {
    const key = args.join(' ');
    const response = responses[key];

    if (!response) {
      return Promise.reject(new Error('unexpected call'));
    }

    return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
  });
}

// Shorthand for a successful `execFile` resolution.
function ok(stdout) {
  return { stdout, stderr: '' };
}

describe('GithubToken', () => {
  describe('#get', () => {
    const cases = [
      {
        description: 'returns the token from `gh auth token`',
        responses: { 'auth token': ok('gh-token-123\n') },
        expected: 'gh-token-123'
      },
      {
        description: 'falls back to `gh auth token --hostname github.com` when the plain call fails',
        responses: {
          'auth token': new Error('no default token'),
          'auth token --hostname github.com': ok('fallback-token\n')
        },
        expected: 'fallback-token'
      },
      {
        description: 'throws the exact auth-failure message when both token lookups fail',
        responses: {},
        expectedError: 'Error: could not obtain GitHub token via gh auth token'
      }
    ];

    for (const { description, responses, expected, expectedError } of cases) {
      it(description, async () => {
        const githubToken = new GithubToken({ execFileAsync: fakeExecFileAsync(responses) });

        if (expectedError) {
          await expectAsync(githubToken.get('/repo')).toBeRejectedWithError(expectedError);
        } else {
          await expectAsync(githubToken.get('/repo')).toBeResolvedTo(expected);
        }
      });
    }

    it('switches gh user first when git config user.ghuser is set locally', async () => {
      const execFileSpy = fakeExecFileAsync({
        'config user.ghuser': ok('octocat\n'),
        'auth switch --user octocat': ok(''),
        'auth token': ok('token\n')
      });
      const githubToken = new GithubToken({ execFileAsync: execFileSpy });

      await githubToken.get('/repo');

      expect(execFileSpy).toHaveBeenCalledWith('gh', ['auth', 'switch', '--user', 'octocat']);
    });

    it('does not fail the whole call when gh auth switch itself fails', async () => {
      const execFileSpy = fakeExecFileAsync({
        'config user.ghuser': ok('octocat\n'),
        'auth switch --user octocat': new Error('switch failed'),
        'auth token': ok('token\n')
      });
      const githubToken = new GithubToken({ execFileAsync: execFileSpy });

      await expectAsync(githubToken.get('/repo')).toBeResolvedTo('token');
    });

    const precedenceCases = [
      {
        description: 'falls back to `repoContext.repoPath` when no `repoPath` argument is passed',
        call: (githubToken) => githubToken.get(),
        expected: 'context-token',
        expectedCwd: '/repo'
      },
      {
        description: 'prefers an explicit `repoPath` argument over the constructor `repoContext`',
        call: (githubToken) => githubToken.get('/other'),
        expected: 'explicit-token',
        expectedCwd: '/other'
      }
    ];

    for (const { description, call, expected, expectedCwd } of precedenceCases) {
      it(description, async () => {
        const execFileSpy = fakeExecFileAsync({ 'auth token': ok(`${expected}\n`) });
        const githubToken = new GithubToken({ execFileAsync: execFileSpy, repoContext: { repoPath: '/repo' } });

        await expectAsync(call(githubToken)).toBeResolvedTo(expected);

        const configCall = execFileSpy.calls.allArgs().find(([, args]) => args.join(' ') === 'config user.ghuser');

        expect(configCall[2]).toEqual({ cwd: expectedCwd });
      });
    }
  });

  describe('#ghUser', () => {
    const cases = [
      {
        description: 'returns the local git config user.ghuser value, without switching or fetching a token',
        responses: { 'config user.ghuser': ok('octocat\n') },
        expected: 'octocat',
        expectedCallCount: 1
      },
      {
        description: 'falls back to the global git config value when the local one is unset',
        responses: { 'config --global user.ghuser': ok('global-user\n') },
        expected: 'global-user'
      },
      {
        description: 'resolves to an empty string when unset at both levels',
        responses: {},
        expected: ''
      }
    ];

    for (const { description, responses, expected, expectedCallCount } of cases) {
      it(description, async () => {
        const execFileSpy = fakeExecFileAsync(responses);
        const githubToken = new GithubToken({ execFileAsync: execFileSpy });

        await expectAsync(githubToken.ghUser('/repo')).toBeResolvedTo(expected);

        if (expectedCallCount) {
          expect(execFileSpy).toHaveBeenCalledTimes(expectedCallCount);
        }
      });
    }

    it('falls back to `repoContext.repoPath` when no `repoPath` argument is passed', async () => {
      const execFileSpy = fakeExecFileAsync({ 'config user.ghuser': ok('octocat\n') });
      const githubToken = new GithubToken({ execFileAsync: execFileSpy, repoContext: { repoPath: '/repo' } });

      await expectAsync(githubToken.ghUser()).toBeResolvedTo('octocat');

      expect(execFileSpy.calls.argsFor(0)[2]).toEqual({ cwd: '/repo' });
    });
  });
});
