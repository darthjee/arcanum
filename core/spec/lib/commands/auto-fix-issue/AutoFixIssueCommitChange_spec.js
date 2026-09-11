import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import AutoFixIssueCommitChange from '../../../../lib/commands/auto-fix-issue/AutoFixIssueCommitChange.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

const TYPE = 'fix';
const SCOPE = 'core';
const ID = '999';
const SUBJECT = 'fix the thing';
const AGENT = 'backend';
const MODEL_NAME = 'Node Agent';
const MODEL_EMAIL = 'node@example.com';

/**
 * Build a fake `execFileAsync` implementation that answers the `git`
 * subcommands `AutoFixIssueCommitChange` issues (`commit -F -`,
 * `branch --show-current`, `push -u`), tracking the piped commit
 * message so tests never shell out to real `git`.
 * @param {object} [opts] - behavior overrides.
 * @param {string} [opts.branch] - the branch `git branch --show-current`
 *   reports.
 * @returns {Function} a jasmine spy usable as `execFileAsync`.
 */
function fakeExecFileAsync({ branch = 'my-branch' } = {}) {
  return jasmine.createSpy('execFileAsync').and.callFake(async (cmd, args, options = {}) => {
    if (cmd !== 'git') {
      throw new Error(`unexpected command: ${cmd}`);
    }

    if (args[0] === 'commit') {
      return { stdout: '', __input: options.input };
    }

    if (args[0] === 'branch') {
      return { stdout: `${branch}\n` };
    }

    if (args[0] === 'push') {
      return { stdout: '' };
    }

    throw new Error(`unexpected git invocation: ${JSON.stringify(args)}`);
  });
}

/**
 * Build a fake `ConfigChain` collaborator answering `git.agents.<agent>.email`
 * / `git.omit_model_coauthor` reads with fixed values, so tests never
 * touch the filesystem-backed config tiers.
 * @param {object} [opts] - the values to answer with.
 * @param {*} [opts.agentEmail] - the value to answer `agents.<agent>`/`email`
 *   reads with.
 * @param {*} [opts.omitModelCoauthor] - the value to answer
 *   `omit_model_coauthor` reads with.
 * @returns {{read: Function}} a fake `ConfigChain`.
 */
function fakeConfigChain({ agentEmail, omitModelCoauthor } = {}) {
  return {
    read: jasmine.createSpy('read').and.callFake(async (repoPath, namespace, ...keys) => {
      if (keys.includes('omit_model_coauthor')) {
        return omitModelCoauthor;
      }

      return agentEmail;
    })
  };
}

describe('AutoFixIssueCommitChange', () => {
  let repoPath;

  beforeEach(async () => {
    repoPath = await createTempDir();
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
          const execFileAsync = fakeExecFileAsync();
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
        const execFileAsync = fakeExecFileAsync();
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
        const execFileAsync = fakeExecFileAsync();
        const configChain = fakeConfigChain({ agentEmail: undefined, omitModelCoauthor: false });
        const instance = new AutoFixIssueCommitChange({ repoPath }, { execFileAsync, configChain });

        await instance.run(TYPE, SCOPE, ID, SUBJECT, AGENT, MODEL_NAME, MODEL_EMAIL);

        const commitCall = execFileAsync.calls.all().find((call) => call.args[1][0] === 'commit');

        expect(commitCall.args[1]).toEqual(['commit', '-F', '-']);
        expect(commitCall.args[2].input).toEqual(
          'fix(core): fix the thing (issue #999)\n\n' +
            'Co-Authored-By: Node Agent <node@example.com>\n' +
            'Co-Authored-By: backend agent <node@example.com>'
        );
      });

      it('includes the body trailer, blank-line separated, when body is given', async () => {
        const execFileAsync = fakeExecFileAsync();
        const configChain = fakeConfigChain({ agentEmail: undefined, omitModelCoauthor: false });
        const instance = new AutoFixIssueCommitChange({ repoPath }, { execFileAsync, configChain });

        await instance.run(TYPE, SCOPE, ID, SUBJECT, AGENT, MODEL_NAME, MODEL_EMAIL, 'the body text');

        const commitCall = execFileAsync.calls.all().find((call) => call.args[1][0] === 'commit');

        expect(commitCall.args[2].input).toEqual(
          'fix(core): fix the thing (issue #999)\n\n' +
            'the body text\n\n' +
            'Co-Authored-By: Node Agent <node@example.com>\n' +
            'Co-Authored-By: backend agent <node@example.com>'
        );
      });

      it('includes the Addresses-Comment trailer, blank-line separated, when comment_url is given', async () => {
        const execFileAsync = fakeExecFileAsync();
        const configChain = fakeConfigChain({ agentEmail: undefined, omitModelCoauthor: false });
        const instance = new AutoFixIssueCommitChange({ repoPath }, { execFileAsync, configChain });

        await instance.run(
          TYPE, SCOPE, ID, SUBJECT, AGENT, MODEL_NAME, MODEL_EMAIL, undefined, 'https://example.com/pr/1#c1'
        );

        const commitCall = execFileAsync.calls.all().find((call) => call.args[1][0] === 'commit');

        expect(commitCall.args[2].input).toEqual(
          'fix(core): fix the thing (issue #999)\n\n' +
            'Addresses-Comment: https://example.com/pr/1#c1\n\n' +
            'Co-Authored-By: Node Agent <node@example.com>\n' +
            'Co-Authored-By: backend agent <node@example.com>'
        );
      });

      it('includes both body and Addresses-Comment trailers when both are given', async () => {
        const execFileAsync = fakeExecFileAsync();
        const configChain = fakeConfigChain({ agentEmail: undefined, omitModelCoauthor: false });
        const instance = new AutoFixIssueCommitChange({ repoPath }, { execFileAsync, configChain });

        await instance.run(
          TYPE, SCOPE, ID, SUBJECT, AGENT, MODEL_NAME, MODEL_EMAIL, 'the body text', 'https://example.com/pr/1#c1'
        );

        const commitCall = execFileAsync.calls.all().find((call) => call.args[1][0] === 'commit');

        expect(commitCall.args[2].input).toEqual(
          'fix(core): fix the thing (issue #999)\n\n' +
            'the body text\n\n' +
            'Addresses-Comment: https://example.com/pr/1#c1\n\n' +
            'Co-Authored-By: Node Agent <node@example.com>\n' +
            'Co-Authored-By: backend agent <node@example.com>'
        );
      });

      it('omits the model Co-Authored-By trailer when model_coauthor_omitted resolves true', async () => {
        const execFileAsync = fakeExecFileAsync();
        const configChain = fakeConfigChain({ agentEmail: undefined, omitModelCoauthor: true });
        const instance = new AutoFixIssueCommitChange({ repoPath }, { execFileAsync, configChain });

        await instance.run(TYPE, SCOPE, ID, SUBJECT, AGENT, MODEL_NAME, MODEL_EMAIL);

        const commitCall = execFileAsync.calls.all().find((call) => call.args[1][0] === 'commit');

        expect(commitCall.args[2].input).toEqual(
          'fix(core): fix the thing (issue #999)\n\n' +
            'Co-Authored-By: backend agent <node@example.com>'
        );
      });

      it('keeps the model Co-Authored-By trailer when model_coauthor_omitted resolves false', async () => {
        const execFileAsync = fakeExecFileAsync();
        const configChain = fakeConfigChain({ agentEmail: undefined, omitModelCoauthor: false });
        const instance = new AutoFixIssueCommitChange({ repoPath }, { execFileAsync, configChain });

        await instance.run(TYPE, SCOPE, ID, SUBJECT, AGENT, MODEL_NAME, MODEL_EMAIL);

        const commitCall = execFileAsync.calls.all().find((call) => call.args[1][0] === 'commit');

        expect(commitCall.args[2].input).toContain('Co-Authored-By: Node Agent <node@example.com>');
      });

      describe('commit template engine', () => {
        it(
          'resolves the agent email via config when the "new" template ' +
            '(.github/commit_message_template-2.0.md) is present',
          async () => {
            await mkdir(path.join(repoPath, '.github'), { recursive: true });
            await writeFile(path.join(repoPath, '.github', 'commit_message_template-2.0.md'), 'template\n');

            const execFileAsync = fakeExecFileAsync();
            const configChain = fakeConfigChain({ agentEmail: 'backend@example.com', omitModelCoauthor: false });
            const instance = new AutoFixIssueCommitChange({ repoPath }, { execFileAsync, configChain });

            await instance.run(TYPE, SCOPE, ID, SUBJECT, AGENT, MODEL_NAME, MODEL_EMAIL);

            const commitCall = execFileAsync.calls.all().find((call) => call.args[1][0] === 'commit');

            expect(commitCall.args[2].input).toContain('Co-Authored-By: backend agent <backend@example.com>');
            expect(configChain.read).toHaveBeenCalledWith(repoPath, 'git', 'agents.backend', 'email');
          }
        );

        it(
          'falls back to the model email, ignoring any config value, when only the "old" template ' +
            '(.github/commit_message_template.md) is present',
          async () => {
            await mkdir(path.join(repoPath, '.github'), { recursive: true });
            await writeFile(path.join(repoPath, '.github', 'commit_message_template.md'), 'template\n');

            const execFileAsync = fakeExecFileAsync();
            const configChain = fakeConfigChain({ agentEmail: 'backend@example.com', omitModelCoauthor: false });
            const instance = new AutoFixIssueCommitChange({ repoPath }, { execFileAsync, configChain });

            await instance.run(TYPE, SCOPE, ID, SUBJECT, AGENT, MODEL_NAME, MODEL_EMAIL);

            const commitCall = execFileAsync.calls.all().find((call) => call.args[1][0] === 'commit');

            expect(commitCall.args[2].input).toContain(`Co-Authored-By: backend agent <${MODEL_EMAIL}>`);
          }
        );

        it('defaults to the "new" template shape when neither template file exists', async () => {
          const execFileAsync = fakeExecFileAsync();
          const configChain = fakeConfigChain({ agentEmail: 'backend@example.com', omitModelCoauthor: false });
          const instance = new AutoFixIssueCommitChange({ repoPath }, { execFileAsync, configChain });

          await instance.run(TYPE, SCOPE, ID, SUBJECT, AGENT, MODEL_NAME, MODEL_EMAIL);

          const commitCall = execFileAsync.calls.all().find((call) => call.args[1][0] === 'commit');

          expect(commitCall.args[2].input).toContain('Co-Authored-By: backend agent <backend@example.com>');
        });

        it('substitutes a "{agent}" placeholder in the resolved config email with the agent name', async () => {
          const execFileAsync = fakeExecFileAsync();
          const configChain = fakeConfigChain({ agentEmail: '{agent}@example.com', omitModelCoauthor: false });
          const instance = new AutoFixIssueCommitChange({ repoPath }, { execFileAsync, configChain });

          await instance.run(TYPE, SCOPE, ID, SUBJECT, AGENT, MODEL_NAME, MODEL_EMAIL);

          const commitCall = execFileAsync.calls.all().find((call) => call.args[1][0] === 'commit');

          expect(commitCall.args[2].input).toContain('Co-Authored-By: backend agent <backend@example.com>');
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
