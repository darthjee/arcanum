import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import RepoContext from '../../../../lib/context/RepoContext.js';
import ResolvePlanPaths from '../../../../lib/commands/shared/ResolvePlanPaths.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

describe('ResolvePlanPaths', () => {
  let repoPath;
  const issuesFolder = 'docs/agents/issues';
  const plansFolder = 'docs/agents/plans';

  beforeEach(async () => {
    repoPath = await createTempDir();
    await mkdir(path.join(repoPath, issuesFolder), { recursive: true });
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  describe('#run', () => {
    it('returns PLAN_EXISTS=false and creates the plan dir when no plan.md exists yet', async () => {
      await writeFile(path.join(repoPath, issuesFolder, '42_my_cool_issue.md'), 'content\n');
      const resolvePlanPaths = new ResolvePlanPaths(new RepoContext({ repoPath }));

      const output = await resolvePlanPaths.run(issuesFolder, plansFolder, '42');

      expect(output).toEqual(
        'ISSUE_FILE=docs/agents/issues/42_my_cool_issue.md\n' +
          'PLAN_DIR=docs/agents/plans/42_my_cool_issue\n' +
          'PLAN_FILE=docs/agents/plans/42_my_cool_issue/plan.md\n' +
          'PLAN_EXISTS=false\n'
      );
      const planDirExists = await access(path.join(repoPath, plansFolder, '42_my_cool_issue'))
        .then(() => true)
        .catch(() => false);

      expect(planDirExists).toBeTrue();
    });

    it('returns PLAN_EXISTS=true when plan.md already exists', async () => {
      await writeFile(path.join(repoPath, issuesFolder, '42_my_cool_issue.md'), 'content\n');
      await mkdir(path.join(repoPath, plansFolder, '42_my_cool_issue'), { recursive: true });
      await writeFile(path.join(repoPath, plansFolder, '42_my_cool_issue', 'plan.md'), 'plan\n');
      const resolvePlanPaths = new ResolvePlanPaths(new RepoContext({ repoPath }));

      const output = await resolvePlanPaths.run(issuesFolder, plansFolder, '42');

      expect(output).toEqual(
        'ISSUE_FILE=docs/agents/issues/42_my_cool_issue.md\n' +
          'PLAN_DIR=docs/agents/plans/42_my_cool_issue\n' +
          'PLAN_FILE=docs/agents/plans/42_my_cool_issue/plan.md\n' +
          'PLAN_EXISTS=true\n'
      );
    });

    it('supports dash-separated issue filenames', async () => {
      await writeFile(path.join(repoPath, issuesFolder, '7-some-title-here.md'), 'content\n');
      const resolvePlanPaths = new ResolvePlanPaths(new RepoContext({ repoPath }));

      const output = await resolvePlanPaths.run(issuesFolder, plansFolder, '7');

      expect(output).toEqual(
        'ISSUE_FILE=docs/agents/issues/7-some-title-here.md\n' +
          'PLAN_DIR=docs/agents/plans/7-some-title-here\n' +
          'PLAN_FILE=docs/agents/plans/7-some-title-here/plan.md\n' +
          'PLAN_EXISTS=false\n'
      );
    });

    describe('a non-numeric id (hard failure)', () => {
      it('throws with no ISSUE_FILE= line', async () => {
        const resolvePlanPaths = new ResolvePlanPaths(new RepoContext({ repoPath }));

        await expectAsync(resolvePlanPaths.run(issuesFolder, plansFolder, 'abc')).toBeRejectedWithError(
          'Error: issue id must be numeric and linked to a GitHub issue (got \'abc\'). Local-only ids are no longer supported.'
        );
      });
    });

    describe('no matching issue file', () => {
      it('throws with the missing-file error message', async () => {
        const resolvePlanPaths = new ResolvePlanPaths(new RepoContext({ repoPath }));

        await expectAsync(resolvePlanPaths.run(issuesFolder, plansFolder, '999')).toBeRejectedWithError(
          'Error: no issue file found for id 999'
        );
      });
    });
  });
});
