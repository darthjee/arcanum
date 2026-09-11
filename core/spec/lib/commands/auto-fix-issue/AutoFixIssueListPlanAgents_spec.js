import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import AutoFixIssueListPlanAgents from '../../../../lib/commands/auto-fix-issue/AutoFixIssueListPlanAgents.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

const PLAN_DIR_NAME = 'plan-dir';

describe('AutoFixIssueListPlanAgents', () => {
  let baseDir;
  let planDir;
  let instance;

  beforeEach(async () => {
    baseDir = await createTempDir();
    planDir = path.join(baseDir, PLAN_DIR_NAME);
    instance = new AutoFixIssueListPlanAgents();
  });

  afterEach(async () => {
    await removeTempDir(baseDir);
  });

  /**
   * @param {string} name - the file's basename (e.g. `backend.md`).
   * @param {string} [content] - the file's contents.
   * @returns {Promise<void>} resolves once `<planDir>/<name>` is written
   *   (creating `planDir` first, if needed).
   */
  async function writeFileIn(name, content = '') {
    await mkdir(planDir, { recursive: true });
    await writeFile(path.join(planDir, name), content);
  }

  describe('#run', () => {
    describe('argument validation', () => {
      it('throws the usage message when planDir is missing', async () => {
        await expectAsync(instance.run('')).toBeRejectedWithError(
          'Usage: list_plan_agents.sh <plan_dir>'
        );
      });
    });

    describe('when planDir does not exist', () => {
      it('returns an empty string', async () => {
        const result = await instance.run(planDir);

        expect(result).toBe('');
      });
    });

    describe('when planDir exists but is empty', () => {
      it('returns an empty string', async () => {
        await mkdir(planDir, { recursive: true });

        const result = await instance.run(planDir);

        expect(result).toBe('');
      });
    });

    describe('when planDir contains only plan.md', () => {
      it('returns an empty string', async () => {
        await writeFileIn('plan.md', '# Plan\n');

        const result = await instance.run(planDir);

        expect(result).toBe('');
      });
    });

    describe('when planDir contains plan.md plus agent files', () => {
      it('returns the agent names, alphabetically sorted, one per line, excluding plan.md', async () => {
        await writeFileIn('plan.md', '# Plan\n');
        await writeFileIn('node.md', '# node\n');
        await writeFileIn('backend.md', '# backend\n');

        const result = await instance.run(planDir);

        expect(result).toBe('backend\nnode\n');
      });
    });

    describe('sorting', () => {
      it('sorts by the matched files\' full path (the same key the shell script\'s sort uses)', async () => {
        await writeFileIn('plan.md', '# Plan\n');
        await writeFileIn('zeta.md', '# zeta\n');
        await writeFileIn('alpha.md', '# alpha\n');
        await writeFileIn('middle.md', '# middle\n');

        const expected = [
          path.join(planDir, 'alpha.md'),
          path.join(planDir, 'middle.md'),
          path.join(planDir, 'zeta.md')
        ].sort().map((fullPath) => path.basename(fullPath, '.md'));

        const result = await instance.run(planDir);

        expect(result).toBe(`${expected.join('\n')}\n`);
      });
    });

    describe('ignored entries', () => {
      it('ignores non-.md files directly inside planDir', async () => {
        await writeFileIn('plan.md', '# Plan\n');
        await writeFileIn('backend.md', '# backend\n');
        await writeFileIn('notes.txt', 'not an agent file\n');

        const result = await instance.run(planDir);

        expect(result).toBe('backend\n');
      });

      it('ignores subdirectories inside planDir, even ones named *.md', async () => {
        await writeFileIn('plan.md', '# Plan\n');
        await writeFileIn('backend.md', '# backend\n');
        await mkdir(path.join(planDir, 'nested'), { recursive: true });
        await writeFile(path.join(planDir, 'nested', 'frontend.md'), '# frontend\n');

        const result = await instance.run(planDir);

        expect(result).toBe('backend\n');
      });
    });
  });
});
