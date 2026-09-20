import path from 'node:path';
import AutoNewIssueCommitIssue from '../../../../lib/commands/auto-new-issue/AutoNewIssueCommitIssue.js';
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
const RELATIVE_FILE_PATH = path.join('docs', 'agents', 'issues', '999-some-issue.md');

describe('AutoNewIssueCommitIssue', () => {
  let repoPath;
  let filePath;

  beforeEach(async () => {
    ({ repoPath, filePath } = await createCommitCommandRepo({ filePath: RELATIVE_FILE_PATH }));
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  describe('#run', () => {
    describe('argument validation', () => {
      const args = () => [filePath, ID, MODEL_NAME, MODEL_EMAIL];
      const argNames = ['filePath', 'id', 'modelName', 'modelEmail'];

      argNames.forEach((name, index) => {
        it(`throws the usage message when ${name} is missing`, async () => {
          const execFileAsync = fakeGitExecFileAsync();
          const configChain = fakeConfigChain({ omitModelCoauthor: false });
          const instance = new AutoNewIssueCommitIssue({ repoPath }, { execFileAsync, configChain });
          const brokenArgs = args();

          brokenArgs[index] = '';

          await expectAsync(instance.run(...brokenArgs)).toBeRejectedWithError(
            'Usage: commit_issue.sh <repo_path> <file_path> <id> <model_name> <model_email>'
          );
          expect(execFileAsync).not.toHaveBeenCalled();
        });
      });

      it('throws the usage message when repoPath is missing', async () => {
        const execFileAsync = fakeGitExecFileAsync();
        const configChain = fakeConfigChain({ omitModelCoauthor: false });
        const instance = new AutoNewIssueCommitIssue({ repoPath: '' }, { execFileAsync, configChain });

        await expectAsync(instance.run(...args())).toBeRejectedWithError(
          'Usage: commit_issue.sh <repo_path> <file_path> <id> <model_name> <model_email>'
        );
        expect(execFileAsync).not.toHaveBeenCalled();
      });
    });

    describe('file_path validation', () => {
      it('throws when file_path does not exist on disk', async () => {
        const execFileAsync = fakeGitExecFileAsync();
        const configChain = fakeConfigChain({ omitModelCoauthor: false });
        const instance = new AutoNewIssueCommitIssue({ repoPath }, { execFileAsync, configChain });
        const missingFilePath = path.join(repoPath, 'docs', 'agents', 'issues', 'does-not-exist.md');

        await expectAsync(instance.run(missingFilePath, ID, MODEL_NAME, MODEL_EMAIL)).toBeRejectedWithError(
          `Error: file not found: ${missingFilePath}`
        );
        expect(execFileAsync).not.toHaveBeenCalled();
      });

      it('throws when file_path points at a directory rather than a file', async () => {
        const execFileAsync = fakeGitExecFileAsync();
        const configChain = fakeConfigChain({ omitModelCoauthor: false });
        const instance = new AutoNewIssueCommitIssue({ repoPath }, { execFileAsync, configChain });
        const dirPath = path.dirname(filePath);

        await expectAsync(instance.run(dirPath, ID, MODEL_NAME, MODEL_EMAIL)).toBeRejectedWithError(
          `Error: file not found: ${dirPath}`
        );
        expect(execFileAsync).not.toHaveBeenCalled();
      });
    });

    describe('staging', () => {
      it('stages file_path itself before building the commit message', async () => {
        const execFileAsync = fakeGitExecFileAsync();
        const configChain = fakeConfigChain({ agentEmail: undefined, omitModelCoauthor: false });
        const instance = new AutoNewIssueCommitIssue({ repoPath }, { execFileAsync, configChain });

        await instance.run(filePath, ID, MODEL_NAME, MODEL_EMAIL);

        expect(execFileAsync).toHaveBeenCalledWith('git', ['add', filePath], { cwd: repoPath });

        const addIndex = execFileAsync.calls.all().findIndex((call) => call.args[1][0] === 'add');
        const commitIndex = execFileAsync.calls.all().findIndex((call) => call.args[1][0] === 'commit');

        expect(addIndex).toBeLessThan(commitIndex);
      });
    });

    describe('commit message construction', () => {
      it('builds the subject-only message with the fixed architect trailer', async () => {
        await expectCommitMessage({
          CommandClass: AutoNewIssueCommitIssue,
          repoPath,
          runArgs: [filePath, ID, MODEL_NAME, MODEL_EMAIL],
          configChainOpts: { agentEmail: undefined, omitModelCoauthor: false },
          assertCommitArgs: true,
          expected:
            'docs(issue): add issue file (issue #999)\n\n' +
            'Co-Authored-By: Node Agent <node@example.com>\n' +
            'Co-Authored-By: architect agent <node@example.com>'
        });
      });

      it('omits the model Co-Authored-By trailer when model_coauthor_omitted resolves true', async () => {
        await expectCommitMessage({
          CommandClass: AutoNewIssueCommitIssue,
          repoPath,
          runArgs: [filePath, ID, MODEL_NAME, MODEL_EMAIL],
          configChainOpts: { agentEmail: undefined, omitModelCoauthor: true },
          expected:
            'docs(issue): add issue file (issue #999)\n\n' +
            'Co-Authored-By: architect agent <node@example.com>'
        });
      });

      it('keeps the model Co-Authored-By trailer when model_coauthor_omitted resolves false', async () => {
        await expectCommitMessage({
          CommandClass: AutoNewIssueCommitIssue,
          repoPath,
          runArgs: [filePath, ID, MODEL_NAME, MODEL_EMAIL],
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
              CommandClass: AutoNewIssueCommitIssue,
              repoPath,
              runArgs: [filePath, ID, MODEL_NAME, MODEL_EMAIL],
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
              CommandClass: AutoNewIssueCommitIssue,
              repoPath,
              runArgs: [filePath, ID, MODEL_NAME, MODEL_EMAIL],
              configChainOpts: { agentEmail: 'architect@example.com', omitModelCoauthor: false },
              template: { path: path.join(repoPath, '.github', 'commit_message_template.md') },
              matcher: 'toContain',
              expected: `Co-Authored-By: architect agent <${MODEL_EMAIL}>`
            });
          }
        );

        it('defaults to the "new" template shape when neither template file exists', async () => {
          await expectCommitMessage({
            CommandClass: AutoNewIssueCommitIssue,
            repoPath,
            runArgs: [filePath, ID, MODEL_NAME, MODEL_EMAIL],
            configChainOpts: { agentEmail: 'architect@example.com', omitModelCoauthor: false },
            matcher: 'toContain',
            expected: 'Co-Authored-By: architect agent <architect@example.com>'
          });
        });

        it('substitutes a "{agent}" placeholder in the resolved config email with "architect"', async () => {
          await expectCommitMessage({
            CommandClass: AutoNewIssueCommitIssue,
            repoPath,
            runArgs: [filePath, ID, MODEL_NAME, MODEL_EMAIL],
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
            return { stdout: '[my-branch abc1234] docs(issue): add issue file (issue #999)\n' };
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
        const instance = new AutoNewIssueCommitIssue({ repoPath }, { execFileAsync, configChain });

        const result = await instance.run(filePath, ID, MODEL_NAME, MODEL_EMAIL);

        expect(result).toEqual(
          '[my-branch abc1234] docs(issue): add issue file (issue #999)\n' +
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
