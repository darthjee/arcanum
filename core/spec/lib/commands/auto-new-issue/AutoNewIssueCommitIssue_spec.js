import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import AutoNewIssueCommitIssue from '../../../../lib/commands/auto-new-issue/AutoNewIssueCommitIssue.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

const ID = '999';
const MODEL_NAME = 'Node Agent';
const MODEL_EMAIL = 'node@example.com';

/**
 * Build a fake `execFileAsync` implementation that answers the `git`
 * subcommands `AutoNewIssueCommitIssue` issues (`add`, `commit -F -`,
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

    if (args[0] === 'add') {
      return { stdout: '' };
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
 * Build a fake `ConfigChain` collaborator answering
 * `git.agents.architect.email` / `git.omit_model_coauthor` reads with
 * fixed values, so tests never touch the filesystem-backed config
 * tiers.
 * @param {object} [opts] - the values to answer with.
 * @param {*} [opts.agentEmail] - the value to answer
 *   `agents.architect`/`email` reads with.
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

describe('AutoNewIssueCommitIssue', () => {
  let repoPath;
  let filePath;

  beforeEach(async () => {
    repoPath = await createTempDir();
    filePath = path.join(repoPath, 'docs', 'agents', 'issues', '999-some-issue.md');
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, '# Issue\n');
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
          const execFileAsync = fakeExecFileAsync();
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
        const execFileAsync = fakeExecFileAsync();
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
        const execFileAsync = fakeExecFileAsync();
        const configChain = fakeConfigChain({ omitModelCoauthor: false });
        const instance = new AutoNewIssueCommitIssue({ repoPath }, { execFileAsync, configChain });
        const missingFilePath = path.join(repoPath, 'docs', 'agents', 'issues', 'does-not-exist.md');

        await expectAsync(instance.run(missingFilePath, ID, MODEL_NAME, MODEL_EMAIL)).toBeRejectedWithError(
          `Error: file not found: ${missingFilePath}`
        );
        expect(execFileAsync).not.toHaveBeenCalled();
      });

      it('throws when file_path points at a directory rather than a file', async () => {
        const execFileAsync = fakeExecFileAsync();
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
        const execFileAsync = fakeExecFileAsync();
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
        const execFileAsync = fakeExecFileAsync();
        const configChain = fakeConfigChain({ agentEmail: undefined, omitModelCoauthor: false });
        const instance = new AutoNewIssueCommitIssue({ repoPath }, { execFileAsync, configChain });

        await instance.run(filePath, ID, MODEL_NAME, MODEL_EMAIL);

        const commitCall = execFileAsync.calls.all().find((call) => call.args[1][0] === 'commit');

        expect(commitCall.args[1]).toEqual(['commit', '-F', '-']);
        expect(commitCall.args[2].input).toEqual(
          'docs(issue): add issue file (issue #999)\n\n' +
            'Co-Authored-By: Node Agent <node@example.com>\n' +
            'Co-Authored-By: architect agent <node@example.com>'
        );
      });

      it('omits the model Co-Authored-By trailer when model_coauthor_omitted resolves true', async () => {
        const execFileAsync = fakeExecFileAsync();
        const configChain = fakeConfigChain({ agentEmail: undefined, omitModelCoauthor: true });
        const instance = new AutoNewIssueCommitIssue({ repoPath }, { execFileAsync, configChain });

        await instance.run(filePath, ID, MODEL_NAME, MODEL_EMAIL);

        const commitCall = execFileAsync.calls.all().find((call) => call.args[1][0] === 'commit');

        expect(commitCall.args[2].input).toEqual(
          'docs(issue): add issue file (issue #999)\n\n' +
            'Co-Authored-By: architect agent <node@example.com>'
        );
      });

      it('keeps the model Co-Authored-By trailer when model_coauthor_omitted resolves false', async () => {
        const execFileAsync = fakeExecFileAsync();
        const configChain = fakeConfigChain({ agentEmail: undefined, omitModelCoauthor: false });
        const instance = new AutoNewIssueCommitIssue({ repoPath }, { execFileAsync, configChain });

        await instance.run(filePath, ID, MODEL_NAME, MODEL_EMAIL);

        const commitCall = execFileAsync.calls.all().find((call) => call.args[1][0] === 'commit');

        expect(commitCall.args[2].input).toContain('Co-Authored-By: Node Agent <node@example.com>');
      });

      describe('commit template engine', () => {
        it(
          'resolves the architect agent email via config when the "new" template ' +
            '(.github/commit_message_template-2.0.md) is present',
          async () => {
            await mkdir(path.join(repoPath, '.github'), { recursive: true });
            await writeFile(path.join(repoPath, '.github', 'commit_message_template-2.0.md'), 'template\n');

            const execFileAsync = fakeExecFileAsync();
            const configChain = fakeConfigChain({ agentEmail: 'architect@example.com', omitModelCoauthor: false });
            const instance = new AutoNewIssueCommitIssue({ repoPath }, { execFileAsync, configChain });

            await instance.run(filePath, ID, MODEL_NAME, MODEL_EMAIL);

            const commitCall = execFileAsync.calls.all().find((call) => call.args[1][0] === 'commit');

            expect(commitCall.args[2].input).toContain('Co-Authored-By: architect agent <architect@example.com>');
            expect(configChain.read).toHaveBeenCalledWith(repoPath, 'git', 'agents.architect', 'email');
          }
        );

        it(
          'falls back to the model email, ignoring any config value, when only the "old" template ' +
            '(.github/commit_message_template.md) is present',
          async () => {
            await mkdir(path.join(repoPath, '.github'), { recursive: true });
            await writeFile(path.join(repoPath, '.github', 'commit_message_template.md'), 'template\n');

            const execFileAsync = fakeExecFileAsync();
            const configChain = fakeConfigChain({ agentEmail: 'architect@example.com', omitModelCoauthor: false });
            const instance = new AutoNewIssueCommitIssue({ repoPath }, { execFileAsync, configChain });

            await instance.run(filePath, ID, MODEL_NAME, MODEL_EMAIL);

            const commitCall = execFileAsync.calls.all().find((call) => call.args[1][0] === 'commit');

            expect(commitCall.args[2].input).toContain(`Co-Authored-By: architect agent <${MODEL_EMAIL}>`);
          }
        );

        it('defaults to the "new" template shape when neither template file exists', async () => {
          const execFileAsync = fakeExecFileAsync();
          const configChain = fakeConfigChain({ agentEmail: 'architect@example.com', omitModelCoauthor: false });
          const instance = new AutoNewIssueCommitIssue({ repoPath }, { execFileAsync, configChain });

          await instance.run(filePath, ID, MODEL_NAME, MODEL_EMAIL);

          const commitCall = execFileAsync.calls.all().find((call) => call.args[1][0] === 'commit');

          expect(commitCall.args[2].input).toContain('Co-Authored-By: architect agent <architect@example.com>');
        });

        it('substitutes a "{agent}" placeholder in the resolved config email with "architect"', async () => {
          const execFileAsync = fakeExecFileAsync();
          const configChain = fakeConfigChain({ agentEmail: '{agent}@example.com', omitModelCoauthor: false });
          const instance = new AutoNewIssueCommitIssue({ repoPath }, { execFileAsync, configChain });

          await instance.run(filePath, ID, MODEL_NAME, MODEL_EMAIL);

          const commitCall = execFileAsync.calls.all().find((call) => call.args[1][0] === 'commit');

          expect(commitCall.args[2].input).toContain('Co-Authored-By: architect agent <architect@example.com>');
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
