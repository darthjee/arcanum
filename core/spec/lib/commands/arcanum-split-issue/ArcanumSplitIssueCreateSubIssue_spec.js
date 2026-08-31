import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ArcanumSplitIssueCreateSubIssue from '../../../../lib/commands/arcanum-split-issue/ArcanumSplitIssueCreateSubIssue.js';
import RepoContext from '../../../../lib/context/RepoContext.js';
import DispatchFailure from '../../../../lib/utils/errors/DispatchFailure.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

const ISSUE_ID = '999';
const USAGE = 'Usage: create_sub_issue.sh <repo_path> <issue_id> <sub_issue_file>';

/**
 * @param {object} [overrides] - collaborator overrides.
 * @returns {object} a set of stub collaborators for
 *   ArcanumSplitIssueCreateSubIssue.
 */
function stubDeps(overrides = {}) {
  return {
    spawnIssue: {
      run: jasmine.createSpy('run').and.resolveTo('STATUS=ok\nID=42\nURL=https://github.com/darthjee/arcanum/issues/42\n')
    },
    ...overrides
  };
}

describe('ArcanumSplitIssueCreateSubIssue', () => {
  let repoPath;
  let subIssueFile;

  beforeEach(async () => {
    repoPath = await createTempDir();
    subIssueFile = path.join(repoPath, 'draft.md');
    await writeFile(subIssueFile, '# My Sub Issue\n\nFirst line of body.\n');
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  describe('#run', () => {
    describe('argument validation', () => {
      it('throws the usage message when repoPath is missing', async () => {
        const deps = stubDeps();
        const instance = new ArcanumSplitIssueCreateSubIssue(new RepoContext({ repoPath: '' }), deps);

        await expectAsync(instance.run(ISSUE_ID, subIssueFile)).toBeRejectedWithError(USAGE);
      });

      it('throws the usage message when issueId is missing', async () => {
        const deps = stubDeps();
        const instance = new ArcanumSplitIssueCreateSubIssue(new RepoContext({ repoPath }), deps);

        await expectAsync(instance.run('', subIssueFile)).toBeRejectedWithError(USAGE);
      });

      it('throws the usage message when subIssueFile is missing', async () => {
        const deps = stubDeps();
        const instance = new ArcanumSplitIssueCreateSubIssue(new RepoContext({ repoPath }), deps);

        await expectAsync(instance.run(ISSUE_ID, '')).toBeRejectedWithError(USAGE);
      });
    });

    describe('when subIssueFile does not exist', () => {
      it('throws "Error: file not found: <path>" using the raw argument in the message', async () => {
        const deps = stubDeps();
        const instance = new ArcanumSplitIssueCreateSubIssue(new RepoContext({ repoPath }), deps);
        const missingFile = path.join(repoPath, 'missing.md');

        await expectAsync(instance.run(ISSUE_ID, missingFile)).toBeRejectedWithError(
          `Error: file not found: ${missingFile}`
        );
      });

      it('resolves a relative subIssueFile against repoPath, mirroring the shell cd', async () => {
        const deps = stubDeps();
        const instance = new ArcanumSplitIssueCreateSubIssue(new RepoContext({ repoPath }), deps);

        await expectAsync(instance.run(ISSUE_ID, 'missing.md')).toBeRejectedWithError(
          'Error: file not found: missing.md'
        );
      });
    });

    describe('title/body parsing', () => {
      it('splits the title (leading "# " stripped) from the body, including blank lines inside the body', async () => {
        await writeFile(
          subIssueFile,
          '# My Sub Issue\n\nFirst line of body.\n\nSecond paragraph.\n'
        );
        let capturedBody;
        const deps = stubDeps({
          spawnIssue: {
            run: jasmine.createSpy('run').and.callFake(async (id, title, bodyFile) => {
              capturedBody = await readFile(bodyFile, 'utf8');

              return 'STATUS=ok\nID=42\nURL=https://github.com/darthjee/arcanum/issues/42\n';
            })
          }
        });
        const instance = new ArcanumSplitIssueCreateSubIssue(new RepoContext({ repoPath }), deps);

        await instance.run(ISSUE_ID, subIssueFile);

        expect(deps.spawnIssue.run).toHaveBeenCalledWith(
          ISSUE_ID,
          'My Sub Issue',
          jasmine.any(String),
          '--as-subissue'
        );
        expect(capturedBody).toEqual('First line of body.\n\nSecond paragraph.\n');
      });

      it('keeps a title line without a leading "# " verbatim', async () => {
        await writeFile(subIssueFile, 'Plain Title\n\nBody.\n');
        const deps = stubDeps();
        const instance = new ArcanumSplitIssueCreateSubIssue(new RepoContext({ repoPath }), deps);

        await instance.run(ISSUE_ID, subIssueFile);

        expect(deps.spawnIssue.run).toHaveBeenCalledWith(
          ISSUE_ID,
          'Plain Title',
          jasmine.any(String),
          '--as-subissue'
        );
      });
    });

    describe('count-segment derivation for the progress line', () => {
      it('uses the numeric segment between "<issueId>_" and the next "_"', async () => {
        const filePath = path.join(repoPath, `${ISSUE_ID}_02_my_sub_issue.md`);

        await writeFile(filePath, '# My Sub Issue\n\nBody.\n');
        const deps = stubDeps();
        const instance = new ArcanumSplitIssueCreateSubIssue(new RepoContext({ repoPath }), deps);

        const result = await instance.run(ISSUE_ID, filePath);

        expect(result.startsWith(`Creating sub-issue 02 for issue #${ISSUE_ID}: My Sub Issue\n`)).toBeTrue();
      });

      it('falls back to "?" when the segment is not purely numeric', async () => {
        const filePath = path.join(repoPath, `${ISSUE_ID}_abc_my_sub_issue.md`);

        await writeFile(filePath, '# My Sub Issue\n\nBody.\n');
        const deps = stubDeps();
        const instance = new ArcanumSplitIssueCreateSubIssue(new RepoContext({ repoPath }), deps);

        const result = await instance.run(ISSUE_ID, filePath);

        expect(result.startsWith(`Creating sub-issue ? for issue #${ISSUE_ID}: My Sub Issue\n`)).toBeTrue();
      });
    });

    describe('happy path', () => {
      it('delegates to spawnIssue.run with --as-subissue, tracks the new id in state, and resolves STATUS=ok', async () => {
        const deps = stubDeps();
        const instance = new ArcanumSplitIssueCreateSubIssue(new RepoContext({ repoPath }), deps);

        const result = await instance.run(ISSUE_ID, subIssueFile);

        expect(deps.spawnIssue.run).toHaveBeenCalledWith(
          ISSUE_ID,
          'My Sub Issue',
          jasmine.any(String),
          '--as-subissue'
        );
        const stateFile = path.join(repoPath, '.claude', 'state', `issue-${ISSUE_ID}.json`);
        const written = JSON.parse(await readFile(stateFile, 'utf8'));

        expect(written).toEqual({ 'sub-issues': ['42'] });
        expect(result).toEqual(`Creating sub-issue ? for issue #${ISSUE_ID}: My Sub Issue\nSTATUS=ok\nID=42\n`);
      });

      it('cleans up the temp body file after a successful run', async () => {
        const deps = stubDeps();
        const instance = new ArcanumSplitIssueCreateSubIssue(new RepoContext({ repoPath }), deps);

        await instance.run(ISSUE_ID, subIssueFile);

        const [, , bodyFile] = deps.spawnIssue.run.calls.mostRecent().args;

        await expectAsync(access(bodyFile)).toBeRejected();
      });
    });

    describe('failure path', () => {
      it('re-throws a DispatchFailure prefixed with the progress line, without touching issue state', async () => {
        const deps = stubDeps({
          spawnIssue: { run: jasmine.createSpy('run').and.rejectWith(new DispatchFailure('STATUS=failed\n')) }
        });
        const instance = new ArcanumSplitIssueCreateSubIssue(new RepoContext({ repoPath }), deps);

        let thrown;

        try {
          await instance.run(ISSUE_ID, subIssueFile);
        } catch (error) {
          thrown = error;
        }

        expect(thrown).toBeInstanceOf(DispatchFailure);
        // STATUS=failed legitimately appears twice: SpawnIssue#run's own
        // STATUS=failed\n stdout, followed by this module's own extra
        // STATUS=failed\n — mirroring create_sub_issue.sh's
        // `echo "$SPAWN_OUTPUT"; echo "STATUS=failed"` exactly (verified
        // against the real shell script's output).
        expect(thrown.stdout).toEqual(
          `Creating sub-issue ? for issue #${ISSUE_ID}: My Sub Issue\nSTATUS=failed\nSTATUS=failed\n`
        );
        expect(thrown.exitCode).toEqual(1);

        const stateFile = path.join(repoPath, '.claude', 'state', `issue-${ISSUE_ID}.json`);

        await expectAsync(readFile(stateFile, 'utf8')).toBeRejected();
      });

      it('propagates a non-DispatchFailure rejection uncaught', async () => {
        const deps = stubDeps({
          spawnIssue: { run: jasmine.createSpy('run').and.rejectWith(new Error('boom')) }
        });
        const instance = new ArcanumSplitIssueCreateSubIssue(new RepoContext({ repoPath }), deps);

        await expectAsync(instance.run(ISSUE_ID, subIssueFile)).toBeRejectedWithError('boom');

        const stateFile = path.join(repoPath, '.claude', 'state', `issue-${ISSUE_ID}.json`);

        await expectAsync(readFile(stateFile, 'utf8')).toBeRejected();
      });

      it('still cleans up the temp body file on failure', async () => {
        const deps = stubDeps({
          spawnIssue: { run: jasmine.createSpy('run').and.rejectWith(new DispatchFailure('STATUS=failed\n')) }
        });
        const instance = new ArcanumSplitIssueCreateSubIssue(new RepoContext({ repoPath }), deps);

        let bodyFile;

        try {
          await instance.run(ISSUE_ID, subIssueFile);
        } catch {
          bodyFile = deps.spawnIssue.run.calls.mostRecent().args[2];
        }

        await expectAsync(access(bodyFile)).toBeRejected();
      });
    });
  });
});
