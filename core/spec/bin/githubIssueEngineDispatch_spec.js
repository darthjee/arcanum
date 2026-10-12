import { realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expectGhNeedsRun } from '../support/factories/engineDispatchDockerSetup.js';
import { seedGithubLikeRepo } from '../support/factories/githubParitySetup.js';
import { itRoutesGhEngineDispatch } from '../support/sharedExamples/ghEngineDispatchRouting.js';
import { seedEngineMode } from '../support/utils/engineMode.js';
import { REPO_ROOT, runCommand } from '../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

const SHIM_SCRIPT = path.join(REPO_ROOT, 'arcanum', '_lib', 'github_issue.sh');
const REPO_REF = 'darthjee/arcanum-github-fixture';

/**
 * @param {string} repoPath - the fixture repo.
 * @returns {string} `_load_origin`'s / `Origin#resolve`'s missing-origin message.
 */
function noOriginError(repoPath) {
  return `Error: '${repoPath}' is not a git repository or has no 'origin' remote\n`;
}

/**
 * @param {{repoPath: string}} repo - the fixture repo.
 * @returns {Promise<void>} resolves once its `origin` remote is removed.
 */
async function removeOrigin(repo) {
  await runCommand(['git', '-C', repo.repoPath, 'remote', 'remove', 'origin'], repo.repoPath);
}

/**
 * The per-mode assertions for a scenario that fails on the missing
 * `origin` before any GitHub call: only core/bin/arcanum prefixes the
 * message with `arcanum: `, which proves which implementation ran.
 * @param {() => string} repoPath - the case's repo path.
 * @param {(repoPath: string) => string[]} after - the argv after the image.
 * @param {() => string[]} [pathMounts] - the expected `--path-arg` mounts.
 * @returns {object} the `shell`/`native`/`docker` callbacks.
 */
function failsOnMissingOrigin(repoPath, after, pathMounts = () => []) {
  return {
    shell: (result) => {
      expect(result).toEqual({ stdout: '', stderr: noOriginError(repoPath()), code: 1 });
    },
    native: (result) => {
      expect(result).toEqual({ stdout: '', stderr: `arcanum: ${noOriginError(repoPath())}`, code: 1 });
    },
    docker: (result, calls, world) => {
      expect(result).toEqual({ stdout: '', stderr: `arcanum: ${noOriginError(repoPath())}`, code: 1 });
      expectGhNeedsRun(calls, repoPath(), after(repoPath()), world, pathMounts());
    }
  };
}

// Routing spec for the real arcanum/_lib/github_issue.sh shim's `info`,
// `fetch`, `create` and `update` subcommands (docker batch 3, issue
// #747) under engine.mode=shell, native and docker (a passthrough fake
// `docker`); the `mark-*` subcommands live in
// githubIssueMarkParity/engine_dispatch_spec.js. `info` is git-only, so
// every mode succeeds; the others run in a repo with no `origin`, so
// they fail before any GitHub call — with core/bin/arcanum's `arcanum: `
// prefix in native and docker only. Every docker run carries the
// `--needs=global-config,gitconfig,gh` mounts and env; `create`'s and
// `update`'s <file> (`--path-arg=3:ro` / `--path-arg=4:ro`) adds a
// read-only file mount only when it sits outside the repo.
describe('github-issue info/fetch/create/update engine_dispatch routing (via the real github_issue.sh shim)', () => {
  let repoPath;
  let bodyFile;

  itRoutesGhEngineDispatch(
    'info',
    SHIM_SCRIPT,
    async (repo, mode) => {
      repoPath = repo.repoPath;
      await seedGithubLikeRepo(repo);
      await seedEngineMode(repo, mode);

      return { args: ['info', repo.repoPath] };
    },
    {
      shell: (result) => {
        expect(result).toEqual({ stdout: `DOMAIN=github.com\nREPO=${REPO_REF}\n`, stderr: '', code: 0 });
      },
      native: (result) => {
        expect(result).toEqual({ stdout: `DOMAIN=github.com\nREPO=${REPO_REF}\n`, stderr: '', code: 0 });
      },
      docker: (result, calls, world) => {
        expect(result).toEqual({ stdout: `DOMAIN=github.com\nREPO=${REPO_REF}\n`, stderr: '', code: 0 });
        expectGhNeedsRun(calls, repoPath, ['github-issue-info', repoPath], world);
      }
    }
  );

  itRoutesGhEngineDispatch(
    'fetch (no origin)',
    SHIM_SCRIPT,
    async (repo, mode) => {
      repoPath = repo.repoPath;
      await removeOrigin(repo);
      await seedEngineMode(repo, mode);

      return { args: ['fetch', repo.repoPath, '42'] };
    },
    failsOnMissingOrigin(() => repoPath, (repo) => ['github-issue-fetch', repo, '42'])
  );

  /**
   * Builds a `prepare` for a <file>-taking subcommand: no `origin`, and
   * the body file either inside the repo or in a temp dir outside it.
   * @param {(repoPath: string, file: string) => string[]} args - the shim's args.
   * @param {boolean} outside - whether the file sits outside the repo.
   * @returns {(repo: {repoPath: string}, mode: string) => Promise<object>} the prepare.
   */
  function prepareWithBody(args, outside) {
    return async (repo, mode) => {
      repoPath = repo.repoPath;
      await removeOrigin(repo);
      await seedEngineMode(repo, mode);

      if (!outside) {
        bodyFile = path.join(repo.repoPath, 'body.md');
        await writeFile(bodyFile, 'body\n');

        return { args: args(repo.repoPath, bodyFile) };
      }

      const dir = await realpath(await createTempDir('arcanum-core-github-issue-body-'));

      bodyFile = path.join(dir, 'body.md');
      await writeFile(bodyFile, 'body\n');

      return { args: args(repo.repoPath, bodyFile), cleanup: () => removeTempDir(dir) };
    };
  }

  [
    { label: 'inside the repo', outside: false, mounts: () => [] },
    { label: 'outside the repo', outside: true, mounts: () => [`${bodyFile}:${bodyFile}:ro`] }
  ].forEach(({ label, outside, mounts }) => {
    itRoutesGhEngineDispatch(
      `create (no origin, body file ${label})`,
      SHIM_SCRIPT,
      prepareWithBody((repo, file) => ['create', repo, 'My title', file], outside),
      failsOnMissingOrigin(() => repoPath, (repo) => ['github-issue-create', repo, 'My title', bodyFile], mounts)
    );

    itRoutesGhEngineDispatch(
      `update (no origin, body file ${label})`,
      SHIM_SCRIPT,
      prepareWithBody((repo, file) => ['update', repo, '42', 'My title', file], outside),
      failsOnMissingOrigin(() => repoPath, (repo) => ['github-issue-update', repo, '42', 'My title', bodyFile], mounts)
    );
  });
});
