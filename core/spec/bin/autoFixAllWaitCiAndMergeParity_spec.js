import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { createFakeGhBin } from '../support/utils/fakeGhBin.js';
import { createGitFixtureRepo } from '../support/utils/gitFixtureRepo.js';
import { seedOriginUrl } from '../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Parity test for the "auto-fix-all-wait-ci-and-merge" migrated
// entrypoint (issue #266) — see
// docs/agents/architecture/script-engine.md's "output/exit-code
// contract" and
// docs/agents/plans/266-migrate-auto-fix-all-wait-ci-and-merge-entrypoint-to-native-node-js/node.md.
// Runs auto-fix-all/scripts/wait_ci_and_merge_shell.sh (invoked
// directly, NOT through the auto-fix-all/scripts/wait_ci_and_merge.sh
// engine_dispatch shim — so this test isn't circular, same convention
// as every other sibling parity spec) and `core/bin/arcanum
// auto-fix-all-wait-ci-and-merge` against equivalent inputs, asserting
// byte-identical stdout and exit code. A dedicated "engine_dispatch
// routing" section at the bottom exercises the actual
// wait_ci_and_merge.sh shim itself, for both engine.mode=shell and
// engine.mode=native, proving the shim really does select the intended
// implementation.
//
// wait_ci_and_merge_shell.sh itself calls `wait_ci.sh` (the ALREADY
// migrated `auto-fix-all-wait-ci` entrypoint's own engine_dispatch
// shim), not `wait_ci_shell.sh` directly — so, unlike every other
// sibling parity spec's "shell" side, this one's inner CI-wait step
// isn't guaranteed to run shell logic just by invoking
// wait_ci_and_merge_shell.sh directly: `config_chain.sh`'s outermost
// (global, `~/.claude/arcanum-config.json`) tier can set `engine.mode`
// to `"native"` account-wide, which would otherwise make this "shell"
// side silently exercise native code for the inner wait-ci step on a
// machine with that global default set. Every "regular" comparison
// scenario below therefore explicitly seeds the shell-side fixture
// repo's OWN `.claude/state/arcanum-config.json` (the highest-
// precedence, repo-local tier) with `engine.mode: "shell"`, overriding
// any such global default, so the shell side always exercises real
// shell logic end to end regardless of the machine it runs on.
// `github.sh` hasn't been split into its own engine_dispatch shim yet
// (see autoFixAllGithubParity_spec.js's own header comment), so
// `wait_ci_and_merge_shell.sh`'s `github.sh pr-merge` call is always
// the real shell implementation directly, unaffected by `engine.mode`.
//
// Every scenario below is network-free, per the repo-wide "no real
// network calls in specs" rule:
//   - `gh` itself is replaced (via a `PATH`-prepended fake binary, see
//     fakeGhBin.js) for both sides — the shell side's `gh pr view`/
//     `gh pr merge`/`gh api` calls and the native side's
//     `GithubToken#get`'s `gh auth token` call.
//   - the native side's raw `fetch` calls to `api.github.com` are
//     replaced by preloading fakeGithubApiFetchPreload.js's new
//     `wait-ci-and-merge` mode (the union of its `wait-ci`/`github`
//     modes' endpoints this entrypoint's two composed calls actually
//     need — see that mode's own comment) via `node --import`.
//   - each fixture repo's `origin` remote is set to a github.com-shaped
//     URL — no push/fetch ever happens against it, so no
//     `pushInsteadOf`/`insteadOf` rewrite is needed here.
//
// None of this touches the real network at any point.

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SHELL_SCRIPT = path.join(REPO_ROOT, 'auto-fix-all', 'scripts', 'wait_ci_and_merge_shell.sh');
const SHIM_SCRIPT = path.join(REPO_ROOT, 'auto-fix-all', 'scripts', 'wait_ci_and_merge.sh');
const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');
const FAKE_FETCH_PRELOAD = pathToFileURL(
  path.join(REPO_ROOT, 'core', 'spec', 'support', 'utils', 'fakeGithubApiFetchPreload.js')
).href;

const FAKE_GITHUB_URL = 'https://github.com/darthjee/arcanum-wait-ci-and-merge-fixture.git';
const MODEL_EMAIL = 'model@example.com';

/**
 * Run a wait-ci-and-merge invocation (shell or native) and capture its
 * stdout/stderr/exit code.
 * @param {string[]} commandAndArgs - `[file, ...args]` to `execFile`.
 * @param {string} cwd - the directory to run the command in.
 * @param {object} [env] - the environment to run the command with
 *   (defaults to the current process's own environment).
 * @returns {Promise<{stdout: string, stderr: string, code: number}>} the process result.
 */
async function runCommand([file, ...args], cwd, env = process.env) {
  try {
    const { stdout, stderr } = await execFileAsync(file, args, { cwd, env });

    return { stdout, stderr, code: 0 };
  } catch (error) {
    return { stdout: error.stdout || '', stderr: error.stderr || '', code: error.code ?? 1 };
  }
}

/**
 * Rewrites `repo.repoPath`'s `origin` remote to a github.com-shaped URL
 * — `Origin.js`/`origin.sh` both need a recognizable origin URL to
 * derive `{ domain, repo }` from, and neither `AutoFixAllWaitCi` nor
 * `AutoFixAllGithub#prMerge` actually pushes/fetches against `origin`,
 * so no local-bare-repo transport rewrite is needed (mirrors
 * autoFixAllWaitCiParity_spec.js's own `seedGithubLikeRepo`).
 * @param {{repoPath: string}} repo - the fixture repo.
 * @returns {Promise<void>} resolves once seeded.
 */
async function seedGithubLikeRepo(repo) {
  await seedOriginUrl(repo.repoPath, FAKE_GITHUB_URL);
}

/**
 * Seeds `.claude/state/arcanum-config.json` under `repo.repoPath`, the
 * local-state (highest-precedence) tier `config_chain_read`/
 * `engine_dispatch.sh` consult — overriding whatever the outermost
 * (global, `~/.claude/arcanum-config.json`) tier happens to be set to
 * on the machine running this spec, for both `engine.mode` (see this
 * file's header comment) and `git.merge_body_mode` (`AutoFixAllGithub#
 * mergeBodyMode` defaults to `'empty'` only when every tier is silent;
 * a machine with a global `'coauthors'` default would otherwise make
 * `AutoFixAllGithub#prMerge` issue extra `/pulls/<number>/commits`/
 * `https://api.github.com/user` calls this spec's fake fetch/gh
 * doubles don't need to stub for the scenarios below).
 * @param {{repoPath: string}} repo - the fixture repo.
 * @param {object} config - the config object to write (merged under
 *   `engine`/`git`, etc. — whatever keys the caller needs pinned).
 * @returns {Promise<void>} resolves once written.
 */
async function seedLocalState(repo, config) {
  const dir = path.join(repo.repoPath, '.claude', 'state');

  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'arcanum-config.json'), JSON.stringify(config));
}

describe('auto-fix-all-wait-ci-and-merge parity (shell vs. native)', () => {
  describe('a missing required argument', () => {
    it('matches shell exit code and stdout', async () => {
      const cwd = await createTempDir('arcanum-core-afawcam-parity-');

      try {
        const shell = await runCommand([SHELL_SCRIPT], cwd);
        const native = await runCommand([process.execPath, NATIVE_BIN, 'auto-fix-all-wait-ci-and-merge'], cwd);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
      } finally {
        await removeTempDir(cwd);
      }
    });
  });

  describe('CI passes and the merge succeeds', () => {
    it('matches shell exit code and "passed\\n<url>\\n" stdout', async () => {
      const fakeGh = await createFakeGhBin();
      const shellRepo = await createGitFixtureRepo();
      const nativeRepo = await createGitFixtureRepo();

      try {
        await Promise.all([
          seedGithubLikeRepo(shellRepo),
          seedGithubLikeRepo(nativeRepo),
          seedLocalState(shellRepo, { engine: { mode: 'shell' }, git: { merge_body_mode: 'empty' } }),
          seedLocalState(nativeRepo, { git: { merge_body_mode: 'empty' } })
        ]);

        const checkRuns = JSON.stringify([{ name: 'build', status: 'completed', conclusion: 'success' }]);
        const prUrl = 'https://github.com/darthjee/arcanum-wait-ci-and-merge-fixture/pull/42';
        const env = {
          ...process.env,
          PATH: `${fakeGh.binDir}:${process.env.PATH}`,
          FAKE_GH_PR_NUMBER: '42',
          FAKE_GH_HEAD_SHA: 'sha-passing',
          FAKE_GH_CHECK_RUNS_JSON: checkRuns,
          FAKE_GH_PR_TITLE: 'My PR',
          FAKE_GH_PR_URL: prUrl
        };

        const shell = await runCommand([SHELL_SCRIPT, shellRepo.repoPath, MODEL_EMAIL], shellRepo.repoPath, env);
        const native = await runCommand(
          [
            process.execPath, '--import', FAKE_FETCH_PRELOAD,
            NATIVE_BIN, 'auto-fix-all-wait-ci-and-merge', nativeRepo.repoPath, MODEL_EMAIL
          ],
          nativeRepo.repoPath,
          {
            ...env,
            ARCANUM_TEST_FAKE_FETCH: 'wait-ci-and-merge',
            FAKE_FETCH_PR_NUMBER: '42',
            FAKE_FETCH_HEAD_SHA: 'sha-passing',
            FAKE_FETCH_CHECK_RUNS_JSON: checkRuns,
            FAKE_FETCH_PR_TITLE: 'My PR',
            FAKE_FETCH_PR_URL: prUrl
          }
        );

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toEqual(`passed\n${prUrl}\n`);
      } finally {
        await Promise.all([shellRepo.cleanup(), nativeRepo.cleanup(), fakeGh.cleanup()]);
      }
    });
  });

  describe('CI fails', () => {
    it('matches shell exit code and "failed\\n" + failed check-run names stdout, without attempting a merge', async () => {
      const fakeGh = await createFakeGhBin();
      const shellRepo = await createGitFixtureRepo();
      const nativeRepo = await createGitFixtureRepo();

      try {
        await Promise.all([
          seedGithubLikeRepo(shellRepo),
          seedGithubLikeRepo(nativeRepo),
          seedLocalState(shellRepo, { engine: { mode: 'shell' } })
        ]);

        const checkRuns = JSON.stringify([
          { name: 'build', status: 'completed', conclusion: 'failure' },
          { name: 'lint', status: 'completed', conclusion: 'success' }
        ]);
        // Merge-related fixtures are deliberately configured to FAIL
        // (an unusable title/url) — if either implementation were
        // buggy and attempted a merge anyway despite CI failing, its
        // stdout would gain an unexpected "passed\n<merge output>"
        // suffix and this scenario's own exact-stdout assertion below
        // would catch it, proving no merge attempt happened.
        const env = {
          ...process.env,
          PATH: `${fakeGh.binDir}:${process.env.PATH}`,
          FAKE_GH_PR_NUMBER: '42',
          FAKE_GH_HEAD_SHA: 'sha-failing',
          FAKE_GH_CHECK_RUNS_JSON: checkRuns,
          FAKE_GH_PR_MERGE_FAIL: '1'
        };

        const shell = await runCommand([SHELL_SCRIPT, shellRepo.repoPath, MODEL_EMAIL], shellRepo.repoPath, env);
        const native = await runCommand(
          [
            process.execPath, '--import', FAKE_FETCH_PRELOAD,
            NATIVE_BIN, 'auto-fix-all-wait-ci-and-merge', nativeRepo.repoPath, MODEL_EMAIL
          ],
          nativeRepo.repoPath,
          {
            ...env,
            ARCANUM_TEST_FAKE_FETCH: 'wait-ci-and-merge',
            FAKE_FETCH_PR_NUMBER: '42',
            FAKE_FETCH_HEAD_SHA: 'sha-failing',
            FAKE_FETCH_CHECK_RUNS_JSON: checkRuns,
            FAKE_FETCH_MERGE_FAIL: '1'
          }
        );

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toEqual('failed\nbuild\n');
      } finally {
        await Promise.all([shellRepo.cleanup(), nativeRepo.cleanup(), fakeGh.cleanup()]);
      }
    });
  });

  // Exercises the real auto-fix-all/scripts/wait_ci_and_merge.sh
  // engine_dispatch shim (unlike every scenario above, which bypasses
  // it and compares the two implementations directly) — proving
  // engine_dispatch.sh actually routes to the intended implementation
  // for both engine.mode=shell and engine.mode=native, mirroring
  // autoFixAllWaitCiParity_spec.js's own "engine_dispatch routing"
  // section (see that section's own comment for why both scenarios
  // below are built to fail before any `fetch`/`gh api` call is ever
  // reached, and why that's still enough to prove real native
  // execution occurred).
  describe('engine_dispatch routing (via the real wait_ci_and_merge.sh shim)', () => {
    it('routes to the shell implementation when engine.mode=shell', async () => {
      const fakeGh = await createFakeGhBin();
      const repo = await createGitFixtureRepo();

      try {
        await seedGithubLikeRepo(repo);
        await seedLocalState(repo, { engine: { mode: 'shell' } });

        const env = { ...process.env, PATH: `${fakeGh.binDir}:${process.env.PATH}` };
        const result = await runCommand([SHIM_SCRIPT, repo.repoPath, MODEL_EMAIL], repo.repoPath, env);

        expect(result.code).toEqual(1);
        expect(result.stdout).toEqual('');
        expect(result.stderr).toContain('no pull request found for the current branch');
      } finally {
        await Promise.all([repo.cleanup(), fakeGh.cleanup()]);
      }
    });

    it('routes to the native implementation when engine.mode=native', async () => {
      const fakeGh = await createFakeGhBin({ authTokenAlwaysFails: true });
      const repo = await createGitFixtureRepo();

      try {
        await seedGithubLikeRepo(repo);
        await seedLocalState(repo, { engine: { mode: 'native' } });

        const env = { ...process.env, PATH: `${fakeGh.binDir}:${process.env.PATH}` };
        const result = await runCommand([SHIM_SCRIPT, repo.repoPath, MODEL_EMAIL], repo.repoPath, env);

        expect(result.code).toEqual(1);
        expect(result.stdout).toEqual('');
        expect(result.stderr).toContain('could not obtain GitHub token via gh auth token');
      } finally {
        await Promise.all([repo.cleanup(), fakeGh.cleanup()]);
      }
    });
  });
});
