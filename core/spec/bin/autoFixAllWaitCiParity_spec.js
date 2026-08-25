import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { createFakeGhBin } from '../support/utils/fakeGhBin.js';
import { createGitFixtureRepo } from '../support/utils/gitFixtureRepo.js';
import { seedOriginUrl } from '../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Parity test for the "auto-fix-all-wait-ci" migrated entrypoint (issue
// #262) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/262-migrate-auto-fix-all-wait-ci-entrypoint-to-native-node-js/node.md.
// Runs auto-fix-all/scripts/wait_ci_shell.sh (invoked directly, NOT
// through the auto-fix-all/scripts/wait_ci.sh engine_dispatch shim — so
// this test isn't circular, same convention as every other sibling
// parity spec) and `core/bin/arcanum auto-fix-all-wait-ci` against
// equivalent inputs, asserting byte-identical stdout and exit code. A
// dedicated "engine_dispatch routing" section at the bottom exercises
// the actual wait_ci.sh shim itself, for both engine.mode=shell and
// engine.mode=native, proving the shim really does select the intended
// implementation (see that section's own comment for how it stays
// network-free while still doing so).
//
// wait_ci_shell.sh polls forever (a 5s `sleep` between attempts) until
// every check-run has completed — every scenario below is built so
// BOTH implementations resolve on their very first poll (no real 5s
// wait, no hang), per the issue's own note and the repo-wide "no real
// network calls in specs" rule:
//   - `gh` itself is replaced (via a `PATH`-prepended fake binary, see
//     fakeGhBin.js) for both sides — the shell script's `gh pr view`/
//     `gh api` calls and the native side's `GithubToken#get`'s `gh auth
//     token` call.
//   - the native side's raw `fetch` calls to `api.github.com` are
//     replaced by preloading fakeGithubApiFetchPreload.js's `wait-ci`
//     mode via `node --import` (monkey-patches the global `fetch`
//     before `core/bin/arcanum` is ever imported).
//   - each fixture repo's `origin` remote is set to a github.com-shaped
//     URL — no push/fetch ever happens against it (unlike
//     auto-fix-all-reply-comment's parity spec), so no
//     `pushInsteadOf`/`insteadOf` rewrite is needed here.
//
// None of this touches the real network at any point.

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SHELL_SCRIPT = path.join(REPO_ROOT, 'auto-fix-all', 'scripts', 'wait_ci_shell.sh');
const SHIM_SCRIPT = path.join(REPO_ROOT, 'auto-fix-all', 'scripts', 'wait_ci.sh');
const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');
const FAKE_FETCH_PRELOAD = pathToFileURL(
  path.join(REPO_ROOT, 'core', 'spec', 'support', 'utils', 'fakeGithubApiFetchPreload.js')
).href;

const FAKE_GITHUB_URL = 'https://github.com/darthjee/arcanum-wait-ci-fixture.git';

/**
 * Run a wait-ci invocation (shell or native) and capture its
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
 * derive `{ domain, repo }` from, and `AutoFixAllWaitCi` never actually
 * pushes/fetches against `origin` (unlike auto-fix-all-reply-comment),
 * so no local-bare-repo transport rewrite is needed.
 * @param {{repoPath: string}} repo - the fixture repo.
 * @returns {Promise<void>} resolves once seeded.
 */
async function seedGithubLikeRepo(repo) {
  await seedOriginUrl(repo.repoPath, FAKE_GITHUB_URL);
}

/**
 * Seeds `.claude/configuration/arcanum-repo-config.json`'s
 * `auto-fix-all.ignored_check_patterns` under `repo.repoPath`.
 * @param {{repoPath: string}} repo - the fixture repo.
 * @param {Array<string>} patterns - the ignored-pattern regex strings.
 * @returns {Promise<void>} resolves once written.
 */
async function seedIgnoredCheckPatterns(repo, patterns) {
  const dir = path.join(repo.repoPath, '.claude', 'configuration');

  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, 'arcanum-repo-config.json'),
    JSON.stringify({ 'auto-fix-all': { ignored_check_patterns: patterns } })
  );
}

/**
 * Seeds `.claude/state/arcanum-config.json`'s `engine.mode` under
 * `repo.repoPath`, the local-state (highest-precedence) tier
 * `config_chain_read`/`engine_dispatch.sh` consult.
 * @param {{repoPath: string}} repo - the fixture repo.
 * @param {string} mode - `"shell"` or `"native"`.
 * @returns {Promise<void>} resolves once written.
 */
async function seedEngineMode(repo, mode) {
  const dir = path.join(repo.repoPath, '.claude', 'state');

  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'arcanum-config.json'), JSON.stringify({ engine: { mode } }));
}

describe('auto-fix-all-wait-ci parity (shell vs. native)', () => {
  describe('a missing required argument', () => {
    it('matches shell exit code and stdout', async () => {
      const cwd = await createTempDir('arcanum-core-afawc-parity-');

      try {
        const shell = await runCommand([SHELL_SCRIPT], cwd);
        const native = await runCommand([process.execPath, NATIVE_BIN, 'auto-fix-all-wait-ci'], cwd);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
      } finally {
        await removeTempDir(cwd);
      }
    });
  });

  describe('no pull request found for the current branch', () => {
    it('matches shell exit code and stdout', async () => {
      const fakeGh = await createFakeGhBin();
      const shellRepo = await createGitFixtureRepo();
      const nativeRepo = await createGitFixtureRepo();

      try {
        await Promise.all([seedGithubLikeRepo(shellRepo), seedGithubLikeRepo(nativeRepo)]);

        const env = { ...process.env, PATH: `${fakeGh.binDir}:${process.env.PATH}` };

        const shell = await runCommand([SHELL_SCRIPT, shellRepo.repoPath], shellRepo.repoPath, env);
        const native = await runCommand(
          [
            process.execPath, '--import', FAKE_FETCH_PRELOAD,
            NATIVE_BIN, 'auto-fix-all-wait-ci', nativeRepo.repoPath
          ],
          nativeRepo.repoPath,
          { ...env, ARCANUM_TEST_FAKE_FETCH: 'wait-ci' }
        );

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
      } finally {
        await Promise.all([shellRepo.cleanup(), nativeRepo.cleanup(), fakeGh.cleanup()]);
      }
    });
  });

  describe('a passing PR', () => {
    it('matches shell exit code and "passed\\n" stdout', async () => {
      const fakeGh = await createFakeGhBin();
      const shellRepo = await createGitFixtureRepo();
      const nativeRepo = await createGitFixtureRepo();

      try {
        await Promise.all([seedGithubLikeRepo(shellRepo), seedGithubLikeRepo(nativeRepo)]);

        const checkRuns = JSON.stringify([{ name: 'build', status: 'completed', conclusion: 'success' }]);
        const env = {
          ...process.env,
          PATH: `${fakeGh.binDir}:${process.env.PATH}`,
          FAKE_GH_PR_NUMBER: '42',
          FAKE_GH_HEAD_SHA: 'sha-passing',
          FAKE_GH_CHECK_RUNS_JSON: checkRuns
        };

        const shell = await runCommand([SHELL_SCRIPT, shellRepo.repoPath], shellRepo.repoPath, env);
        const native = await runCommand(
          [
            process.execPath, '--import', FAKE_FETCH_PRELOAD,
            NATIVE_BIN, 'auto-fix-all-wait-ci', nativeRepo.repoPath
          ],
          nativeRepo.repoPath,
          {
            ...env,
            ARCANUM_TEST_FAKE_FETCH: 'wait-ci',
            FAKE_FETCH_PR_NUMBER: '42',
            FAKE_FETCH_HEAD_SHA: 'sha-passing',
            FAKE_FETCH_CHECK_RUNS_JSON: checkRuns
          }
        );

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toEqual('passed\n');
      } finally {
        await Promise.all([shellRepo.cleanup(), nativeRepo.cleanup(), fakeGh.cleanup()]);
      }
    });
  });

  describe('a failing PR', () => {
    it('matches shell exit code and "failed\\n" + failed check-run names stdout', async () => {
      const fakeGh = await createFakeGhBin();
      const shellRepo = await createGitFixtureRepo();
      const nativeRepo = await createGitFixtureRepo();

      try {
        await Promise.all([seedGithubLikeRepo(shellRepo), seedGithubLikeRepo(nativeRepo)]);

        const checkRuns = JSON.stringify([
          { name: 'build', status: 'completed', conclusion: 'failure' },
          { name: 'lint', status: 'completed', conclusion: 'success' },
          { name: 'e2e', status: 'completed', conclusion: 'cancelled' }
        ]);
        const env = {
          ...process.env,
          PATH: `${fakeGh.binDir}:${process.env.PATH}`,
          FAKE_GH_PR_NUMBER: '42',
          FAKE_GH_HEAD_SHA: 'sha-failing',
          FAKE_GH_CHECK_RUNS_JSON: checkRuns
        };

        const shell = await runCommand([SHELL_SCRIPT, shellRepo.repoPath], shellRepo.repoPath, env);
        const native = await runCommand(
          [
            process.execPath, '--import', FAKE_FETCH_PRELOAD,
            NATIVE_BIN, 'auto-fix-all-wait-ci', nativeRepo.repoPath
          ],
          nativeRepo.repoPath,
          {
            ...env,
            ARCANUM_TEST_FAKE_FETCH: 'wait-ci',
            FAKE_FETCH_PR_NUMBER: '42',
            FAKE_FETCH_HEAD_SHA: 'sha-failing',
            FAKE_FETCH_CHECK_RUNS_JSON: checkRuns
          }
        );

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toEqual('failed\nbuild\ne2e\n');
      } finally {
        await Promise.all([shellRepo.cleanup(), nativeRepo.cleanup(), fakeGh.cleanup()]);
      }
    });
  });

  describe('a PR with an ignored-pattern check-run alongside a real one', () => {
    it('excludes the ignored check-run from the accounting on both sides, matching stdout/exit code', async () => {
      const fakeGh = await createFakeGhBin();
      const shellRepo = await createGitFixtureRepo();
      const nativeRepo = await createGitFixtureRepo();

      try {
        await Promise.all([
          seedGithubLikeRepo(shellRepo),
          seedGithubLikeRepo(nativeRepo),
          seedIgnoredCheckPatterns(shellRepo, ['codacy']),
          seedIgnoredCheckPatterns(nativeRepo, ['codacy'])
        ]);

        // Codacy's own "action_required" conclusion is neither
        // success nor a failure state — left unfiltered, it would hang
        // this script forever (see wait_ci_shell.sh's own header
        // comment). Only 'build' should count toward passed/failed/total.
        const checkRuns = JSON.stringify([
          { name: 'Codacy Static Code Analysis', status: 'completed', conclusion: 'action_required' },
          { name: 'build', status: 'completed', conclusion: 'success' }
        ]);
        const env = {
          ...process.env,
          PATH: `${fakeGh.binDir}:${process.env.PATH}`,
          FAKE_GH_PR_NUMBER: '42',
          FAKE_GH_HEAD_SHA: 'sha-ignored',
          FAKE_GH_CHECK_RUNS_JSON: checkRuns
        };

        const shell = await runCommand([SHELL_SCRIPT, shellRepo.repoPath], shellRepo.repoPath, env);
        const native = await runCommand(
          [
            process.execPath, '--import', FAKE_FETCH_PRELOAD,
            NATIVE_BIN, 'auto-fix-all-wait-ci', nativeRepo.repoPath
          ],
          nativeRepo.repoPath,
          {
            ...env,
            ARCANUM_TEST_FAKE_FETCH: 'wait-ci',
            FAKE_FETCH_PR_NUMBER: '42',
            FAKE_FETCH_HEAD_SHA: 'sha-ignored',
            FAKE_FETCH_CHECK_RUNS_JSON: checkRuns
          }
        );

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toEqual('passed\n');
      } finally {
        await Promise.all([shellRepo.cleanup(), nativeRepo.cleanup(), fakeGh.cleanup()]);
      }
    });
  });

  // Exercises the real auto-fix-all/scripts/wait_ci.sh engine_dispatch
  // shim from node/01 (unlike every scenario above, which bypasses it
  // and compares the two implementations directly) — proving
  // engine_dispatch.sh actually routes to the intended implementation
  // for both engine.mode=shell and engine.mode=native, per this
  // migration's own node/06 step.
  //
  // Once native mode routes through the shim, `env -i` strips this
  // process's own `ARCANUM_TEST_FAKE_FETCH`/`FAKE_FETCH_*` env vars
  // (only the explicit HOME/PATH allowlist survives — see
  // wait_ci.sh's own header comment), and the shim invokes
  // `core/bin/arcanum` as a plain argv call, with no `--import` flag to
  // preload the fake-fetch monkey-patch — so `AutoFixAllWaitCi`'s raw
  // `fetch` calls can't be faked this way here, and a runtime
  // `FAKE_GH_AUTH_TOKEN_FAIL` env var wouldn't survive to native's `gh`
  // calls either. Both scenarios below are instead built to fail before
  // any `fetch`/`gh api` call is ever reached: `FAKE_GH_PR_NUMBER` is
  // left unset, which fails inside `gh pr view` for the shell side, and
  // the native side uses a dedicated fake `gh` binary whose `auth token`
  // unconditionally fails (baked into the script file itself via
  // `createFakeGhBin({ authTokenAlwaysFails: true })`, so it survives
  // `env -i`) — making `GithubToken#get` fail even earlier, with a
  // distinct, native-only failure message that only reaches native's
  // own code path, proving real native execution (not a silent shell
  // fallback) occurred.
  describe('engine_dispatch routing (via the real wait_ci.sh shim)', () => {
    it('routes to the shell implementation when engine.mode=shell', async () => {
      const fakeGh = await createFakeGhBin();
      const repo = await createGitFixtureRepo();

      try {
        await seedGithubLikeRepo(repo);
        await seedEngineMode(repo, 'shell');

        const env = { ...process.env, PATH: `${fakeGh.binDir}:${process.env.PATH}` };
        const result = await runCommand([SHIM_SCRIPT, repo.repoPath], repo.repoPath, env);

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
        await seedEngineMode(repo, 'native');

        const env = { ...process.env, PATH: `${fakeGh.binDir}:${process.env.PATH}` };
        const result = await runCommand([SHIM_SCRIPT, repo.repoPath], repo.repoPath, env);

        expect(result.code).toEqual(1);
        expect(result.stdout).toEqual('');
        expect(result.stderr).toContain('could not obtain GitHub token via gh auth token');
      } finally {
        await Promise.all([repo.cleanup(), fakeGh.cleanup()]);
      }
    });
  });
});
