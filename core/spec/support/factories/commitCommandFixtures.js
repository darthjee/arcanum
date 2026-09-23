import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createTempDir } from '../utils/tempDir.js';
import { fakeExecFileAsync, subcommand } from '../utils/fakeExecFileAsync.js';

/**
 * Build a fresh temp repo plus the on-disk fixture a commit-command
 * spec's `beforeEach` needs — covering the `filePath` (a single seeded
 * artifact file, e.g. `AutoNewIssueCommitIssue`'s issue file), `dirPath`
 * (an empty directory, e.g. `AutoPlanIssueCommitPlan`'s plan dir or
 * `AutoFixAllCleanupArtifacts`'s plan dir), and bare `repoPath` (no
 * extra fixture, e.g. `AutoFixIssueCommitChange`) shapes used across the
 * four commit-command specs.
 * @param {object} [opts] - fixture options.
 * @param {string} [opts.filePath] - a repo-relative path to seed as a
 *   file (parent dirs created, `# Issue\n` written).
 * @param {string} [opts.dirPath] - a repo-relative path to seed as an
 *   (empty) directory.
 * @returns {Promise<{repoPath: string, filePath: (string|undefined),
 *   dirPath: (string|undefined)}>} the built repo root plus the
 *   resolved absolute fixture paths (only the ones requested).
 */
export async function createCommitCommandRepo({ filePath: relativeFilePath, dirPath: relativeDirPath } = {}) {
  const repoPath = await createTempDir();
  let filePath;
  let dirPath;

  if (relativeFilePath) {
    filePath = path.join(repoPath, relativeFilePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, '# Issue\n');
  }

  if (relativeDirPath) {
    dirPath = path.join(repoPath, relativeDirPath);
    await mkdir(dirPath, { recursive: true });
  }

  return { repoPath, filePath, dirPath };
}

/**
 * Build a fake `execFileAsync` implementation answering the `git`
 * subcommands a commit-command may issue, so tests never shell out to
 * real `git`. Supports the three subcommand shapes used across the
 * commit-command specs: `add` + `commit -F -` + `branch --show-current`
 * + `push -u` (the default, for commands that stage a path themselves),
 * the same minus `add` (pass `stagesAdd: false`, for commands whose
 * caller already staged everything), and `ls-files` + `rm` + `diff` +
 * `commit` + `branch` + `push` (pass `tracked` to opt into this shape,
 * used by `AutoFixAllCleanupArtifacts`).
 * @param {object} [opts] - behavior overrides.
 * @param {string} [opts.branch] - the branch `git branch --show-current`
 *   reports.
 * @param {boolean} [opts.stagesAdd] - whether to answer `git add`
 *   (default `true`; ignored when `tracked` is set).
 * @param {string[]} [opts.tracked] - opts into the `ls-files`/`rm`/
 *   `diff` shape, answering `git ls-files <path>` with whether `<path>`
 *   is in this list, `git rm`/`git rm -r` by marking something staged,
 *   and `git diff` with an exit-code-1 error once anything has been
 *   staged this way.
 * @returns {Function} a jasmine spy usable as `execFileAsync`.
 */
export function fakeGitExecFileAsync({ branch = 'my-branch', stagesAdd = true, tracked } = {}) {
  let staged = false;

  const empty = () => ({ stdout: '' });
  const trackedRoutes = [
    {
      match: subcommand('ls-files'),
      respond: (args) => {
        const target = args[1];

        return { stdout: tracked.includes(target) ? `${target}\n` : '' };
      }
    },
    {
      match: subcommand('rm'),
      respond: () => {
        staged = true;

        return { stdout: '' };
      }
    },
    {
      match: subcommand('diff'),
      respond: () => {
        if (staged) {
          const error = new Error('diff reported changes');

          error.code = 1;
          throw error;
        }

        return { stdout: '' };
      }
    }
  ];
  const addRoutes = [{ match: subcommand('add'), respond: empty }];

  return fakeExecFileAsync('git', [
    ...(tracked ? trackedRoutes : []),
    ...(!tracked && stagesAdd ? addRoutes : []),
    { match: subcommand('commit'), respond: (args, options) => ({ stdout: '', __input: options.input }) },
    { match: subcommand('branch'), respond: () => ({ stdout: `${branch}\n` }) },
    { match: subcommand('push'), respond: empty }
  ]);
}

/**
 * Build a fake `ConfigChain` collaborator answering `git.agents.<agent>
 * .email` / `git.omit_model_coauthor` reads with fixed values, so tests
 * never touch the filesystem-backed config tiers.
 * @param {object} [opts] - the values to answer with.
 * @param {*} [opts.agentEmail] - the value to answer `agents.<agent>`/
 *   `email` reads with.
 * @param {*} [opts.omitModelCoauthor] - the value to answer
 *   `omit_model_coauthor` reads with.
 * @returns {{read: Function}} a fake `ConfigChain`.
 */
export function fakeConfigChain({ agentEmail, omitModelCoauthor } = {}) {
  return {
    read: jasmine.createSpy('read').and.callFake(async (repoPath, namespace, ...keys) => {
      if (keys.includes('omit_model_coauthor')) {
        return omitModelCoauthor;
      }

      return agentEmail;
    })
  };
}

/**
 * Run `CommandClass` against a fresh `execFileAsync`/`configChain` pair
 * built from `fakeGitExecFileAsync`/`fakeConfigChain`, then assert on
 * the piped `git commit` message — the "arrange, run, assert on the
 * commit call's message" shape repeated across the commit-message-
 * construction/commit-template-engine scenarios of three of the four
 * commit-command specs.
 * @param {object} opts - the scenario's wiring.
 * @param {Function} opts.CommandClass - the command class under test
 *   (constructed as `new CommandClass({ repoPath }, { execFileAsync,
 *   configChain })`).
 * @param {string} opts.repoPath - the temp repo root.
 * @param {Array} opts.runArgs - the positional args passed to `#run`.
 * @param {object} [opts.configChainOpts] - `fakeConfigChain`'s opts.
 * @param {object} [opts.execFileAsyncOpts] - `fakeGitExecFileAsync`'s
 *   opts.
 * @param {{path: string, contents?: string}} [opts.template] - a
 *   template file to write (parent dirs created) before running, for
 *   scenarios exercising the commit-template engine.
 * @param {'toEqual'|'toContain'} [opts.matcher] - which matcher to
 *   apply to the piped commit message (default `'toEqual'`).
 * @param {string} opts.expected - the expected/contained commit
 *   message.
 * @param {Array} [opts.configChainReadArgs] - when given, also asserts
 *   `configChain.read` was called with these args.
 * @param {boolean} [opts.assertCommitArgs] - when `true`, also asserts
 *   the commit call's argv is `['commit', '-F', '-']`.
 * @returns {Promise<{execFileAsync: Function, configChain: object,
 *   commitCall: object}>} the built collaborators and the located
 *   commit call, for any additional caller-side assertions.
 */
export async function expectCommitMessage({
  CommandClass,
  repoPath,
  runArgs,
  configChainOpts = {},
  execFileAsyncOpts = {},
  template,
  matcher = 'toEqual',
  expected,
  configChainReadArgs,
  assertCommitArgs = false
}) {
  if (template) {
    await mkdir(path.dirname(template.path), { recursive: true });
    await writeFile(template.path, template.contents ?? 'template\n');
  }

  const execFileAsync = fakeGitExecFileAsync(execFileAsyncOpts);
  const configChain = fakeConfigChain(configChainOpts);
  const instance = new CommandClass({ repoPath }, { execFileAsync, configChain });

  await instance.run(...runArgs);

  const commitCall = execFileAsync.calls.all().find((call) => call.args[1][0] === 'commit');

  if (assertCommitArgs) {
    expect(commitCall.args[1]).toEqual(['commit', '-F', '-']);
  }

  expect(commitCall.args[2].input)[matcher](expected);

  if (configChainReadArgs) {
    expect(configChain.read).toHaveBeenCalledWith(...configChainReadArgs);
  }

  return { execFileAsync, configChain, commitCall };
}
