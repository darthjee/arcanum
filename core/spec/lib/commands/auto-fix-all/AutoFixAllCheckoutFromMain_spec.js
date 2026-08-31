import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import AutoFixAllCheckoutFromMain from '../../../../lib/commands/auto-fix-all/AutoFixAllCheckoutFromMain.js';
import DispatchFailure from '../../../../lib/utils/errors/DispatchFailure.js';
import { createGitFixtureRepo } from '../../../support/utils/gitFixtureRepo.js';

const execFileAsync = promisify(execFile);

/**
 * @param {string[]} args - the `git` arguments to run.
 * @param {string} cwd - the directory to run them in.
 * @returns {Promise<void>} resolves once the command succeeds.
 */
async function git(args, cwd) {
  await execFileAsync('git', args, {
    cwd,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 't@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 't@example.com'
    }
  });
}

describe('AutoFixAllCheckoutFromMain', () => {
  describe('#run (stubbed collaborators)', () => {
    it('rejects with the Usage error when repoPath is missing, before any git call', async () => {
      const execFileSpy = jasmine.createSpy('execFileAsync');
      const checkoutFromMain = new AutoFixAllCheckoutFromMain({ repoPath: '' }, { execFileAsync: execFileSpy });

      await expectAsync(checkoutFromMain.run('42')).toBeRejectedWithError(
        'Usage: checkout_from_main.sh <repo_path> <id>'
      );
      expect(execFileSpy).not.toHaveBeenCalled();
    });

    it('rejects with the Usage error when id is missing, before any git call', async () => {
      const execFileSpy = jasmine.createSpy('execFileAsync');
      const checkoutFromMain = new AutoFixAllCheckoutFromMain(
        { repoPath: '/repo' },
        { execFileAsync: execFileSpy }
      );

      await expectAsync(checkoutFromMain.run('')).toBeRejectedWithError(
        'Usage: checkout_from_main.sh <repo_path> <id>'
      );
      expect(execFileSpy).not.toHaveBeenCalled();
    });

    it('tolerates a missing-remote-ref fetch failure and proceeds', async () => {
      const missingRefError = Object.assign(new Error('fetch failed'), {
        stderr: 'fatal: couldn\'t find remote ref main\n'
      });
      const execFileSpy = jasmine.createSpy('execFileAsync').and.callFake((file, args) => {
        if (args[0] === 'fetch' && args[2] === 'main') {
          return Promise.reject(missingRefError);
        }

        if (args[0] === 'show-ref') {
          return Promise.reject(Object.assign(new Error('not found'), { code: 1 }));
        }

        return Promise.resolve({ stdout: '', stderr: '' });
      });
      const checkoutFromMain = new AutoFixAllCheckoutFromMain(
        { repoPath: '/repo' },
        { execFileAsync: execFileSpy }
      );

      await expectAsync(checkoutFromMain.run('42')).toBeResolvedTo('BRANCH=issue-42\nSTATUS=ok\n');
    });

    it('rejects with the shell-matching message on a non-tolerated main-fetch failure', async () => {
      const fetchError = Object.assign(new Error('fetch failed'), { stderr: 'fatal: unable to access remote\n' });
      const execFileSpy = jasmine.createSpy('execFileAsync').and.callFake((file, args) => {
        if (args[0] === 'fetch' && args[2] === 'main') {
          return Promise.reject(fetchError);
        }

        return Promise.resolve({ stdout: '', stderr: '' });
      });
      const checkoutFromMain = new AutoFixAllCheckoutFromMain(
        { repoPath: '/repo' },
        { execFileAsync: execFileSpy }
      );

      await expectAsync(checkoutFromMain.run('42')).toBeRejectedWithError(
        'Error: git fetch origin main failed: fatal: unable to access remote'
      );
    });

    it('rejects with the shell-matching message on a non-tolerated branch-fetch failure', async () => {
      const fetchError = Object.assign(new Error('fetch failed'), { stderr: 'fatal: unable to access remote\n' });
      const execFileSpy = jasmine.createSpy('execFileAsync').and.callFake((file, args) => {
        if (args[0] === 'fetch' && args[2] === 'main') {
          return Promise.resolve({ stdout: '', stderr: '' });
        }

        if (args[0] === 'fetch' && args[2] === 'issue-42') {
          return Promise.reject(fetchError);
        }

        return Promise.resolve({ stdout: '', stderr: '' });
      });
      const checkoutFromMain = new AutoFixAllCheckoutFromMain(
        { repoPath: '/repo' },
        { execFileAsync: execFileSpy }
      );

      await expectAsync(checkoutFromMain.run('42')).toBeRejectedWithError(
        'Error: git fetch origin issue-42 failed: fatal: unable to access remote'
      );
    });
  });

  describe('#run (real git repo, offline)', () => {
    let repo;

    afterEach(async () => {
      if (repo) {
        await repo.cleanup();
      }
    });

    it('creates issue-<id> from local main when there is no origin/main', async () => {
      repo = await createGitFixtureRepo();
      await git(['update-ref', '-d', 'refs/heads/main'], repo.remotePath);
      await git(['update-ref', '-d', 'refs/remotes/origin/main'], repo.repoPath);

      const checkoutFromMain = new AutoFixAllCheckoutFromMain({ repoPath: repo.repoPath });

      await expectAsync(checkoutFromMain.run('42')).toBeResolvedTo('BRANCH=issue-42\nSTATUS=ok\n');

      const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: repo.repoPath });
      expect(stdout.trim()).toEqual('issue-42');
    });

    it('creates issue-<id> from origin/main when it exists (default fixture shape)', async () => {
      repo = await createGitFixtureRepo();

      const checkoutFromMain = new AutoFixAllCheckoutFromMain({ repoPath: repo.repoPath });

      // `git checkout -b` from a remote-tracking start point (here,
      // origin/main) prints its own "branch '<name>' set up to track
      // '<upstream>'." line to stdout ahead of BRANCH=/STATUS= — see
      // AutoFixAllCheckoutFromMain#run's doc comment. Assert on the
      // substantive suffix rather than git's exact (version-dependent)
      // wording.
      const output = await checkoutFromMain.run('42');
      expect(output).toContain('BRANCH=issue-42\nSTATUS=ok\n');

      const { stdout: head } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: repo.repoPath });
      const { stdout: originMain } = await execFileAsync('git', ['rev-parse', 'origin/main'], { cwd: repo.repoPath });
      expect(head.trim()).toEqual(originMain.trim());
    });

    it('reuses an existing local branch behind origin/main and merges it cleanly', async () => {
      repo = await createGitFixtureRepo();
      await git(['branch', 'issue-42', 'main'], repo.repoPath);

      await writeFile(path.join(repo.repoPath, 'main-file.txt'), 'main update\n');
      await git(['add', 'main-file.txt'], repo.repoPath);
      await git(['commit', '--quiet', '-m', 'main update'], repo.repoPath);
      await git(['push', '--quiet', 'origin', 'main'], repo.repoPath);
      await git(['checkout', 'main'], repo.repoPath);

      const checkoutFromMain = new AutoFixAllCheckoutFromMain({ repoPath: repo.repoPath });

      await expectAsync(checkoutFromMain.run('42')).toBeResolvedTo('BRANCH=issue-42\nSTATUS=ok\n');

      const { stdout } = await execFileAsync('git', ['log', '--oneline', 'issue-42'], { cwd: repo.repoPath });
      expect(stdout).toContain('main update');
    });

    it('creates a local tracking branch from a remote-only branch, then merges', async () => {
      repo = await createGitFixtureRepo();
      await git(['checkout', '-b', 'issue-77', 'main'], repo.repoPath);
      await git(['push', '--quiet', 'origin', 'issue-77'], repo.repoPath);
      await git(['checkout', 'main'], repo.repoPath);
      await git(['branch', '-D', 'issue-77'], repo.repoPath);

      const checkoutFromMain = new AutoFixAllCheckoutFromMain({ repoPath: repo.repoPath });

      // See the comment in the previous test — `git checkout -b` from a
      // remote-tracking start point (here, origin/issue-77) also prints
      // its own tracking-setup line ahead of BRANCH=/STATUS=.
      const output = await checkoutFromMain.run('77');
      expect(output).toContain('BRANCH=issue-77\nSTATUS=ok\n');

      const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: repo.repoPath });
      expect(stdout.trim()).toEqual('issue-77');
    });

    it('rejects with a DispatchFailure (exit code 2) on a real merge conflict, leaving conflict markers', async () => {
      repo = await createGitFixtureRepo();
      // A non-fast-forward `git merge` (conflicting or not) needs a
      // committer identity available up front, before git even
      // determines whether it'll conflict — same precondition a real
      // caller of checkout_from_main.sh must already satisfy (this repo
      // has no ambient identity otherwise, unlike a real invocation
      // environment).
      await git(['config', 'user.name', 'Test'], repo.repoPath);
      await git(['config', 'user.email', 't@example.com'], repo.repoPath);
      await git(['checkout', '-b', 'issue-99', 'main'], repo.repoPath);
      await writeFile(path.join(repo.repoPath, 'README.md'), '# fixture (branch change)\n');
      await git(['add', 'README.md'], repo.repoPath);
      await git(['commit', '--quiet', '-m', 'branch change'], repo.repoPath);

      await git(['checkout', 'main'], repo.repoPath);
      await writeFile(path.join(repo.repoPath, 'README.md'), '# fixture (main change)\n');
      await git(['add', 'README.md'], repo.repoPath);
      await git(['commit', '--quiet', '-m', 'main change'], repo.repoPath);
      await git(['push', '--quiet', 'origin', 'main'], repo.repoPath);

      const checkoutFromMain = new AutoFixAllCheckoutFromMain({ repoPath: repo.repoPath });

      let thrown;

      try {
        await checkoutFromMain.run('99');
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(DispatchFailure);
      expect(thrown.exitCode).toEqual(2);
      // `git merge --no-edit`'s own conflict messages (Auto-merging/
      // CONFLICT/Automatic merge failed) print to stdout too, ahead of
      // the conflicted-file list — assert on the substantive
      // prefix/suffix rather than git's exact (version-dependent)
      // wording for the messages in between.
      expect(thrown.stdout).toContain('BRANCH=issue-99\nSTATUS=conflict\n');
      expect(thrown.stdout.endsWith('README.md\n')).toBeTrue();

      const { stdout } = await execFileAsync('git', ['diff', '--name-only', '--diff-filter=U'], {
        cwd: repo.repoPath
      });
      expect(stdout.trim()).toEqual('README.md');
    });
  });
});
