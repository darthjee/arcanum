import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ArcanumSplitIssueCreateSubIssueFile from '../../../lib/commands/ArcanumSplitIssueCreateSubIssueFile.js';
import { createTempDir, removeTempDir } from '../../support/utils/tempDir.js';

const ISSUE_ID = '999';
const ISSUES_DIR = 'docs/agents/issues';

/**
 * @param {object} [overrides] - collaborator overrides.
 * @returns {object} a set of stub collaborators for
 *   ArcanumSplitIssueCreateSubIssueFile.
 */
function stubDeps(overrides = {}) {
  return {
    ...overrides
  };
}

describe('ArcanumSplitIssueCreateSubIssueFile', () => {
  let repoPath;
  let bodyFile;

  beforeEach(async () => {
    repoPath = await createTempDir();
    bodyFile = path.join(repoPath, 'body.md');
    await writeFile(bodyFile, '');
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  describe('#run', () => {
    describe('argument validation', () => {
      const USAGE = 'Usage: create_sub_issue_file.sh <repo_path> <issue_id> <title> <body_file>';

      it('throws the usage message when repoPath is missing', async () => {
        const deps = stubDeps();
        const instance = new ArcanumSplitIssueCreateSubIssueFile({ repoPath: '' }, deps);

        await expectAsync(instance.run(ISSUE_ID, 'Title', bodyFile)).toBeRejectedWithError(USAGE);
      });

      it('throws the usage message when issueId is missing', async () => {
        const deps = stubDeps();
        const instance = new ArcanumSplitIssueCreateSubIssueFile({ repoPath }, deps);

        await expectAsync(instance.run('', 'Title', bodyFile)).toBeRejectedWithError(USAGE);
      });

      it('throws the usage message when title is missing', async () => {
        const deps = stubDeps();
        const instance = new ArcanumSplitIssueCreateSubIssueFile({ repoPath }, deps);

        await expectAsync(instance.run(ISSUE_ID, '', bodyFile)).toBeRejectedWithError(USAGE);
      });

      it('throws the usage message when bodyFile is missing', async () => {
        const deps = stubDeps();
        const instance = new ArcanumSplitIssueCreateSubIssueFile({ repoPath }, deps);

        await expectAsync(instance.run(ISSUE_ID, 'Title', '')).toBeRejectedWithError(USAGE);
      });
    });

    describe('when bodyFile does not exist', () => {
      it('throws "Error: file not found: <bodyFile>" using the raw argument in the message', async () => {
        const deps = stubDeps();
        const instance = new ArcanumSplitIssueCreateSubIssueFile({ repoPath }, deps);
        const missingBodyFile = path.join(repoPath, 'missing.md');

        await expectAsync(instance.run(ISSUE_ID, 'Title', missingBodyFile)).toBeRejectedWithError(
          `Error: file not found: ${missingBodyFile}`
        );
      });

      it('resolves a relative bodyFile against repoPath, mirroring the shell cd', async () => {
        const deps = stubDeps();
        const instance = new ArcanumSplitIssueCreateSubIssueFile({ repoPath }, deps);

        await expectAsync(instance.run(ISSUE_ID, 'Title', 'missing.md')).toBeRejectedWithError(
          'Error: file not found: missing.md'
        );
      });
    });

    describe('sub-issue counting', () => {
      it('starts a fresh id at count 01', async () => {
        const deps = stubDeps();
        const instance = new ArcanumSplitIssueCreateSubIssueFile({ repoPath }, deps);

        const result = await instance.run(ISSUE_ID, 'First Sub Issue', bodyFile);

        expect(result).toEqual(`FILE=${ISSUES_DIR}/${ISSUE_ID}_01_first_sub_issue.md\n`);
        const written = await readFile(path.join(repoPath, ISSUES_DIR, `${ISSUE_ID}_01_first_sub_issue.md`), 'utf8');

        expect(written).toEqual('# First Sub Issue\n\n');
      });

      it('increments the count on a second call', async () => {
        const deps = stubDeps();
        const instance = new ArcanumSplitIssueCreateSubIssueFile({ repoPath }, deps);

        await instance.run(ISSUE_ID, 'First Sub Issue', bodyFile);
        const result = await instance.run(ISSUE_ID, 'Second Sub Issue', bodyFile);

        expect(result).toEqual(`FILE=${ISSUES_DIR}/${ISSUE_ID}_02_second_sub_issue.md\n`);
      });

      it('picks up an out-of-band file created outside the tool', async () => {
        const deps = stubDeps();
        const instance = new ArcanumSplitIssueCreateSubIssueFile({ repoPath }, deps);
        const issuesDir = path.join(repoPath, ISSUES_DIR);

        await mkdir(issuesDir, { recursive: true });
        await writeFile(path.join(issuesDir, `${ISSUE_ID}_03_manual.md`), '');

        const result = await instance.run(ISSUE_ID, 'Fourth Sub Issue', bodyFile);

        expect(result).toEqual(`FILE=${ISSUES_DIR}/${ISSUE_ID}_04_fourth_sub_issue.md\n`);
      });

      it('never reuses a count freed by a deleted file (gap-tolerant)', async () => {
        const deps = stubDeps();
        const instance = new ArcanumSplitIssueCreateSubIssueFile({ repoPath }, deps);
        const issuesDir = path.join(repoPath, ISSUES_DIR);

        await mkdir(issuesDir, { recursive: true });
        await writeFile(path.join(issuesDir, `${ISSUE_ID}_01_first.md`), '');
        // Simulate a deleted 999_02_... file: only 999_04_... remains, so
        // the next count must be 05, never reusing 02 or 03.
        await writeFile(path.join(issuesDir, `${ISSUE_ID}_04_fourth.md`), '');

        const result = await instance.run(ISSUE_ID, 'Fifth Sub Issue', bodyFile);

        expect(result).toEqual(`FILE=${ISSUES_DIR}/${ISSUE_ID}_05_fifth_sub_issue.md\n`);
      });

      it('skips filenames whose count segment is not numeric', async () => {
        const deps = stubDeps();
        const instance = new ArcanumSplitIssueCreateSubIssueFile({ repoPath }, deps);
        const issuesDir = path.join(repoPath, ISSUES_DIR);

        await mkdir(issuesDir, { recursive: true });
        // Matches the <id>_[0-9][0-9]*_* glob (2 digits, then "abc", then
        // "_", then anything) but its count segment ("12abc") is not
        // purely numeric, so it must be skipped rather than counted.
        await writeFile(path.join(issuesDir, `${ISSUE_ID}_12abc_weird.md`), '');

        const result = await instance.run(ISSUE_ID, 'Next Sub Issue', bodyFile);

        expect(result).toEqual(`FILE=${ISSUES_DIR}/${ISSUE_ID}_01_next_sub_issue.md\n`);
      });

      it('ignores filenames with fewer than 2 leading digits', async () => {
        const deps = stubDeps();
        const instance = new ArcanumSplitIssueCreateSubIssueFile({ repoPath }, deps);
        const issuesDir = path.join(repoPath, ISSUES_DIR);

        await mkdir(issuesDir, { recursive: true });
        // Only a single digit after "<id>_", so this never matches the
        // shell's [0-9][0-9]* glob and must not be counted.
        await writeFile(path.join(issuesDir, `${ISSUE_ID}_5_solo.md`), '');

        const result = await instance.run(ISSUE_ID, 'Next Sub Issue', bodyFile);

        expect(result).toEqual(`FILE=${ISSUES_DIR}/${ISSUE_ID}_01_next_sub_issue.md\n`);
      });

      it('creates docs/agents/issues/ when missing', async () => {
        const deps = stubDeps();
        const instance = new ArcanumSplitIssueCreateSubIssueFile({ repoPath }, deps);

        const result = await instance.run(ISSUE_ID, 'First Sub Issue', bodyFile);

        expect(result).toEqual(`FILE=${ISSUES_DIR}/${ISSUE_ID}_01_first_sub_issue.md\n`);
      });
    });

    describe('title-to-snake_case transform', () => {
      it('lowercases, replaces punctuation, collapses repeated separators, and trims ends', async () => {
        const deps = stubDeps();
        const instance = new ArcanumSplitIssueCreateSubIssueFile({ repoPath }, deps);

        const result = await instance.run(ISSUE_ID, 'Hello, World! Foo-Bar', bodyFile);

        expect(result).toEqual(`FILE=${ISSUES_DIR}/${ISSUE_ID}_01_hello_world_foo_bar.md\n`);
      });

      it('strips leading/trailing separators produced by leading/trailing punctuation', async () => {
        const deps = stubDeps();
        const instance = new ArcanumSplitIssueCreateSubIssueFile({ repoPath }, deps);

        const result = await instance.run(ISSUE_ID, '__Weird__  Title__', bodyFile);

        expect(result).toEqual(`FILE=${ISSUES_DIR}/${ISSUE_ID}_01_weird_title.md\n`);
      });
    });

    describe('success output contract', () => {
      it('writes "# <title>\\n\\n<body>" and returns FILE=<path>\\n', async () => {
        await writeFile(bodyFile, 'body content here\nsecond line\n');
        const deps = stubDeps();
        const instance = new ArcanumSplitIssueCreateSubIssueFile({ repoPath }, deps);

        const result = await instance.run(ISSUE_ID, 'My Title', bodyFile);
        const expectedFile = `${ISSUES_DIR}/${ISSUE_ID}_01_my_title.md`;

        expect(result).toEqual(`FILE=${expectedFile}\n`);

        const written = await readFile(path.join(repoPath, expectedFile), 'utf8');

        expect(written).toEqual('# My Title\n\nbody content here\nsecond line\n');
      });

      it('copies the body file bytes verbatim, without trailing-newline normalization', async () => {
        await writeFile(bodyFile, 'no trailing newline');
        const deps = stubDeps();
        const instance = new ArcanumSplitIssueCreateSubIssueFile({ repoPath }, deps);

        await instance.run(ISSUE_ID, 'My Title', bodyFile);

        const written = await readFile(path.join(repoPath, ISSUES_DIR, `${ISSUE_ID}_01_my_title.md`), 'utf8');

        expect(written).toEqual('# My Title\n\nno trailing newline');
      });
    });
  });
});
