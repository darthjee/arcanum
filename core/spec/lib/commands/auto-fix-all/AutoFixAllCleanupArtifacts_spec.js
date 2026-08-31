import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import AutoFixAllCleanupArtifacts from '../../../../lib/commands/auto-fix-all/AutoFixAllCleanupArtifacts.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

const ISSUE_FILE = 'docs/agents/issues/999-test.md';
const PLAN_DIR = 'docs/agents/plans/999-test';
const ID = '999';
const MODEL_NAME = 'Node Agent';
const MODEL_EMAIL = 'node@example.com';

/**
 * Build a fake `execFileAsync` implementation that answers each `git`
 * subcommand `AutoFixAllCleanupArtifacts` may issue, tracking which
 * targets are "tracked" and whether anything ends up staged, so tests
 * never shell out to real `git`.
 * @param {object} [opts] - behavior overrides.
 * @param {string[]} [opts.tracked] - the paths `git ls-files` reports as
 *   tracked.
 * @returns {Function} a jasmine spy usable as `execFileAsync`.
 */
function fakeExecFileAsync({ tracked = [] } = {}) {
  let staged = false;

  return jasmine.createSpy('execFileAsync').and.callFake(async (cmd, args, options = {}) => {
    if (cmd !== 'git') {
      throw new Error(`unexpected command: ${cmd}`);
    }

    if (args[0] === 'ls-files') {
      const target = args[1];

      return { stdout: tracked.includes(target) ? `${target}\n` : '' };
    }

    if (args[0] === 'rm') {
      staged = true;

      return { stdout: '' };
    }

    if (args[0] === 'diff') {
      if (staged) {
        const error = new Error('diff reported changes');

        error.code = 1;
        throw error;
      }

      return { stdout: '' };
    }

    if (args[0] === 'commit') {
      return { stdout: '', __input: options.input };
    }

    if (args[0] === 'branch') {
      return { stdout: 'my-branch\n' };
    }

    if (args[0] === 'push') {
      return { stdout: '' };
    }

    throw new Error(`unexpected git invocation: ${JSON.stringify(args)}`);
  });
}

describe('AutoFixAllCleanupArtifacts', () => {
  let repoPath;

  beforeEach(async () => {
    repoPath = await createTempDir();
    await mkdir(path.join(repoPath, PLAN_DIR), { recursive: true });
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  describe('#run', () => {
    describe('when neither the issue file nor the plan dir is tracked', () => {
      it('does nothing, resolving with empty stdout and issuing no commit/push', async () => {
        const execFileAsync = fakeExecFileAsync({ tracked: [] });
        const instance = new AutoFixAllCleanupArtifacts({ repoPath }, { execFileAsync });

        const result = await instance.run(ISSUE_FILE, PLAN_DIR, ID, MODEL_NAME, MODEL_EMAIL);

        expect(result).toEqual('');
        expect(execFileAsync).not.toHaveBeenCalledWith('git', ['rm', ISSUE_FILE], jasmine.anything());
        expect(execFileAsync).not.toHaveBeenCalledWith('git', ['rm', '-r', PLAN_DIR], jasmine.anything());
        expect(execFileAsync.calls.all().some((call) => call.args[1][0] === 'commit')).toBeFalse();
        expect(execFileAsync.calls.all().some((call) => call.args[1][0] === 'push')).toBeFalse();
      });
    });

    describe('when only the issue file is tracked', () => {
      it('stages only the issue file removal', async () => {
        const execFileAsync = fakeExecFileAsync({ tracked: [ISSUE_FILE] });
        const instance = new AutoFixAllCleanupArtifacts({ repoPath }, { execFileAsync });

        await instance.run(ISSUE_FILE, PLAN_DIR, ID, MODEL_NAME, MODEL_EMAIL);

        expect(execFileAsync).toHaveBeenCalledWith('git', ['rm', ISSUE_FILE], { cwd: repoPath });
        expect(execFileAsync).not.toHaveBeenCalledWith('git', ['rm', '-r', PLAN_DIR], jasmine.anything());
      });
    });

    describe('when only the plan dir is tracked', () => {
      it('stages only the plan dir removal', async () => {
        const execFileAsync = fakeExecFileAsync({ tracked: [PLAN_DIR] });
        const instance = new AutoFixAllCleanupArtifacts({ repoPath }, { execFileAsync });

        await instance.run(ISSUE_FILE, PLAN_DIR, ID, MODEL_NAME, MODEL_EMAIL);

        expect(execFileAsync).not.toHaveBeenCalledWith('git', ['rm', ISSUE_FILE], jasmine.anything());
        expect(execFileAsync).toHaveBeenCalledWith('git', ['rm', '-r', PLAN_DIR], { cwd: repoPath });
      });
    });

    describe('when both the issue file and the plan dir are tracked', () => {
      it('stages both removals, commits with the hardcoded message, and pushes the current branch', async () => {
        const execFileAsync = fakeExecFileAsync({ tracked: [ISSUE_FILE, PLAN_DIR] });
        const instance = new AutoFixAllCleanupArtifacts({ repoPath }, { execFileAsync });

        const result = await instance.run(ISSUE_FILE, PLAN_DIR, ID, MODEL_NAME, MODEL_EMAIL);

        expect(result).toEqual('');
        expect(execFileAsync).toHaveBeenCalledWith('git', ['rm', ISSUE_FILE], { cwd: repoPath });
        expect(execFileAsync).toHaveBeenCalledWith('git', ['rm', '-r', PLAN_DIR], { cwd: repoPath });

        const commitCall = execFileAsync.calls.all().find((call) => call.args[1][0] === 'commit');

        expect(commitCall.args[1]).toEqual(['commit', '-F', '-']);
        expect(commitCall.args[2].input).toEqual(
          'chore(docs): remove planning artifacts (issue #999)\n\n' +
            'Co-Authored-By: Node Agent <node@example.com>\n' +
            'Co-Authored-By: architect agent <node@example.com>'
        );

        expect(execFileAsync).toHaveBeenCalledWith('git', ['branch', '--show-current'], { cwd: repoPath });
        expect(execFileAsync).toHaveBeenCalledWith(
          'git', ['push', '-u', 'origin', 'my-branch:my-branch'], { cwd: repoPath }
        );
      });
    });

    describe('argument validation', () => {
      it('throws the usage message when a required argument is missing', async () => {
        const execFileAsync = fakeExecFileAsync();
        const instance = new AutoFixAllCleanupArtifacts({ repoPath }, { execFileAsync });

        await expectAsync(
          instance.run(ISSUE_FILE, PLAN_DIR, ID, MODEL_NAME, '')
        ).toBeRejectedWithError(
          'Usage: cleanup_artifacts.sh <repo_path> <issue_file> <plan_dir> <id> <model_name> <model_email>'
        );

        expect(execFileAsync).not.toHaveBeenCalled();
      });
    });
  });
});
