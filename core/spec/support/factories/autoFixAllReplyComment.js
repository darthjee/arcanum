import { resolveInstallPath } from '../../../lib/utils/file/InstallRoot.js';
import { createRepoContextMock } from './repoContextFactory.js';

export const USAGE = 'Usage: reply_comment.sh <repo_path> <id> <agent> <model_name> <model_email> <reply_body>';
export const ID = '999';
export const AGENT = 'node';
export const MODEL_NAME = 'Node Agent';
export const MODEL_EMAIL = 'node@example.com';
export const REPLY_BODY = 'Fixed in the latest commit.';
export const DEFAULT_TEMPLATE = '%%BODY%%\n\n_Replied by: %%AGENT%% agent (%%MODEL_NAME%% %%MODEL_EMAIL%%)_\n';
export const TEMPLATE_PATH = resolveInstallPath('auto-fix-all', 'templates', 'reply.tmpl.md');

/**
 * Build a stub `readFile` that returns `content` for the install-root
 * template path, mirroring `AutoFixAllReplyComment`'s real read.
 * @param {string} [content] - the template's raw content.
 * @returns {Function} a jasmine spy usable as `readFile`.
 */
export function fakeReadFile(content = DEFAULT_TEMPLATE) {
  return jasmine.createSpy('readFile').and.callFake(async (file) => {
    if (file === TEMPLATE_PATH) {
      return content;
    }

    throw new Error(`unexpected readFile call: ${file}`);
  });
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
export function fakeExecFileAsync({ prNumber = '42', resolveFails = false, pushFails = false, branch = 'my-branch' } = {}) {
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
export function stubDeps(overrides = {}) {
  return {
    execFileAsync: fakeExecFileAsync(),
    fetchFn: jasmine.createSpy('fetch').and.resolveTo({ ok: true, json: async () => ({}) }),
    readFile: fakeReadFile(),
    ...overrides
  };
}

/**
 * Build a `RepoContext` wired with the `origin`/`githubToken` fakes
 * `IssueClient` needs to resolve the repo and token.
 * @param {string} repoPath - the context's `repoPath`.
 * @returns {import('../../../lib/context/RepoContext.js').default} the context.
 */
export function newContext(repoPath) {
  return createRepoContextMock({
    repoPath,
    origin: {
      resolve: async () => ({ domain: 'github.com', repo: 'darthjee/arcanum' }),
      resolveWithRef: async () => ({ domain: 'github.com', repo: 'darthjee/arcanum', repoRef: 'darthjee/arcanum' })
    },
    githubToken: { get: async () => 'fake-token' }
  });
}
