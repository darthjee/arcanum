import { access, mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ArcanumSplitIssueFinish from '../../../../lib/commands/arcanum-split-issue/ArcanumSplitIssueFinish.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');

const ISSUE_ID = '999';
const ISSUES_DIR = 'docs/agents/issues';

/**
 * @param {object} [overrides] - collaborator overrides.
 * @returns {object} a set of stub collaborators for ArcanumSplitIssueFinish.
 */
function stubDeps(overrides = {}) {
  return {
    execFileAsync: jasmine.createSpy('execFileAsync').and.resolveTo({ stdout: '', stderr: '' }),
    safeBranch: { checkout: jasmine.createSpy('checkout').and.resolveTo('main') },
    ...overrides
  };
}

describe('ArcanumSplitIssueFinish', () => {
  let repoPath;

  beforeEach(async () => {
    repoPath = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  describe('#run', () => {
    describe('argument validation', () => {
      it('throws the usage message when repoPath is missing', async () => {
        const deps = stubDeps();
        const instance = new ArcanumSplitIssueFinish({ repoPath: '' }, deps);

        await expectAsync(instance.run(ISSUE_ID)).toBeRejectedWithError(
          'Usage: finish.sh <repo_path> <issue_id>'
        );
      });

      it('throws the usage message when issueId is missing', async () => {
        const deps = stubDeps();
        const instance = new ArcanumSplitIssueFinish({ repoPath }, deps);

        await expectAsync(instance.run('')).toBeRejectedWithError(
          'Usage: finish.sh <repo_path> <issue_id>'
        );
      });
    });

    describe('relabeling via github.sh mark-split', () => {
      it('invokes execFileAsync with the script path and array args', async () => {
        const deps = stubDeps();
        const instance = new ArcanumSplitIssueFinish({ repoPath }, deps);

        await instance.run(ISSUE_ID);

        expect(deps.execFileAsync).toHaveBeenCalledWith(
          jasmine.stringMatching(/arcanum-split-issue[/\\]scripts[/\\]github\.sh$/),
          ['mark-split', repoPath, ISSUE_ID]
        );
      });

      it('resolves github.sh from the skill install root, not repoPath, and that path exists on disk', async () => {
        const deps = stubDeps();
        const instance = new ArcanumSplitIssueFinish({ repoPath }, deps);

        await instance.run(ISSUE_ID);

        const [scriptPath] = deps.execFileAsync.calls.mostRecent().args;

        expect(scriptPath).toEqual(path.join(REPO_ROOT, 'arcanum-split-issue', 'scripts', 'github.sh'));
        expect(scriptPath.startsWith(repoPath)).toBeFalse();
        await expectAsync(access(scriptPath)).toBeResolved();
      });

      describe('when it rejects', () => {
        it('propagates the rejection uncaught, without deleting files or checking out the safe branch', async () => {
          const deps = stubDeps({
            execFileAsync: jasmine.createSpy('execFileAsync').and.rejectWith(new Error('gh: boom'))
          });
          const instance = new ArcanumSplitIssueFinish({ repoPath }, deps);

          await expectAsync(instance.run(ISSUE_ID)).toBeRejectedWithError('gh: boom');
          expect(deps.safeBranch.checkout).not.toHaveBeenCalled();
        });
      });
    });

    describe('file cleanup', () => {
      it('deletes only matching <id>-*/<id>_* files, in that order, listing them relative to repoPath', async () => {
        const issuesDir = path.join(repoPath, ISSUES_DIR);

        await mkdir(issuesDir, { recursive: true });
        await writeFile(path.join(issuesDir, `${ISSUE_ID}-first.md`), 'a');
        await writeFile(path.join(issuesDir, `${ISSUE_ID}-second.md`), 'b');
        await writeFile(path.join(issuesDir, `${ISSUE_ID}_third.md`), 'c');
        await writeFile(path.join(issuesDir, 'unrelated.md'), 'd');
        await writeFile(path.join(issuesDir, `1${ISSUE_ID}-not-matching.md`), 'e');

        const deps = stubDeps();
        const instance = new ArcanumSplitIssueFinish({ repoPath }, deps);

        const result = await instance.run(ISSUE_ID);

        expect(result).toEqual(
          'Deleted:\n' +
            `  ${ISSUES_DIR}/${ISSUE_ID}-first.md\n` +
            `  ${ISSUES_DIR}/${ISSUE_ID}-second.md\n` +
            `  ${ISSUES_DIR}/${ISSUE_ID}_third.md\n` +
            'BRANCH=main\n'
        );

        const remaining = await readdir(issuesDir);

        expect(remaining.sort()).toEqual(['1999-not-matching.md', 'unrelated.md'].sort());
      });

      it('returns "Deleted: (nothing to clean up)\\n" when no files match', async () => {
        const issuesDir = path.join(repoPath, ISSUES_DIR);

        await mkdir(issuesDir, { recursive: true });
        await writeFile(path.join(issuesDir, 'unrelated.md'), 'd');

        const deps = stubDeps();
        const instance = new ArcanumSplitIssueFinish({ repoPath }, deps);

        const result = await instance.run(ISSUE_ID);

        expect(result).toEqual('Deleted: (nothing to clean up)\nBRANCH=main\n');
      });

      it('returns "Deleted: (nothing to clean up)\\n" when the issues directory does not exist', async () => {
        const deps = stubDeps();
        const instance = new ArcanumSplitIssueFinish({ repoPath }, deps);

        const result = await instance.run(ISSUE_ID);

        expect(result).toEqual('Deleted: (nothing to clean up)\nBRANCH=main\n');
      });
    });

    describe('safe-branch release', () => {
      it('calls checkout() (context-bound), not run, and formats the resolved branch as BRANCH=<branch>\\n', async () => {
        const deps = stubDeps({ safeBranch: { checkout: jasmine.createSpy('checkout').and.resolveTo('feature-x') } });
        const instance = new ArcanumSplitIssueFinish({ repoPath }, deps);

        const result = await instance.run(ISSUE_ID);

        expect(deps.safeBranch.checkout).toHaveBeenCalledWith();
        expect(deps.safeBranch.checkout).toHaveBeenCalledTimes(1);
        expect(result.endsWith('BRANCH=feature-x\n')).toBeTrue();
      });

      describe('when it rejects', () => {
        it('propagates the rejection uncaught', async () => {
          const deps = stubDeps({
            safeBranch: { checkout: jasmine.createSpy('checkout').and.rejectWith(new Error('dirty tree')) }
          });
          const instance = new ArcanumSplitIssueFinish({ repoPath }, deps);

          await expectAsync(instance.run(ISSUE_ID)).toBeRejectedWithError('dirty tree');
        });
      });
    });

    describe('full success path', () => {
      it('resolves the Deleted: block immediately followed by BRANCH=<branch>\\n', async () => {
        const issuesDir = path.join(repoPath, ISSUES_DIR);

        await mkdir(issuesDir, { recursive: true });
        await writeFile(path.join(issuesDir, `${ISSUE_ID}-split.md`), 'a');

        const deps = stubDeps({ safeBranch: { checkout: jasmine.createSpy('checkout').and.resolveTo('main') } });
        const instance = new ArcanumSplitIssueFinish({ repoPath }, deps);

        const result = await instance.run(ISSUE_ID);

        expect(result).toEqual(`Deleted:\n  ${ISSUES_DIR}/${ISSUE_ID}-split.md\nBRANCH=main\n`);
      });
    });
  });
});
