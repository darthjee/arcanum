import path from 'node:path';
import AutoPlanIssueCommitPlan from '../../../../lib/commands/auto-plan-issue/AutoPlanIssueCommitPlan.js';
import {
  createCommitCommandRepo,
  expectCommitMessage,
  fakeConfigChain,
  fakeGitExecFileAsync
} from '../../../support/factories/commitCommandFixtures.js';
import { removeTempDir } from '../../../support/utils/tempDir.js';

const ID = '999';
const MODEL_NAME = 'Node Agent';
const MODEL_EMAIL = 'node@example.com';
const RELATIVE_PLAN_DIR = path.join('docs', 'agents', 'plans', '999-some-plan');

describe('AutoPlanIssueCommitPlan', () => {
  let repoPath;
  let planDir;

  beforeEach(async () => {
    ({ repoPath, dirPath: planDir } = await createCommitCommandRepo({ dirPath: RELATIVE_PLAN_DIR }));
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  describe('#run', () => {
    describe('argument validation', () => {
      const args = () => [planDir, ID, MODEL_NAME, MODEL_EMAIL];
      const argNames = ['planDir', 'id', 'modelName', 'modelEmail'];

      argNames.forEach((name, index) => {
        it(`throws the usage message when ${name} is missing`, async () => {
          const execFileAsync = fakeGitExecFileAsync();
          const configChain = fakeConfigChain({ omitModelCoauthor: false });
          const instance = new AutoPlanIssueCommitPlan({ repoPath }, { execFileAsync, configChain });
          const brokenArgs = args();

          brokenArgs[index] = '';

          await expectAsync(instance.run(...brokenArgs)).toBeRejectedWithError(
            'Usage: commit_plan.sh <repo_path> <plan_dir> <id> <model_name> <model_email>'
          );
          expect(execFileAsync).not.toHaveBeenCalled();
        });
      });

      it('throws the usage message when repoPath is missing', async () => {
        const execFileAsync = fakeGitExecFileAsync();
        const configChain = fakeConfigChain({ omitModelCoauthor: false });
        const instance = new AutoPlanIssueCommitPlan({ repoPath: '' }, { execFileAsync, configChain });

        await expectAsync(instance.run(...args())).toBeRejectedWithError(
          'Usage: commit_plan.sh <repo_path> <plan_dir> <id> <model_name> <model_email>'
        );
        expect(execFileAsync).not.toHaveBeenCalled();
      });
    });

    describe('plan_dir validation', () => {
      it('throws when plan_dir does not exist on disk', async () => {
        const execFileAsync = fakeGitExecFileAsync();
        const configChain = fakeConfigChain({ omitModelCoauthor: false });
        const instance = new AutoPlanIssueCommitPlan({ repoPath }, { execFileAsync, configChain });
        const missingPlanDir = path.join(repoPath, 'docs', 'agents', 'plans', 'does-not-exist');

        await expectAsync(instance.run(missingPlanDir, ID, MODEL_NAME, MODEL_EMAIL)).toBeRejectedWithError(
          `Error: directory not found: ${missingPlanDir}`
        );
        expect(execFileAsync).not.toHaveBeenCalled();
      });
    });

    describe('staging', () => {
      it('stages plan_dir itself before building the commit message', async () => {
        const execFileAsync = fakeGitExecFileAsync();
        const configChain = fakeConfigChain({ agentEmail: undefined, omitModelCoauthor: false });
        const instance = new AutoPlanIssueCommitPlan({ repoPath }, { execFileAsync, configChain });

        await instance.run(planDir, ID, MODEL_NAME, MODEL_EMAIL);

        expect(execFileAsync).toHaveBeenCalledWith('git', ['add', planDir], { cwd: repoPath });

        const addIndex = execFileAsync.calls.all().findIndex((call) => call.args[1][0] === 'add');
        const commitIndex = execFileAsync.calls.all().findIndex((call) => call.args[1][0] === 'commit');

        expect(addIndex).toBeLessThan(commitIndex);
      });
    });

    describe('commit message construction', () => {
      it('builds the subject-only message with the fixed architect trailer', async () => {
        await expectCommitMessage({
          CommandClass: AutoPlanIssueCommitPlan,
          repoPath,
          runArgs: [planDir, ID, MODEL_NAME, MODEL_EMAIL],
          configChainOpts: { agentEmail: undefined, omitModelCoauthor: false },
          assertCommitArgs: true,
          expected:
            'docs(plan): add implementation plan (issue #999)\n\n' +
            'Co-Authored-By: Node Agent <node@example.com>\n' +
            'Co-Authored-By: architect agent <node@example.com>'
        });
      });

      it('omits the model Co-Authored-By trailer when model_coauthor_omitted resolves true', async () => {
        await expectCommitMessage({
          CommandClass: AutoPlanIssueCommitPlan,
          repoPath,
          runArgs: [planDir, ID, MODEL_NAME, MODEL_EMAIL],
          configChainOpts: { agentEmail: undefined, omitModelCoauthor: true },
          expected:
            'docs(plan): add implementation plan (issue #999)\n\n' +
            'Co-Authored-By: architect agent <node@example.com>'
        });
      });

      it('keeps the model Co-Authored-By trailer when model_coauthor_omitted resolves false', async () => {
        await expectCommitMessage({
          CommandClass: AutoPlanIssueCommitPlan,
          repoPath,
          runArgs: [planDir, ID, MODEL_NAME, MODEL_EMAIL],
          configChainOpts: { agentEmail: undefined, omitModelCoauthor: false },
          matcher: 'toContain',
          expected: 'Co-Authored-By: Node Agent <node@example.com>'
        });
      });

      describe('commit template engine', () => {
        it(
          'resolves the architect agent email via config when the "new" template ' +
            '(.github/commit_message_template-2.0.md) is present',
          async () => {
            await expectCommitMessage({
              CommandClass: AutoPlanIssueCommitPlan,
              repoPath,
              runArgs: [planDir, ID, MODEL_NAME, MODEL_EMAIL],
              configChainOpts: { agentEmail: 'architect@example.com', omitModelCoauthor: false },
              template: { path: path.join(repoPath, '.github', 'commit_message_template-2.0.md') },
              matcher: 'toContain',
              expected: 'Co-Authored-By: architect agent <architect@example.com>',
              configChainReadArgs: [repoPath, 'git', 'agents.architect', 'email']
            });
          }
        );

        it(
          'falls back to the model email, ignoring any config value, when only the "old" template ' +
            '(.github/commit_message_template.md) is present',
          async () => {
            await expectCommitMessage({
              CommandClass: AutoPlanIssueCommitPlan,
              repoPath,
              runArgs: [planDir, ID, MODEL_NAME, MODEL_EMAIL],
              configChainOpts: { agentEmail: 'architect@example.com', omitModelCoauthor: false },
              template: { path: path.join(repoPath, '.github', 'commit_message_template.md') },
              matcher: 'toContain',
              expected: `Co-Authored-By: architect agent <${MODEL_EMAIL}>`
            });
          }
        );

        it('defaults to the "new" template shape when neither template file exists', async () => {
          await expectCommitMessage({
            CommandClass: AutoPlanIssueCommitPlan,
            repoPath,
            runArgs: [planDir, ID, MODEL_NAME, MODEL_EMAIL],
            configChainOpts: { agentEmail: 'architect@example.com', omitModelCoauthor: false },
            matcher: 'toContain',
            expected: 'Co-Authored-By: architect agent <architect@example.com>'
          });
        });

        it('substitutes a "{agent}" placeholder in the resolved config email with "architect"', async () => {
          await expectCommitMessage({
            CommandClass: AutoPlanIssueCommitPlan,
            repoPath,
            runArgs: [planDir, ID, MODEL_NAME, MODEL_EMAIL],
            configChainOpts: { agentEmail: '{agent}@example.com', omitModelCoauthor: false },
            matcher: 'toContain',
            expected: 'Co-Authored-By: architect agent <architect@example.com>'
          });
        });
      });
    });

    describe('commit + push stdout concatenation', () => {
      it('returns the concatenation of commit stdout and push stdout, and pushes the current branch', async () => {
        const execFileAsync = jasmine.createSpy('execFileAsync').and.callFake(async (cmd, args) => {
          if (args[0] === 'add') {
            return { stdout: '' };
          }

          if (args[0] === 'commit') {
            return { stdout: '[my-branch abc1234] docs(plan): add implementation plan (issue #999)\n' };
          }

          if (args[0] === 'branch') {
            return { stdout: 'my-branch\n' };
          }

          if (args[0] === 'push') {
            return { stdout: 'branch \'my-branch\' set up to track \'origin/my-branch\'.\n' };
          }

          throw new Error(`unexpected git invocation: ${JSON.stringify(args)}`);
        });
        const configChain = fakeConfigChain({ agentEmail: undefined, omitModelCoauthor: false });
        const instance = new AutoPlanIssueCommitPlan({ repoPath }, { execFileAsync, configChain });

        const result = await instance.run(planDir, ID, MODEL_NAME, MODEL_EMAIL);

        expect(result).toEqual(
          '[my-branch abc1234] docs(plan): add implementation plan (issue #999)\n' +
            'branch \'my-branch\' set up to track \'origin/my-branch\'.\n'
        );
        expect(execFileAsync).toHaveBeenCalledWith('git', ['branch', '--show-current'], { cwd: repoPath });
        expect(execFileAsync).toHaveBeenCalledWith(
          'git', ['push', '-u', 'origin', 'my-branch:my-branch'], { cwd: repoPath }
        );
      });
    });
  });
});
