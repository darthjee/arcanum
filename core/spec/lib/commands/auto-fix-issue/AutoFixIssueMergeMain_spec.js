import AutoFixIssueMergeMain from '../../../../lib/commands/auto-fix-issue/AutoFixIssueMergeMain.js';
import DispatchFailure from '../../../../lib/utils/errors/DispatchFailure.js';

const REPO_PATH = '/repo/path';

/**
 * Build a fake `execFileAsync` implementation that answers the `git`
 * subcommands `AutoFixIssueMergeMain` issues (`fetch`, `show-ref`,
 * `merge`, `diff`), tracking every invocation so tests never shell out to
 * real `git`.
 * @param {object} [opts] - behavior overrides.
 * @param {boolean} [opts.originMainExists] - whether `git show-ref
 *   --verify --quiet refs/remotes/origin/main` should resolve (ref
 *   exists) or reject (ref doesn't exist).
 * @param {boolean} [opts.mergeConflict] - whether `git merge --no-edit
 *   origin/main` should reject with a conflict.
 * @param {string} [opts.mergeStdout] - the conflicting merge's own
 *   stdout, attached to the rejected error.
 * @param {string} [opts.diffStdout] - `git diff --name-only
 *   --diff-filter=U`'s stdout.
 * @param {Error} [opts.fetchError] - if set, `git fetch origin main`
 *   rejects with this error instead of resolving.
 * @returns {Function} a jasmine spy usable as `execFileAsync`.
 */
function fakeExecFileAsync({
  originMainExists = true,
  mergeConflict = false,
  mergeStdout = '',
  diffStdout = '',
  fetchError = null
} = {}) {
  return jasmine.createSpy('execFileAsync').and.callFake(async (cmd, args) => {
    if (cmd !== 'git') {
      throw new Error(`unexpected command: ${cmd}`);
    }

    if (args[0] === 'fetch') {
      if (fetchError) {
        throw fetchError;
      }

      return { stdout: '' };
    }

    if (args[0] === 'show-ref') {
      if (originMainExists) {
        return { stdout: '' };
      }

      const error = new Error('not found');
      error.code = 1;
      throw error;
    }

    if (args[0] === 'merge') {
      if (mergeConflict) {
        const error = new Error('merge conflict');
        error.stdout = mergeStdout;
        throw error;
      }

      return { stdout: '' };
    }

    if (args[0] === 'diff') {
      return { stdout: diffStdout };
    }

    throw new Error(`unexpected git invocation: ${JSON.stringify(args)}`);
  });
}

describe('AutoFixIssueMergeMain', () => {
  describe('#run', () => {
    it('resolves STATUS=ok and makes no merge call when origin/main does not exist', async () => {
      const execFileAsync = fakeExecFileAsync({ originMainExists: false });
      const instance = new AutoFixIssueMergeMain({ repoPath: REPO_PATH }, { execFileAsync });

      const result = await instance.run();

      expect(result).toBe('STATUS=ok\n');
      expect(execFileAsync).toHaveBeenCalledWith('git', ['fetch', 'origin', 'main'], { cwd: REPO_PATH });
      expect(execFileAsync).toHaveBeenCalledWith(
        'git', ['show-ref', '--verify', '--quiet', 'refs/remotes/origin/main'], { cwd: REPO_PATH }
      );
      expect(execFileAsync).not.toHaveBeenCalledWith('git', jasmine.arrayContaining(['merge']), jasmine.anything());
    });

    it('resolves STATUS=ok when the merge completes cleanly', async () => {
      const execFileAsync = fakeExecFileAsync({ originMainExists: true, mergeConflict: false });
      const instance = new AutoFixIssueMergeMain({ repoPath: REPO_PATH }, { execFileAsync });

      const result = await instance.run();

      expect(result).toBe('STATUS=ok\n');
      expect(execFileAsync).toHaveBeenCalledWith(
        'git', ['merge', '--no-edit', 'origin/main'], { cwd: REPO_PATH }
      );
    });

    it('rejects with a DispatchFailure carrying STATUS=conflict and the conflicted files, exit code 2', async () => {
      const execFileAsync = fakeExecFileAsync({
        originMainExists: true,
        mergeConflict: true,
        mergeStdout: 'Auto-merging file.txt\nCONFLICT (content): Merge conflict in file.txt\n',
        diffStdout: 'file1.txt\nfile2.txt\n'
      });
      const instance = new AutoFixIssueMergeMain({ repoPath: REPO_PATH }, { execFileAsync });

      const error = await instance.run().then(
        () => Promise.reject(new Error('expected run() to reject')),
        (rejected) => rejected
      );

      expect(error).toBeInstanceOf(DispatchFailure);
      expect(error.stdout).toBe(
        'STATUS=conflict\nAuto-merging file.txt\nCONFLICT (content): Merge conflict in file.txt\n' +
        'file1.txt\nfile2.txt\n'
      );
      expect(error.exitCode).toBe(2);
      expect(execFileAsync).toHaveBeenCalledWith(
        'git', ['diff', '--name-only', '--diff-filter=U'], { cwd: REPO_PATH }
      );
    });

    it('treats a tolerated fetch failure (missing remote ref) as STATUS=ok, no origin/main', async () => {
      const fetchError = new Error('fetch failed');
      fetchError.stderr = 'fatal: couldn\'t find remote ref main\n';
      const execFileAsync = fakeExecFileAsync({ fetchError, originMainExists: false });
      const instance = new AutoFixIssueMergeMain({ repoPath: REPO_PATH }, { execFileAsync });

      const result = await instance.run();

      expect(result).toBe('STATUS=ok\n');
    });

    it('propagates an unrelated fetch failure as a thrown Error', async () => {
      const fetchError = new Error('fetch failed');
      fetchError.stderr = 'fatal: unable to access remote: connection refused\n';
      const execFileAsync = fakeExecFileAsync({ fetchError });
      const instance = new AutoFixIssueMergeMain({ repoPath: REPO_PATH }, { execFileAsync });

      await expectAsync(instance.run()).toBeRejected();
      expect(execFileAsync).not.toHaveBeenCalledWith(
        'git', ['show-ref', '--verify', '--quiet', 'refs/remotes/origin/main'], { cwd: REPO_PATH }
      );
    });
  });
});
