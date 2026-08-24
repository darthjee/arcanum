import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import RepoConfig from '../../../lib/utils/config/RepoConfig.js';
import SafeBranch from '../../../lib/commands/SafeBranch.js';
import { createGitFixtureRepo } from '../../support/utils/gitFixtureRepo.js';

const execFileAsync = promisify(execFile);

describe('SafeBranch', () => {
  describe('#run', () => {
    it('short-circuits before checkout when repo-path validation fails', async () => {
      const validationError = new Error('Error: not a directory: /nope');
      const repoPath = { validate: jasmine.createSpy('validate').and.rejectWith(validationError) };
      const execFileSpy = jasmine.createSpy('execFileAsync');
      const safeBranch = new SafeBranch({ execFileAsync: execFileSpy, repoPath });

      await expectAsync(safeBranch.run('/nope')).toBeRejectedWith(validationError);
      expect(execFileSpy).not.toHaveBeenCalled();
    });

    it('returns BRANCH=<branch> on success, after validating the repo path', async () => {
      const repoPath = { validate: jasmine.createSpy('validate').and.resolveTo(undefined) };
      const execFileSpy = jasmine
        .createSpy('execFileAsync')
        .and.callFake(() => Promise.resolve({ stdout: '', stderr: '' }));
      const repoConfig = { getSafeBranch: async () => 'origin/develop' };
      const safeBranch = new SafeBranch({ execFileAsync: execFileSpy, repoConfig, repoPath });

      await expectAsync(safeBranch.run('/repo')).toBeResolvedTo('BRANCH=origin/develop\n');
      expect(repoPath.validate).toHaveBeenCalledWith('/repo');
    });

    it('propagates the checkout hard failure (dirty tree) without a BRANCH= line', async () => {
      const repoPath = { validate: jasmine.createSpy('validate').and.resolveTo(undefined) };
      const dirtyError = Object.assign(new Error('diff found changes'), { code: 1 });
      const execFileSpy = jasmine.createSpy('execFileAsync').and.callFake((file, args) => {
        if (args[0] === 'diff') {
          return Promise.reject(dirtyError);
        }

        return Promise.resolve({ stdout: '', stderr: '' });
      });
      const safeBranch = new SafeBranch({ execFileAsync: execFileSpy, repoPath });

      await expectAsync(safeBranch.run('/repo')).toBeRejectedWithError(/uncommitted changes/);
    });
  });

  describe('#checkout (stubbed collaborators)', () => {
    it('throws without checking out when the working tree has uncommitted changes', async () => {
      const dirtyError = Object.assign(new Error('diff found changes'), { code: 1 });
      const execFileSpy = jasmine.createSpy('execFileAsync').and.callFake((file, args) => {
        if (args[0] === 'diff') {
          return Promise.reject(dirtyError);
        }

        return Promise.resolve({ stdout: '', stderr: '' });
      });
      const safeBranch = new SafeBranch({ execFileAsync: execFileSpy });

      await expectAsync(safeBranch.checkout('/repo')).toBeRejectedWithError(/uncommitted changes/);
      expect(execFileSpy).not.toHaveBeenCalledWith('git', ['fetch', '-p'], jasmine.anything());
    });

    it('fetches and checks out the configured safe branch when the tree is clean', async () => {
      const calls = [];
      const execFileSpy = jasmine.createSpy('execFileAsync').and.callFake((file, args) => {
        calls.push(args);

        return Promise.resolve({ stdout: '', stderr: '' });
      });
      const repoConfig = { getSafeBranch: async () => 'origin/develop' };
      const safeBranch = new SafeBranch({ execFileAsync: execFileSpy, repoConfig });

      await safeBranch.checkout('/repo');

      expect(calls).toContain(['fetch', '-p']);
      expect(calls).toContain(['checkout', 'origin/develop']);
    });

    it('propagates unexpected git errors instead of treating them as "dirty"', async () => {
      const unexpectedError = Object.assign(new Error('git not found'), { code: 127 });
      const execFileSpy = jasmine.createSpy('execFileAsync').and.callFake(() => Promise.reject(unexpectedError));
      const safeBranch = new SafeBranch({ execFileAsync: execFileSpy });

      await expectAsync(safeBranch.checkout('/repo')).toBeRejectedWith(unexpectedError);
    });
  });

  describe('#checkout (real git repo, offline)', () => {
    let repo;

    afterEach(async () => {
      if (repo) {
        await repo.cleanup();
      }
    });

    it('checks out origin/main by default, purely offline', async () => {
      repo = await createGitFixtureRepo();

      const safeBranch = new SafeBranch();

      await safeBranch.checkout(repo.repoPath);

      const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: repo.repoPath });
      const { stdout: originMain } = await execFileAsync('git', ['rev-parse', 'origin/main'], { cwd: repo.repoPath });

      expect(stdout.trim()).toEqual(originMain.trim());
    });

    it('respects a configured git.safe_branch', async () => {
      repo = await createGitFixtureRepo();
      await execFileAsync('git', ['checkout', '-b', 'other', 'origin/main'], { cwd: repo.repoPath });
      await execFileAsync('git', ['push', repo.remotePath, 'other'], { cwd: repo.repoPath });

      const repoConfig = new RepoConfig();
      spyOn(repoConfig, 'getSafeBranch').and.resolveTo('origin/other');
      const safeBranch = new SafeBranch({ repoConfig });

      await safeBranch.checkout(repo.repoPath);

      const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: repo.repoPath });
      const { stdout: originOther } = await execFileAsync('git', ['rev-parse', 'origin/other'], { cwd: repo.repoPath });

      expect(stdout.trim()).toEqual(originOther.trim());
    });

    it('throws on a dirty tracked-file working tree without checking out', async () => {
      repo = await createGitFixtureRepo();
      await writeFile(path.join(repo.repoPath, 'README.md'), '# fixture (modified)\n');

      const safeBranch = new SafeBranch();

      await expectAsync(safeBranch.checkout(repo.repoPath)).toBeRejectedWithError(/uncommitted changes/);
    });
  });
});
