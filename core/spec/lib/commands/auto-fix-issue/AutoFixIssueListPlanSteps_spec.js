import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import AutoFixIssueListPlanSteps from '../../../../lib/commands/auto-fix-issue/AutoFixIssueListPlanSteps.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

const PLAN_DIR_NAME = 'plan-dir';
const AGENT_NAME = 'node';

describe('AutoFixIssueListPlanSteps', () => {
  let baseDir;
  let planDir;
  let stepsDir;
  let instance;

  beforeEach(async () => {
    baseDir = await createTempDir();
    planDir = path.join(baseDir, PLAN_DIR_NAME);
    stepsDir = path.join(planDir, AGENT_NAME);
    instance = new AutoFixIssueListPlanSteps();
  });

  afterEach(async () => {
    await removeTempDir(baseDir);
  });

  /**
   * @param {string} name - the file's basename (e.g. `01-step.md`).
   * @param {string} [content] - the file's contents.
   * @returns {Promise<void>} resolves once `<stepsDir>/<name>` is written
   *   (creating `stepsDir` first, if needed).
   */
  async function writeFileIn(name, content = '') {
    await mkdir(stepsDir, { recursive: true });
    await writeFile(path.join(stepsDir, name), content);
  }

  describe('#run', () => {
    describe('argument validation', () => {
      it('throws the usage message when planDir is missing', async () => {
        await expectAsync(instance.run('', AGENT_NAME)).toBeRejectedWithError(
          'Usage: list_plan_steps.sh <plan_dir> <agent_name>'
        );
      });

      it('throws the usage message when agentName is missing', async () => {
        await expectAsync(instance.run(planDir, '')).toBeRejectedWithError(
          'Usage: list_plan_steps.sh <plan_dir> <agent_name>'
        );
      });

      it('throws the usage message when both planDir and agentName are missing', async () => {
        await expectAsync(instance.run('', '')).toBeRejectedWithError(
          'Usage: list_plan_steps.sh <plan_dir> <agent_name>'
        );
      });
    });

    describe('when <planDir>/<agentName> does not exist', () => {
      it('returns an empty string', async () => {
        const result = await instance.run(planDir, AGENT_NAME);

        expect(result).toBe('');
      });
    });

    describe('when <planDir>/<agentName> exists but is empty', () => {
      it('returns an empty string', async () => {
        await mkdir(stepsDir, { recursive: true });

        const result = await instance.run(planDir, AGENT_NAME);

        expect(result).toBe('');
      });
    });

    describe('when <planDir>/<agentName> has no .md files', () => {
      it('returns an empty string', async () => {
        await mkdir(stepsDir, { recursive: true });
        await writeFile(path.join(stepsDir, 'notes.txt'), 'not a step file\n');

        const result = await instance.run(planDir, AGENT_NAME);

        expect(result).toBe('');
      });
    });

    describe('when <planDir>/<agentName> contains multiple step files', () => {
      it('returns the full paths, alphabetically sorted, one per line, with a trailing newline', async () => {
        await writeFileIn('02-second.md', '# second\n');
        await writeFileIn('01-first.md', '# first\n');
        await writeFileIn('03-third.md', '# third\n');

        const result = await instance.run(planDir, AGENT_NAME);

        expect(result).toBe(
          `${[
            path.join(stepsDir, '01-first.md'),
            path.join(stepsDir, '02-second.md'),
            path.join(stepsDir, '03-third.md')
          ].join('\n')}\n`
        );
      });
    });

    describe('sorting', () => {
      it('sorts by filename, not the shell script\'s full-glob-path key (equivalent since the directory prefix is identical)', async () => {
        await writeFileIn('zeta.md', '# zeta\n');
        await writeFileIn('alpha.md', '# alpha\n');
        await writeFileIn('middle.md', '# middle\n');

        const result = await instance.run(planDir, AGENT_NAME);

        expect(result).toBe(
          `${[
            path.join(stepsDir, 'alpha.md'),
            path.join(stepsDir, 'middle.md'),
            path.join(stepsDir, 'zeta.md')
          ].join('\n')}\n`
        );
      });
    });

    describe('ignored entries', () => {
      it('ignores non-.md files directly inside <planDir>/<agentName>', async () => {
        await writeFileIn('01-first.md', '# first\n');
        await writeFileIn('notes.txt', 'not a step file\n');

        const result = await instance.run(planDir, AGENT_NAME);

        expect(result).toBe(`${path.join(stepsDir, '01-first.md')}\n`);
      });

      it('ignores files outside <planDir>/<agentName>, even ones named *.md', async () => {
        await writeFileIn('01-first.md', '# first\n');
        await writeFile(path.join(planDir, 'sibling.md'), '# sibling\n');

        const result = await instance.run(planDir, AGENT_NAME);

        expect(result).toBe(`${path.join(stepsDir, '01-first.md')}\n`);
      });
    });
  });
});
