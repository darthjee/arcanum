import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import AutoFixAllReplyComment from '../../../lib/commands/AutoFixAllReplyComment.js';
import { createTempDir, removeTempDir } from '../../support/utils/tempDir.js';

const USAGE = 'Usage: reply_comment.sh <repo_path> <id> <agent> <model_name> <model_email> <reply_body>';
const ID = '999';
const AGENT = 'node';
const MODEL_NAME = 'Node Agent';
const MODEL_EMAIL = 'node@example.com';
const REPLY_BODY = 'Fixed in the latest commit.';
const DEFAULT_TEMPLATE = '%%BODY%%\n\n_Replied by: %%AGENT%% agent (%%MODEL_NAME%% %%MODEL_EMAIL%%)_\n';

/**
 * Writes `auto-fix-all/templates/reply.tmpl.md` under `repoPath`, the
 * exact location `AutoFixAllReplyComment` reads it from.
 * @param {string} repoPath - the fixture repo path.
 * @param {string} [content] - the template's raw content.
 * @returns {Promise<void>} resolves once written.
 */
async function writeTemplate(repoPath, content = DEFAULT_TEMPLATE) {
  const templateDir = path.join(repoPath, 'auto-fix-all', 'templates');

  await mkdir(templateDir, { recursive: true });
  await writeFile(path.join(templateDir, 'reply.tmpl.md'), content);
}

/**
 * Build a fake `execFileAsync` implementation answering both the
 * `resolve_pr_number.sh` shell-out and the `git branch`/`git push`
 * calls, so tests never shell out for real.
 * @param {object} [opts] - behavior overrides.
 * @param {string} [opts.prNumber] - the PR number `resolve_pr_number.sh`
 *   reports.
 * @param {boolean} [opts.resolveFails] - whether the
 *   `resolve_pr_number.sh` call should reject.
 * @param {boolean} [opts.pushFails] - whether the `git push` call
 *   should reject.
 * @param {string} [opts.branch] - the branch `git branch --show-current`
 *   reports.
 * @returns {Function} a jasmine spy usable as `execFileAsync`.
 */
function fakeExecFileAsync({ prNumber = '42', resolveFails = false, pushFails = false, branch = 'my-branch' } = {}) {
  return jasmine.createSpy('execFileAsync').and.callFake(async (file, args = []) => {
    if (typeof file === 'string' && file.endsWith('resolve_pr_number.sh')) {
      if (resolveFails) {
        const error = new Error('Error: no pull request found for the current branch on darthjee/arcanum');

        error.code = 1;
        throw error;
      }

      return { stdout: `${prNumber}\n` };
    }

    if (file === 'git' && args[2] === 'branch') {
      return { stdout: `${branch}\n` };
    }

    if (file === 'git' && args[2] === 'push') {
      if (pushFails) {
        const error = new Error('push failed');

        error.code = 1;
        throw error;
      }

      return { stdout: `branch '${branch}' set up to track 'origin/${branch}'.\n` };
    }

    throw new Error(`unexpected execFileAsync call: ${file} ${JSON.stringify(args)}`);
  });
}

/**
 * @param {object} [overrides] - collaborator overrides.
 * @returns {object} a set of stub collaborators for AutoFixAllReplyComment.
 */
function stubDeps(overrides = {}) {
  return {
    origin: { resolve: async () => ({ domain: 'github.com', repo: 'darthjee/arcanum' }) },
    githubToken: { get: async () => 'fake-token' },
    execFileAsync: fakeExecFileAsync(),
    fetchFn: jasmine.createSpy('fetch').and.resolveTo({ ok: true, json: async () => ({}) }),
    ...overrides
  };
}

describe('AutoFixAllReplyComment', () => {
  let repoPath;

  beforeEach(async () => {
    repoPath = await createTempDir();
    await writeTemplate(repoPath);
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  describe('#run', () => {
    describe('argument validation', () => {
      it('throws the usage message when repo_path is missing', async () => {
        const deps = stubDeps();
        const instance = new AutoFixAllReplyComment(deps);

        await expectAsync(
          instance.run('', ID, AGENT, MODEL_NAME, MODEL_EMAIL, REPLY_BODY)
        ).toBeRejectedWithError(USAGE);
        expect(deps.execFileAsync).not.toHaveBeenCalled();
      });

      it('throws the usage message when id is missing', async () => {
        const deps = stubDeps();
        const instance = new AutoFixAllReplyComment(deps);

        await expectAsync(
          instance.run(repoPath, '', AGENT, MODEL_NAME, MODEL_EMAIL, REPLY_BODY)
        ).toBeRejectedWithError(USAGE);
        expect(deps.execFileAsync).not.toHaveBeenCalled();
      });

      it('throws the usage message when id is non-numeric', async () => {
        const deps = stubDeps();
        const instance = new AutoFixAllReplyComment(deps);

        await expectAsync(
          instance.run(repoPath, 'abc', AGENT, MODEL_NAME, MODEL_EMAIL, REPLY_BODY)
        ).toBeRejectedWithError(USAGE);
        expect(deps.execFileAsync).not.toHaveBeenCalled();
      });

      it('throws the usage message when id is non-numeric even with a leading #', async () => {
        const deps = stubDeps();
        const instance = new AutoFixAllReplyComment(deps);

        await expectAsync(
          instance.run(repoPath, '#abc', AGENT, MODEL_NAME, MODEL_EMAIL, REPLY_BODY)
        ).toBeRejectedWithError(USAGE);
        expect(deps.execFileAsync).not.toHaveBeenCalled();
      });

      it('throws the usage message when agent is missing', async () => {
        const deps = stubDeps();
        const instance = new AutoFixAllReplyComment(deps);

        await expectAsync(
          instance.run(repoPath, ID, '', MODEL_NAME, MODEL_EMAIL, REPLY_BODY)
        ).toBeRejectedWithError(USAGE);
        expect(deps.execFileAsync).not.toHaveBeenCalled();
      });

      it('throws the usage message when model_name is missing', async () => {
        const deps = stubDeps();
        const instance = new AutoFixAllReplyComment(deps);

        await expectAsync(
          instance.run(repoPath, ID, AGENT, '', MODEL_EMAIL, REPLY_BODY)
        ).toBeRejectedWithError(USAGE);
        expect(deps.execFileAsync).not.toHaveBeenCalled();
      });

      it('throws the usage message when model_email is missing', async () => {
        const deps = stubDeps();
        const instance = new AutoFixAllReplyComment(deps);

        await expectAsync(
          instance.run(repoPath, ID, AGENT, MODEL_NAME, '', REPLY_BODY)
        ).toBeRejectedWithError(USAGE);
        expect(deps.execFileAsync).not.toHaveBeenCalled();
      });

      it('throws the usage message when reply_body is missing', async () => {
        const deps = stubDeps();
        const instance = new AutoFixAllReplyComment(deps);

        await expectAsync(
          instance.run(repoPath, ID, AGENT, MODEL_NAME, MODEL_EMAIL, '')
        ).toBeRejectedWithError(USAGE);
        expect(deps.execFileAsync).not.toHaveBeenCalled();
      });
    });

    describe('the happy path', () => {
      it('resolves the PR number, posts the rendered comment, pushes the branch, and resolves with the push stdout', async () => {
        // The template repeats %%AGENT%% so the first-occurrence-only
        // substitution rule is actually exercised.
        await writeTemplate(
          repoPath,
          '%%BODY%%\n\n_Replied by: %%AGENT%% agent (%%MODEL_NAME%% %%MODEL_EMAIL%%)_\nagain: %%AGENT%%\n'
        );

        const deps = stubDeps();
        const instance = new AutoFixAllReplyComment(deps);

        const result = await instance.run(repoPath, `#${ID}`, AGENT, MODEL_NAME, MODEL_EMAIL, REPLY_BODY);

        expect(result).toEqual('branch \'my-branch\' set up to track \'origin/my-branch\'.\n');

        expect(deps.execFileAsync).toHaveBeenCalledWith(jasmine.stringMatching(/resolve_pr_number\.sh$/), [
          repoPath, ID
        ]);

        expect(deps.fetchFn).toHaveBeenCalledWith('https://api.github.com/repos/darthjee/arcanum/issues/42/comments', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer fake-token',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            body: 'Fixed in the latest commit.\n\n_Replied by: node agent (Node Agent node@example.com)_\n' +
              'again: %%AGENT%%\n'
          }),
          signal: jasmine.any(AbortSignal)
        });

        expect(deps.execFileAsync).toHaveBeenCalledWith('git', ['-C', repoPath, 'branch', '--show-current']);
        expect(deps.execFileAsync).toHaveBeenCalledWith(
          'git', ['-C', repoPath, 'push', '-u', 'origin', 'my-branch:my-branch']
        );
      });
    });

    describe('when the REST call fails', () => {
      it('throws an Error and never attempts a push when the response is not ok', async () => {
        const deps = stubDeps({ fetchFn: jasmine.createSpy('fetch').and.resolveTo({ ok: false, status: 422 }) });
        const instance = new AutoFixAllReplyComment(deps);

        await expectAsync(
          instance.run(repoPath, ID, AGENT, MODEL_NAME, MODEL_EMAIL, REPLY_BODY)
        ).toBeRejected();

        expect(deps.execFileAsync).not.toHaveBeenCalledWith(
          'git', ['-C', repoPath, 'push', '-u', 'origin', jasmine.any(String)]
        );
      });

      it('throws an Error and never attempts a push when fetchFn rejects', async () => {
        const deps = stubDeps({ fetchFn: jasmine.createSpy('fetch').and.rejectWith(new Error('network down')) });
        const instance = new AutoFixAllReplyComment(deps);

        await expectAsync(
          instance.run(repoPath, ID, AGENT, MODEL_NAME, MODEL_EMAIL, REPLY_BODY)
        ).toBeRejected();

        expect(deps.execFileAsync).not.toHaveBeenCalledWith(
          'git', ['-C', repoPath, 'push', '-u', 'origin', jasmine.any(String)]
        );
      });
    });

    describe('when resolve_pr_number.sh fails', () => {
      it('throws an Error and never attempts the REST call', async () => {
        const deps = stubDeps({ execFileAsync: fakeExecFileAsync({ resolveFails: true }) });
        const instance = new AutoFixAllReplyComment(deps);

        await expectAsync(
          instance.run(repoPath, ID, AGENT, MODEL_NAME, MODEL_EMAIL, REPLY_BODY)
        ).toBeRejected();

        expect(deps.fetchFn).not.toHaveBeenCalled();
      });
    });

    describe('when git push fails', () => {
      it('throws an Error after the comment was already posted', async () => {
        const deps = stubDeps({ execFileAsync: fakeExecFileAsync({ pushFails: true }) });
        const instance = new AutoFixAllReplyComment(deps);

        await expectAsync(
          instance.run(repoPath, ID, AGENT, MODEL_NAME, MODEL_EMAIL, REPLY_BODY)
        ).toBeRejected();

        expect(deps.fetchFn).toHaveBeenCalledTimes(1);
      });
    });
  });
});
