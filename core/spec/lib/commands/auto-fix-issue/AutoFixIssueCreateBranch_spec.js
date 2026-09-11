import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import AutoFixIssueCreateBranch from '../../../../lib/commands/auto-fix-issue/AutoFixIssueCreateBranch.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

const PLAN_DIR = 'plan-dir';
const ID = '999';

/**
 * Build a fake `execFileAsync` implementation that answers the `git`
 * subcommands `AutoFixIssueCreateBranch` issues (`show-ref`, `checkout`),
 * tracking every invocation so tests never shell out to real `git`.
 * @param {object} [opts] - behavior overrides.
 * @param {boolean} [opts.branchExists] - whether `git show-ref --verify
 *   --quiet refs/heads/<branch>` should resolve (branch exists) or
 *   reject (branch doesn't exist).
 * @returns {Function} a jasmine spy usable as `execFileAsync`.
 */
function fakeExecFileAsync({ branchExists = false } = {}) {
  return jasmine.createSpy('execFileAsync').and.callFake(async (cmd, args) => {
    if (cmd !== 'git') {
      throw new Error(`unexpected command: ${cmd}`);
    }

    if (args[0] === 'show-ref') {
      if (branchExists) {
        return { stdout: '' };
      }

      const error = new Error('not found');
      error.code = 1;
      throw error;
    }

    if (args[0] === 'checkout') {
      return { stdout: '' };
    }

    throw new Error(`unexpected git invocation: ${JSON.stringify(args)}`);
  });
}

describe('AutoFixIssueCreateBranch', () => {
  let repoPath;

  beforeEach(async () => {
    repoPath = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  /**
   * @param {string} content - the `plan.md` file's contents.
   * @returns {Promise<void>} resolves once `<repoPath>/<PLAN_DIR>/plan.md`
   *   has been written.
   */
  async function writePlanFile(content) {
    await mkdir(path.join(repoPath, PLAN_DIR), { recursive: true });
    await writeFile(path.join(repoPath, PLAN_DIR, 'plan.md'), content);
  }

  describe('#run', () => {
    describe('argument validation', () => {
      it('throws the usage message when planDir is missing', async () => {
        const execFileAsync = fakeExecFileAsync();
        const instance = new AutoFixIssueCreateBranch({ repoPath }, { execFileAsync });

        await expectAsync(instance.run('', ID)).toBeRejectedWithError(
          'Usage: create_branch.sh <repo_path> <plan_dir> <id>'
        );
        expect(execFileAsync).not.toHaveBeenCalled();
      });

      it('throws the usage message when id is missing', async () => {
        const execFileAsync = fakeExecFileAsync();
        const instance = new AutoFixIssueCreateBranch({ repoPath }, { execFileAsync });

        await expectAsync(instance.run(PLAN_DIR, '')).toBeRejectedWithError(
          'Usage: create_branch.sh <repo_path> <plan_dir> <id>'
        );
        expect(execFileAsync).not.toHaveBeenCalled();
      });

      it('throws the usage message when repoPath is missing', async () => {
        const execFileAsync = fakeExecFileAsync();
        const instance = new AutoFixIssueCreateBranch({ repoPath: '' }, { execFileAsync });

        await expectAsync(instance.run(PLAN_DIR, ID)).toBeRejectedWithError(
          'Usage: create_branch.sh <repo_path> <plan_dir> <id>'
        );
        expect(execFileAsync).not.toHaveBeenCalled();
      });
    });

    describe('checkout vs. create', () => {
      it('checks out the branch (no -b) when it already exists locally', async () => {
        await writePlanFile('## Branch\n\n`my-branch`\n');
        const execFileAsync = fakeExecFileAsync({ branchExists: true });
        const instance = new AutoFixIssueCreateBranch({ repoPath }, { execFileAsync });

        const result = await instance.run(PLAN_DIR, ID);

        expect(result).toBe('my-branch\n');
        expect(execFileAsync).toHaveBeenCalledWith(
          'git', ['show-ref', '--verify', '--quiet', 'refs/heads/my-branch'], { cwd: repoPath }
        );
        expect(execFileAsync).toHaveBeenCalledWith('git', ['checkout', 'my-branch'], { cwd: repoPath });
      });

      it('creates the branch (-b) when it does not exist locally', async () => {
        await writePlanFile('## Branch\n\n`my-branch`\n');
        const execFileAsync = fakeExecFileAsync({ branchExists: false });
        const instance = new AutoFixIssueCreateBranch({ repoPath }, { execFileAsync });

        const result = await instance.run(PLAN_DIR, ID);

        expect(result).toBe('my-branch\n');
        expect(execFileAsync).toHaveBeenCalledWith('git', ['checkout', '-b', 'my-branch'], { cwd: repoPath });
      });
    });

    describe('branch name resolution', () => {
      it('falls back to issue-<id> when plan.md does not exist', async () => {
        const execFileAsync = fakeExecFileAsync({ branchExists: false });
        const instance = new AutoFixIssueCreateBranch({ repoPath }, { execFileAsync });

        const result = await instance.run(PLAN_DIR, ID);

        expect(result).toBe('issue-999\n');
        expect(execFileAsync).toHaveBeenCalledWith('git', ['checkout', '-b', 'issue-999'], { cwd: repoPath });
      });

      it('falls back to issue-<id> when plan.md has no ## Branch section', async () => {
        await writePlanFile('# Plan\n\nSome content, no branch heading.\n');
        const execFileAsync = fakeExecFileAsync({ branchExists: false });
        const instance = new AutoFixIssueCreateBranch({ repoPath }, { execFileAsync });

        const result = await instance.run(PLAN_DIR, ID);

        expect(result).toBe('issue-999\n');
      });

      it('extracts the branch name stripped of backticks and surrounding whitespace', async () => {
        await writePlanFile('## Branch\n\n  `my-branch`  \n');
        const execFileAsync = fakeExecFileAsync({ branchExists: false });
        const instance = new AutoFixIssueCreateBranch({ repoPath }, { execFileAsync });

        const result = await instance.run(PLAN_DIR, ID);

        expect(result).toBe('my-branch\n');
      });

      it('falls back to issue-<id> when the extracted branch name is empty', async () => {
        await writePlanFile('## Branch\n\n` `\n');
        const execFileAsync = fakeExecFileAsync({ branchExists: false });
        const instance = new AutoFixIssueCreateBranch({ repoPath }, { execFileAsync });

        const result = await instance.run(PLAN_DIR, ID);

        expect(result).toBe('issue-999\n');
      });
    });

    describe('git failure propagation', () => {
      it('propagates a rejecting git checkout call as a thrown Error', async () => {
        await writePlanFile('## Branch\n\n`my-branch`\n');
        const execFileAsync = jasmine.createSpy('execFileAsync').and.callFake(async (cmd, args) => {
          if (args[0] === 'show-ref') {
            const error = new Error('not found');
            error.code = 1;
            throw error;
          }

          if (args[0] === 'checkout') {
            throw new Error('git checkout failed');
          }

          throw new Error(`unexpected git invocation: ${JSON.stringify(args)}`);
        });
        const instance = new AutoFixIssueCreateBranch({ repoPath }, { execFileAsync });

        await expectAsync(instance.run(PLAN_DIR, ID)).toBeRejectedWithError('git checkout failed');
      });
    });
  });
});
