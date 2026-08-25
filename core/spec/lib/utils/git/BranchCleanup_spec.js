import BranchCleanup from '../../../../lib/utils/git/BranchCleanup.js';

const REPO_PATH = '/fake/repo';

/**
 * Build a fake `execFileAsync`, resolving every `git` call
 * successfully unless its joined argv contains one of `failOn`'s
 * substrings (in which case it rejects) — used by `cleanupBranch`'s
 * 4-command git sequence.
 * @param {object} [opts] - behavior overrides.
 * @param {string[]} [opts.failOn] - argv substrings that should reject.
 * @returns {Function} a jasmine spy usable as `execFileAsync`.
 */
function fakeExecFileAsync({ failOn = [] } = {}) {
  return jasmine.createSpy('execFileAsync').and.callFake(async (cmd, args) => {
    const joined = args.join(' ');

    if (failOn.some((pattern) => joined.includes(pattern))) {
      throw new Error(`fake exec failure: git ${joined}`);
    }

    return { stdout: '', stderr: '' };
  });
}

describe('BranchCleanup', () => {
  function newBranchCleanup(overrides = {}) {
    return new BranchCleanup({ execFileAsync: fakeExecFileAsync(), ...overrides });
  }

  describe('#cleanupBranch', () => {
    it('rejects when repoPath or id is missing', async () => {
      const branchCleanup = newBranchCleanup();

      await expectAsync(branchCleanup.cleanupBranch(REPO_PATH)).toBeRejectedWithError(
        'Usage: github.sh cleanup-branch <repo_path> <id>'
      );
    });

    it('runs the remote delete, checkout, reset, and local delete, in order', async () => {
      const execFileAsync = fakeExecFileAsync();
      const branchCleanup = newBranchCleanup({ execFileAsync });

      await expectAsync(branchCleanup.cleanupBranch(REPO_PATH, '5')).toBeResolvedTo('');

      const calls = execFileAsync.calls.allArgs().map(([cmd, args]) => `${cmd} ${args.join(' ')}`);

      expect(calls).toEqual([
        'git push origin --delete issue-5',
        'git checkout main',
        'git reset --hard origin/main',
        'git branch -D issue-5'
      ]);
    });

    it('forwards git checkout/reset --hard/branch -D\'s own stdout (unredirected in the shell script)', async () => {
      const execFileAsync = jasmine.createSpy('execFileAsync').and.callFake(async (cmd, args) => {
        if (args[0] === 'checkout') {
          return { stdout: 'Your branch is up to date with \'origin/main\'.\n', stderr: '' };
        }

        if (args[0] === 'reset') {
          return { stdout: 'HEAD is now at abc123 seed\n', stderr: '' };
        }

        if (args[0] === 'branch' && args[1] === '-D') {
          return { stdout: 'Deleted branch issue-5 (was def456).\n', stderr: '' };
        }

        return { stdout: '', stderr: '' };
      });
      const branchCleanup = newBranchCleanup({ execFileAsync });

      await expectAsync(branchCleanup.cleanupBranch(REPO_PATH, '5')).toBeResolvedTo(
        'Your branch is up to date with \'origin/main\'.\nHEAD is now at abc123 seed\nDeleted branch issue-5 (was def456).\n'
      );
    });

    it('tolerates a failed remote branch delete, still running the rest of the sequence', async () => {
      const execFileAsync = fakeExecFileAsync({ failOn: ['push origin --delete'] });
      const branchCleanup = newBranchCleanup({ execFileAsync });

      await expectAsync(branchCleanup.cleanupBranch(REPO_PATH, '5')).toBeResolvedTo('');
      expect(execFileAsync).toHaveBeenCalledTimes(4);
    });

    it('rejects when the checkout step fails (not tolerated)', async () => {
      const execFileAsync = fakeExecFileAsync({ failOn: ['checkout main'] });
      const branchCleanup = newBranchCleanup({ execFileAsync });

      await expectAsync(branchCleanup.cleanupBranch(REPO_PATH, '5')).toBeRejected();
    });
  });
});
