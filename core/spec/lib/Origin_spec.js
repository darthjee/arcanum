import Origin from '../../lib/Origin.js';

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
});
