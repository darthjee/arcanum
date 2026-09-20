import path from 'node:path';
import AutoFixIssueCommitChange from '../../../../lib/commands/auto-fix-issue/AutoFixIssueCommitChange.js';
import {
  createCommitCommandRepo,
  expectCommitMessage,
  fakeConfigChain,
  fakeGitExecFileAsync
} from '../../../support/factories/commitCommandFixtures.js';
import { removeTempDir } from '../../../support/utils/tempDir.js';

const TYPE = 'fix';
const SCOPE = 'core';
const ID = '999';
const SUBJECT = 'fix the thing';
const AGENT = 'backend';
const MODEL_NAME = 'Node Agent';
const MODEL_EMAIL = 'node@example.com';
const EXEC_FILE_ASYNC_OPTS = { stagesAdd: false };

describe('AutoFixIssueCommitChange', () => {
  let repoPath;

  beforeEach(async () => {
    ({ repoPath } = await createCommitCommandRepo());
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  describe('#run', () => {
    describe('argument validation', () => {
      const args = [TYPE, SCOPE, ID, SUBJECT, AGENT, MODEL_NAME, MODEL_EMAIL];
      const argNames = ['type', 'scope', 'id', 'subject', 'agent', 'modelName', 'modelEmail'];

      argNames.forEach((name, index) => {
        it(`throws the usage message when ${name} is missing`, async () => {
          const execFileAsync = fakeGitExecFileAsync(EXEC_FILE_ASYNC_OPTS);
          const configChain = fakeConfigChain({ omitModelCoauthor: false });
          const instance = new AutoFixIssueCommitChange({ repoPath }, { execFileAsync, configChain });
          const brokenArgs = [...args];

          brokenArgs[index] = '';

          await expectAsync(instance.run(...brokenArgs)).toBeRejectedWithError(
            'Usage: commit_change.sh <repo_path> <type> <scope> <id> <subject> <agent> <model_name> ' +
              '<model_email> [body] [comment_url]'
          );
          expect(execFileAsync).not.toHaveBeenCalled();
        });
      });

      it('throws the usage message when repoPath is missing', async () => {
        const execFileAsync = fakeGitExecFileAsync(EXEC_FILE_ASYNC_OPTS);
        const configChain = fakeConfigChain({ omitModelCoauthor: false });
        const instance = new AutoFixIssueCommitChange({ repoPath: '' }, { execFileAsync, configChain });

        await expectAsync(instance.run(...args)).toBeRejectedWithError(
          'Usage: commit_change.sh <repo_path> <type> <scope> <id> <subject> <agent> <model_name> ' +
            '<model_email> [body] [comment_url]'
        );
        expect(execFileAsync).not.toHaveBeenCalled();
      });
    });

    describe('commit message construction', () => {
      it('builds the subject-only message, with no body/comment trailers, when neither is given', async () => {
        await expectCommitMessage({
          CommandClass: AutoFixIssueCommitChange,
          repoPath,
          runArgs: [TYPE, SCOPE, ID, SUBJECT, AGENT, MODEL_NAME, MODEL_EMAIL],
          execFileAsyncOpts: EXEC_FILE_ASYNC_OPTS,
          configChainOpts: { agentEmail: undefined, omitModelCoauthor: false },
          assertCommitArgs: true,
          expected:
            'fix(core): fix the thing (issue #999)\n\n' +
            'Co-Authored-By: Node Agent <node@example.com>\n' +
            'Co-Authored-By: backend agent <node@example.com>'
        });
      });

      it('includes the body trailer, blank-line separated, when body is given', async () => {
        await expectCommitMessage({
          CommandClass: AutoFixIssueCommitChange,
          repoPath,
          runArgs: [TYPE, SCOPE, ID, SUBJECT, AGENT, MODEL_NAME, MODEL_EMAIL, 'the body text'],
          execFileAsyncOpts: EXEC_FILE_ASYNC_OPTS,
          configChainOpts: { agentEmail: undefined, omitModelCoauthor: false },
          expected:
            'fix(core): fix the thing (issue #999)\n\n' +
            'the body text\n\n' +
            'Co-Authored-By: Node Agent <node@example.com>\n' +
            'Co-Authored-By: backend agent <node@example.com>'
        });
      });

      it('includes the Addresses-Comment trailer, blank-line separated, when comment_url is given', async () => {
        await expectCommitMessage({
          CommandClass: AutoFixIssueCommitChange,
          repoPath,
          runArgs: [
            TYPE, SCOPE, ID, SUBJECT, AGENT, MODEL_NAME, MODEL_EMAIL, undefined, 'https://example.com/pr/1#c1'
          ],
          execFileAsyncOpts: EXEC_FILE_ASYNC_OPTS,
          configChainOpts: { agentEmail: undefined, omitModelCoauthor: false },
          expected:
            'fix(core): fix the thing (issue #999)\n\n' +
            'Addresses-Comment: https://example.com/pr/1#c1\n\n' +
            'Co-Authored-By: Node Agent <node@example.com>\n' +
            'Co-Authored-By: backend agent <node@example.com>'
        });
      });

      it('includes both body and Addresses-Comment trailers when both are given', async () => {
        await expectCommitMessage({
          CommandClass: AutoFixIssueCommitChange,
          repoPath,
          runArgs: [
            TYPE, SCOPE, ID, SUBJECT, AGENT, MODEL_NAME, MODEL_EMAIL, 'the body text',
            'https://example.com/pr/1#c1'
          ],
          execFileAsyncOpts: EXEC_FILE_ASYNC_OPTS,
          configChainOpts: { agentEmail: undefined, omitModelCoauthor: false },
          expected:
            'fix(core): fix the thing (issue #999)\n\n' +
            'the body text\n\n' +
            'Addresses-Comment: https://example.com/pr/1#c1\n\n' +
            'Co-Authored-By: Node Agent <node@example.com>\n' +
            'Co-Authored-By: backend agent <node@example.com>'
        });
      });

      it('omits the model Co-Authored-By trailer when model_coauthor_omitted resolves true', async () => {
        await expectCommitMessage({
          CommandClass: AutoFixIssueCommitChange,
          repoPath,
          runArgs: [TYPE, SCOPE, ID, SUBJECT, AGENT, MODEL_NAME, MODEL_EMAIL],
          execFileAsyncOpts: EXEC_FILE_ASYNC_OPTS,
          configChainOpts: { agentEmail: undefined, omitModelCoauthor: true },
          expected:
            'fix(core): fix the thing (issue #999)\n\n' +
            'Co-Authored-By: backend agent <node@example.com>'
        });
      });

      it('keeps the model Co-Authored-By trailer when model_coauthor_omitted resolves false', async () => {
        await expectCommitMessage({
          CommandClass: AutoFixIssueCommitChange,
          repoPath,
          runArgs: [TYPE, SCOPE, ID, SUBJECT, AGENT, MODEL_NAME, MODEL_EMAIL],
          execFileAsyncOpts: EXEC_FILE_ASYNC_OPTS,
          configChainOpts: { agentEmail: undefined, omitModelCoauthor: false },
          matcher: 'toContain',
          expected: 'Co-Authored-By: Node Agent <node@example.com>'
        });
      });

      describe('commit template engine', () => {
        it(
          'resolves the agent email via config when the "new" template ' +
            '(.github/commit_message_template-2.0.md) is present',
          async () => {
            await expectCommitMessage({
              CommandClass: AutoFixIssueCommitChange,
              repoPath,
              runArgs: [TYPE, SCOPE, ID, SUBJECT, AGENT, MODEL_NAME, MODEL_EMAIL],
              execFileAsyncOpts: EXEC_FILE_ASYNC_OPTS,
              configChainOpts: { agentEmail: 'backend@example.com', omitModelCoauthor: false },
              template: { path: path.join(repoPath, '.github', 'commit_message_template-2.0.md') },
              matcher: 'toContain',
              expected: 'Co-Authored-By: backend agent <backend@example.com>',
              configChainReadArgs: [repoPath, 'git', 'agents.backend', 'email']
            });
          }
        );

        it(
          'falls back to the model email, ignoring any config value, when only the "old" template ' +
            '(.github/commit_message_template.md) is present',
          async () => {
            await expectCommitMessage({
              CommandClass: AutoFixIssueCommitChange,
              repoPath,
              runArgs: [TYPE, SCOPE, ID, SUBJECT, AGENT, MODEL_NAME, MODEL_EMAIL],
              execFileAsyncOpts: EXEC_FILE_ASYNC_OPTS,
              configChainOpts: { agentEmail: 'backend@example.com', omitModelCoauthor: false },
              template: { path: path.join(repoPath, '.github', 'commit_message_template.md') },
              matcher: 'toContain',
              expected: `Co-Authored-By: backend agent <${MODEL_EMAIL}>`
            });
          }
        );

        it('defaults to the "new" template shape when neither template file exists', async () => {
          await expectCommitMessage({
            CommandClass: AutoFixIssueCommitChange,
            repoPath,
            runArgs: [TYPE, SCOPE, ID, SUBJECT, AGENT, MODEL_NAME, MODEL_EMAIL],
            execFileAsyncOpts: EXEC_FILE_ASYNC_OPTS,
            configChainOpts: { agentEmail: 'backend@example.com', omitModelCoauthor: false },
            matcher: 'toContain',
            expected: 'Co-Authored-By: backend agent <backend@example.com>'
          });
        });

        it('substitutes a "{agent}" placeholder in the resolved config email with the agent name', async () => {
          await expectCommitMessage({
            CommandClass: AutoFixIssueCommitChange,
            repoPath,
            runArgs: [TYPE, SCOPE, ID, SUBJECT, AGENT, MODEL_NAME, MODEL_EMAIL],
            execFileAsyncOpts: EXEC_FILE_ASYNC_OPTS,
            configChainOpts: { agentEmail: '{agent}@example.com', omitModelCoauthor: false },
            matcher: 'toContain',
            expected: 'Co-Authored-By: backend agent <backend@example.com>'
          });
        });
      });
    });

    describe('commit + push stdout concatenation', () => {
      it('returns the concatenation of commit stdout and push stdout, and pushes the current branch', async () => {
        const execFileAsync = jasmine.createSpy('execFileAsync').and.callFake(async (cmd, args) => {
          if (args[0] === 'commit') {
            return { stdout: '[my-branch abc1234] fix(core): fix the thing (issue #999)\n' };
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
        const instance = new AutoFixIssueCommitChange({ repoPath }, { execFileAsync, configChain });

        const result = await instance.run(TYPE, SCOPE, ID, SUBJECT, AGENT, MODEL_NAME, MODEL_EMAIL);

        expect(result).toEqual(
          '[my-branch abc1234] fix(core): fix the thing (issue #999)\n' +
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
