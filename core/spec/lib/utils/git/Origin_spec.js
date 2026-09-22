import Origin from '../../../../lib/utils/git/Origin.js';
import { trackedExecFileAsync } from '../../../support/utils/execCallTracker.js';

/**
 * @param {string} stdout - the stubbed `git remote get-url origin` stdout.
 * @returns {Origin} an Origin instance whose execFileAsync always resolves to <stdout>.
 */
function originWithStdout(stdout) {
  return new Origin({ execFileAsync: async () => ({ stdout, stderr: '' }) });
}

/**
 * Assert that `Origin#resolve` parses `url` into `expected`.
 * @param {string} url - the stubbed `git remote get-url origin` stdout.
 * @param {{ domain: string, repo: string }} expected - the expected parsed origin.
 * @returns {Promise<void>} resolves once the assertion completes.
 */
async function parsesOrigin(url, expected) {
  const origin = originWithStdout(url);

  await expectAsync(origin.resolve('/repo')).toBeResolvedTo(expected);
}

const remoteUrlFixtures = [
  ['parses an ssh (git@) origin url', 'git@github.com:darthjee/arcanum.git\n', {
    domain: 'github.com',
    repo: 'darthjee/arcanum'
  }],
  ['parses an https origin url', 'https://github.com/darthjee/arcanum.git\n', {
    domain: 'github.com',
    repo: 'darthjee/arcanum'
  }],
  ['parses an https origin url without a trailing .git', 'https://github.com/darthjee/arcanum\n', {
    domain: 'github.com',
    repo: 'darthjee/arcanum'
  }],
  ['supports non-github.com ssh domains', 'git@github.enterprise.example.com:owner/repo.git\n', {
    domain: 'github.enterprise.example.com',
    repo: 'owner/repo'
  }],
  ['parses an ssh:// origin url', 'ssh://git@github.com/darthjee/arcanum.git\n', {
    domain: 'github.com',
    repo: 'darthjee/arcanum'
  }],
  ['parses an ssh:// origin url with a port, stripping it from the domain', 'ssh://git@github.com:22/darthjee/arcanum.git\n', {
    domain: 'github.com',
    repo: 'darthjee/arcanum'
  }],
  ['parses an ssh:// origin url without a user', 'ssh://github.com/darthjee/arcanum.git\n', {
    domain: 'github.com',
    repo: 'darthjee/arcanum'
  }]
];

/**
 * Register the shared `repoPath`-fallback/override test pair for `methodName`
 * (`resolve` or `resolveWithRef`), against the expected shape built by
 * `buildExpected`.
 * @param {string} methodName - the `Origin` method under test.
 * @param {() => object} buildExpected - builds the expected resolved value.
 * @returns {void}
 */
function repoPathResolutionCases(methodName, buildExpected) {
  it('falls back to `repoContext.repoPath` when no `repoPath` argument is passed', async () => {
    const { execFileAsync, calls } = trackedExecFileAsync('git@github.com:darthjee/arcanum.git\n');
    const origin = new Origin({ execFileAsync, repoContext: { repoPath: '/repo' } });

    await expectAsync(origin[methodName]()).toBeResolvedTo(buildExpected());

    expect(calls).toContain(['-C', '/repo', 'remote', 'get-url', 'origin']);
  });

  it('prefers an explicit `repoPath` argument over the constructor `repoContext`', async () => {
    const { execFileAsync, calls } = trackedExecFileAsync('git@github.com:darthjee/arcanum.git\n');
    const origin = new Origin({ execFileAsync, repoContext: { repoPath: '/repo' } });

    await expectAsync(origin[methodName]('/other')).toBeResolvedTo(buildExpected());

    expect(calls).toContain(['-C', '/other', 'remote', 'get-url', 'origin']);
  });
}

describe('Origin', () => {
  describe('#resolve', () => {
    remoteUrlFixtures.forEach(([description, url, expected]) => {
      it(description, async () => {
        await parsesOrigin(url, expected);
      });
    });

    repoPathResolutionCases('resolve', () => ({
      domain: 'github.com',
      repo: 'darthjee/arcanum'
    }));

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

    repoPathResolutionCases('resolveWithRef', () => ({
      domain: 'github.com',
      repo: 'darthjee/arcanum',
      repoRef: 'darthjee/arcanum'
    }));
  });
});
