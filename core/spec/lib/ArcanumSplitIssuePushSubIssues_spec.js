import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ArcanumSplitIssuePushSubIssues from '../../lib/ArcanumSplitIssuePushSubIssues.js';
import DispatchFailure from '../../lib/DispatchFailure.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

const ISSUE_ID = '999';
const USAGE = 'Usage: push_sub_issues.sh <repo_path> <issue_id>';
const ISSUES_DIR = 'docs/agents/issues';

/**
 * @param {object} [overrides] - collaborator overrides.
 * @returns {object} a set of stub collaborators for
 *   ArcanumSplitIssuePushSubIssues.
 */
function stubDeps(overrides = {}) {
  return {
    repoPath: { validate: jasmine.createSpy('validate').and.resolveTo(undefined) },
    createSubIssue: {
      run: jasmine.createSpy('run').and.resolveTo('STATUS=ok\nID=1\n')
    },
    ...overrides
  };
}

/**
 * @param {string} repoPath - the repo's local checkout path.
 * @param {string} name - the basename to write under docs/agents/issues/.
 * @returns {Promise<void>} resolves once the file is written.
 */
async function writeIssueFile(repoPath, name) {
  const dir = path.join(repoPath, ISSUES_DIR);

  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), '# Draft\n\nBody.\n');
}

describe('ArcanumSplitIssuePushSubIssues', () => {
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
        const instance = new ArcanumSplitIssuePushSubIssues(deps);

        await expectAsync(instance.run('', ISSUE_ID)).toBeRejectedWithError(USAGE);
        expect(deps.repoPath.validate).not.toHaveBeenCalled();
      });

      it('throws the usage message when issueId is missing', async () => {
        const deps = stubDeps();
        const instance = new ArcanumSplitIssuePushSubIssues(deps);

        await expectAsync(instance.run(repoPath, '')).toBeRejectedWithError(USAGE);
        expect(deps.repoPath.validate).not.toHaveBeenCalled();
      });
    });

    describe('when repoPath validation fails', () => {
      it('propagates the rejection uncaught', async () => {
        const deps = stubDeps({
          repoPath: { validate: jasmine.createSpy('validate').and.rejectWith(new Error('Error: not a directory: x')) }
        });
        const instance = new ArcanumSplitIssuePushSubIssues(deps);

        await expectAsync(instance.run(repoPath, ISSUE_ID)).toBeRejectedWithError('Error: not a directory: x');
        expect(deps.createSubIssue.run).not.toHaveBeenCalled();
      });
    });

    describe('zero matching files', () => {
      it('resolves STATUS=ok with an empty CREATED= when the issues directory does not exist', async () => {
        const deps = stubDeps();
        const instance = new ArcanumSplitIssuePushSubIssues(deps);

        const result = await instance.run(repoPath, ISSUE_ID);

        expect(result).toEqual('STATUS=ok\nCREATED=\n');
        expect(deps.createSubIssue.run).not.toHaveBeenCalled();
      });

      it('resolves STATUS=ok with an empty CREATED= when the directory only has unrelated files', async () => {
        await writeIssueFile(repoPath, 'unrelated.md');
        const deps = stubDeps();
        const instance = new ArcanumSplitIssuePushSubIssues(deps);

        const result = await instance.run(repoPath, ISSUE_ID);

        expect(result).toEqual('STATUS=ok\nCREATED=\n');
        expect(deps.createSubIssue.run).not.toHaveBeenCalled();
      });
    });

    describe('multiple matching files, all succeed', () => {
      it('dispatches in ascending sorted order regardless of creation order on disk', async () => {
        // Create the "02" file before the "01" file, to prove sorting
        // (not disk/readdir order) drives dispatch order.
        await writeIssueFile(repoPath, `${ISSUE_ID}_02_second.md`);
        await writeIssueFile(repoPath, `${ISSUE_ID}_01_first.md`);

        const deps = stubDeps({
          createSubIssue: {
            run: jasmine.createSpy('run').and.callFake(async (rp, id, file) => {
              const idBySuffix = file.endsWith('01_first.md') ? '10' : '20';

              return `STATUS=ok\nID=${idBySuffix}\n`;
            })
          }
        });
        const instance = new ArcanumSplitIssuePushSubIssues(deps);

        const result = await instance.run(repoPath, ISSUE_ID);

        expect(deps.createSubIssue.run.calls.count()).toEqual(2);
        expect(deps.createSubIssue.run.calls.argsFor(0)).toEqual([
          repoPath,
          ISSUE_ID,
          `${ISSUES_DIR}/${ISSUE_ID}_01_first.md`
        ]);
        expect(deps.createSubIssue.run.calls.argsFor(1)).toEqual([
          repoPath,
          ISSUE_ID,
          `${ISSUES_DIR}/${ISSUE_ID}_02_second.md`
        ]);
        expect(result).toEqual(
          `STATUS=ok\nCREATED=${ISSUES_DIR}/${ISSUE_ID}_01_first.md:10,${ISSUES_DIR}/${ISSUE_ID}_02_second.md:20\n`
        );
      });
    });

    describe('glob selectivity', () => {
      it('excludes files that do not match <issueId>_[0-9][0-9]*_* from calls and CREATED=', async () => {
        await writeIssueFile(repoPath, `${ISSUE_ID}_01_matches.md`);
        await writeIssueFile(repoPath, '1234_01_wrong_issue_id.md');
        await writeIssueFile(repoPath, `${ISSUE_ID}_1_single_digit_count.md`);
        await writeIssueFile(repoPath, `${ISSUE_ID}_01nounderscore.md`);

        const deps = stubDeps();
        const instance = new ArcanumSplitIssuePushSubIssues(deps);

        const result = await instance.run(repoPath, ISSUE_ID);

        expect(deps.createSubIssue.run.calls.count()).toEqual(1);
        expect(deps.createSubIssue.run).toHaveBeenCalledWith(
          repoPath,
          ISSUE_ID,
          `${ISSUES_DIR}/${ISSUE_ID}_01_matches.md`
        );
        expect(result).toEqual(`STATUS=ok\nCREATED=${ISSUES_DIR}/${ISSUE_ID}_01_matches.md:1\n`);
      });
    });

    describe('mid-batch failure', () => {
      /**
       * @param {Error} error - the error to reject the failing call with.
       * @returns {Promise<{deps: object, instance: ArcanumSplitIssuePushSubIssues, thrown: Error}>}
       *   the deps/instance/thrown-error triple for a 3-file batch whose
       *   2nd file fails.
       */
      async function runThreeFileBatchFailingOnSecond(error) {
        await writeIssueFile(repoPath, `${ISSUE_ID}_01_first.md`);
        await writeIssueFile(repoPath, `${ISSUE_ID}_02_second.md`);
        await writeIssueFile(repoPath, `${ISSUE_ID}_03_third.md`);

        const deps = stubDeps({
          createSubIssue: {
            run: jasmine.createSpy('run').and.callFake(async (rp, id, file) => {
              if (file.endsWith('02_second.md')) {
                throw error;
              }

              return 'STATUS=ok\nID=1\n';
            })
          }
        });
        const instance = new ArcanumSplitIssuePushSubIssues(deps);

        let thrown;

        try {
          await instance.run(repoPath, ISSUE_ID);
        } catch (thrownError) {
          thrown = thrownError;
        }

        return { deps, instance, thrown };
      }

      it('stops the loop and wraps a DispatchFailure without leaking its stdout', async () => {
        const upstreamError = new DispatchFailure('STATUS=failed\nUNIQUE_UPSTREAM_MARKER\n');
        const { deps, thrown } = await runThreeFileBatchFailingOnSecond(upstreamError);

        expect(deps.createSubIssue.run.calls.count()).toEqual(2);
        expect(thrown).toBeInstanceOf(DispatchFailure);
        expect(thrown.stdout).toEqual(
          `STATUS=failed\nCREATED=${ISSUES_DIR}/${ISSUE_ID}_01_first.md:1\nFAILED=${ISSUES_DIR}/${ISSUE_ID}_02_second.md\n`
        );
        expect(thrown.stdout).not.toContain('UNIQUE_UPSTREAM_MARKER');
        expect(thrown.exitCode).toEqual(1);
      });

      it('stops the loop and wraps a plain Error identically to a DispatchFailure', async () => {
        const upstreamError = new Error('boom UNIQUE_UPSTREAM_MARKER');
        const { deps, thrown } = await runThreeFileBatchFailingOnSecond(upstreamError);

        expect(deps.createSubIssue.run.calls.count()).toEqual(2);
        expect(thrown).toBeInstanceOf(DispatchFailure);
        expect(thrown.stdout).toEqual(
          `STATUS=failed\nCREATED=${ISSUES_DIR}/${ISSUE_ID}_01_first.md:1\nFAILED=${ISSUES_DIR}/${ISSUE_ID}_02_second.md\n`
        );
        expect(thrown.stdout).not.toContain('UNIQUE_UPSTREAM_MARKER');
        expect(thrown.exitCode).toEqual(1);
      });
    });

    describe('first file fails immediately', () => {
      it('produces an empty CREATED= and FAILED= set to the first file', async () => {
        await writeIssueFile(repoPath, `${ISSUE_ID}_01_first.md`);
        await writeIssueFile(repoPath, `${ISSUE_ID}_02_second.md`);

        const deps = stubDeps({
          createSubIssue: { run: jasmine.createSpy('run').and.rejectWith(new DispatchFailure('STATUS=failed\n')) }
        });
        const instance = new ArcanumSplitIssuePushSubIssues(deps);

        let thrown;

        try {
          await instance.run(repoPath, ISSUE_ID);
        } catch (error) {
          thrown = error;
        }

        expect(deps.createSubIssue.run.calls.count()).toEqual(1);
        expect(thrown).toBeInstanceOf(DispatchFailure);
        expect(thrown.stdout).toEqual(`STATUS=failed\nCREATED=\nFAILED=${ISSUES_DIR}/${ISSUE_ID}_01_first.md\n`);
        expect(thrown.exitCode).toEqual(1);
      });
    });
  });
});
