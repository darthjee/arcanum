import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { createFakeGhBin } from '../support/utils/fakeGhBin.js';
import { createGitFixtureRepo } from '../support/utils/gitFixtureRepo.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Parity test for the "auto-fix-all-github" migrated entrypoint (issue
// #265) — see docs/agents/architecture/script-engine.md's "output/
// exit-code contract" and
// docs/agents/plans/265-migrate-auto-fix-all-github-entrypoint-pr-number-pr-state-pr-merge-cleanup-branch-has-shipit-label-add-tag-remove-tag-to-native-node-js/node.md.
// Runs auto-fix-all/scripts/github.sh directly (it hasn't been split
// into an engine_dispatch shim yet — see node/05's scope note, "all
// changes scoped to core/") and `core/bin/arcanum
// auto-fix-all-github-<subcommand>` against equivalent inputs, asserting
// byte-identical stdout and exit code, same pattern as
// autoFixAllWaitCiParity_spec.js/autoFixAllQueueParity_spec.js:
//   - `gh` itself is replaced (via a `PATH`-prepended fake binary, see
//     fakeGhBin.js) for both sides.
//   - the native side's raw `fetch` calls to `api.github.com` are
//     replaced by preloading fakeGithubApiFetchPreload.js's `github`
//     mode via `node --import`.
//   - each fixture repo's `origin` remote is set to a github.com-shaped
//     URL for every subcommand except `cleanup-branch` (the only one
//     that actually pushes/resets against `origin`, and never resolves
//     it via `Origin.js`/`origin.sh` — its fixture repos keep their real
//     local bare-repo remote instead).
//   - shell and native each get their OWN fixture repo (never shared),
//     same convention as every other sibling parity spec.
//
// None of this touches the real network at any point.
//
// A final "engine_dispatch routing" section proves
// arcanum/_lib/engine_dispatch.sh correctly routes each of the 7
// `auto-fix-all-github-*` command names to shell/native given
// migration-status.json now marking this entrypoint migrated.

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SHELL_SCRIPT = path.join(REPO_ROOT, 'auto-fix-all', 'scripts', 'github.sh');
const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');
const ENGINE_DISPATCH_SCRIPT = path.join(REPO_ROOT, 'arcanum', '_lib', 'engine_dispatch.sh');
const FAKE_FETCH_PRELOAD = pathToFileURL(
  path.join(REPO_ROOT, 'core', 'spec', 'support', 'utils', 'fakeGithubApiFetchPreload.js')
).href;

const FAKE_GITHUB_URL = 'https://github.com/darthjee/arcanum-github-fixture.git';

/**
 * Run a command and capture its stdout/stderr/exit code.
 * @param {string[]} commandAndArgs - `[file, ...args]` to `execFile`.
 * @param {string} cwd - the directory to run the command in.
 * @param {object} [env] - the environment to run the command with.
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
 * @param {string[]} args - the `git` arguments to run.
 * @param {string} cwd - the directory to run them in.
 * @returns {Promise<void>} resolves once the command succeeds.
 */
async function git(args, cwd) {
  await execFileAsync('git', args, {
    cwd,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 't@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 't@example.com'
    }
  });
}

/**
 * Rewrites `repo.repoPath`'s `origin` remote to a github.com-shaped URL —
 * every subcommand except `cleanup-branch` needs a recognizable origin
 * URL to derive `{ domain, repo }` from, and none of them actually
 * pushes/fetches against `origin`, so no local-bare-repo transport
 * rewrite is needed (mirrors autoFixAllWaitCiParity_spec.js's own
 * `seedGithubLikeRepo`).
 * @param {{repoPath: string}} repo - the fixture repo.
 * @returns {Promise<void>} resolves once seeded.
 */
async function seedGithubLikeRepo(repo) {
  await git(['remote', 'set-url', 'origin', FAKE_GITHUB_URL], repo.repoPath);
}

/**
 * Build a matched pair of env objects (shell-side `FAKE_GH_*`, native-side
 * `FAKE_FETCH_*`) from one shared scenario object, so both sides of a
 * comparison are seeded identically without repeating every field twice.
 * @param {object} fakeGhEnv - base env (PATH-prepended fake `gh`).
 * @param {object} [scenario] - the scenario's shell/native env var overrides.
 * @param {object} [scenario.ghVars] - `FAKE_GH_*` overrides, for the shell side.
 * @param {object} [scenario.fetchVars] - `FAKE_FETCH_*` overrides, for the native side.
 * @returns {{shellEnv: object, nativeEnv: object}} the two env objects.
 */
function seedEnv(fakeGhEnv, { ghVars = {}, fetchVars = {} } = {}) {
  return {
    shellEnv: { ...fakeGhEnv, ...ghVars },
    nativeEnv: { ...fakeGhEnv, ARCANUM_TEST_FAKE_FETCH: 'github', ...fetchVars }
  };
}

/**
 * Run one subcommand on both sides — shell against `shellRepo`, native
 * against `nativeRepo` — asserting nothing itself; just returns both
 * results for the caller to assert on.
 * @param {string} subcommand - `github.sh`'s subcommand name (e.g.
 *   `pr-number`).
 * @param {string} nativeCommand - the matching `core/bin/arcanum`
 *   command name (e.g. `auto-fix-all-github-pr-number`).
 * @param {string[]} extraArgs - any arguments after `<repo_path>` (e.g.
 *   `[id]`, `[id, tag]`).
 * @param {{repoPath: string}} shellRepo - the shell side's fixture repo.
 * @param {{repoPath: string}} nativeRepo - the native side's fixture repo.
 * @param {object} shellEnv - the shell invocation's environment.
 * @param {object} nativeEnv - the native invocation's environment.
 * @returns {Promise<{shell: object, native: object}>} both sides' results.
 */
async function runBoth(subcommand, nativeCommand, extraArgs, shellRepo, nativeRepo, shellEnv, nativeEnv) {
  const shell = await runCommand(
    [SHELL_SCRIPT, subcommand, shellRepo.repoPath, ...extraArgs],
    shellRepo.repoPath,
    shellEnv
  );
  const native = await runCommand(
    [process.execPath, '--import', FAKE_FETCH_PRELOAD, NATIVE_BIN, nativeCommand, nativeRepo.repoPath, ...extraArgs],
    nativeRepo.repoPath,
    nativeEnv
  );

  return { shell, native };
}

describe('auto-fix-all-github parity (shell vs. native)', () => {
  describe('pr-number', () => {
    it('matches shell exit code and stdout for a resolved PR number', async () => {
      const fakeGh = await createFakeGhBin();
      const shellRepo = await createGitFixtureRepo();
      const nativeRepo = await createGitFixtureRepo();

      try {
        await Promise.all([seedGithubLikeRepo(shellRepo), seedGithubLikeRepo(nativeRepo)]);

        const fakeGhEnv = { ...process.env, PATH: `${fakeGh.binDir}:${process.env.PATH}` };
        const { shellEnv, nativeEnv } = seedEnv(fakeGhEnv, {
          ghVars: { FAKE_GH_PR_NUMBER: '42' },
          fetchVars: { FAKE_FETCH_PR_NUMBER: '42' }
        });

        const { shell, native } = await runBoth(
          'pr-number', 'auto-fix-all-github-pr-number', [], shellRepo, nativeRepo, shellEnv, nativeEnv
        );

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toEqual('42\n');
      } finally {
        await Promise.all([shellRepo.cleanup(), nativeRepo.cleanup(), fakeGh.cleanup()]);
      }
    });

    it('matches shell exit code and stdout when no pull request is found', async () => {
      const fakeGh = await createFakeGhBin();
      const shellRepo = await createGitFixtureRepo();
      const nativeRepo = await createGitFixtureRepo();

      try {
        await Promise.all([seedGithubLikeRepo(shellRepo), seedGithubLikeRepo(nativeRepo)]);

        const fakeGhEnv = { ...process.env, PATH: `${fakeGh.binDir}:${process.env.PATH}` };
        const { shellEnv, nativeEnv } = seedEnv(fakeGhEnv);

        const { shell, native } = await runBoth(
          'pr-number', 'auto-fix-all-github-pr-number', [], shellRepo, nativeRepo, shellEnv, nativeEnv
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

  describe('pr-state', () => {
    it('matches shell exit code and "STATE=MERGED\\n" stdout for a merged PR', async () => {
      const fakeGh = await createFakeGhBin();
      const shellRepo = await createGitFixtureRepo();
      const nativeRepo = await createGitFixtureRepo();

      try {
        await Promise.all([seedGithubLikeRepo(shellRepo), seedGithubLikeRepo(nativeRepo)]);

        const fakeGhEnv = { ...process.env, PATH: `${fakeGh.binDir}:${process.env.PATH}` };
        const { shellEnv, nativeEnv } = seedEnv(fakeGhEnv, {
          ghVars: { FAKE_GH_PR_NUMBER: '42', FAKE_GH_PR_STATE: 'MERGED' },
          fetchVars: { FAKE_FETCH_PR_NUMBER: '42', FAKE_FETCH_PR_MERGED: '1', FAKE_FETCH_PR_STATE: 'closed' }
        });

        const { shell, native } = await runBoth(
          'pr-state', 'auto-fix-all-github-pr-state', [], shellRepo, nativeRepo, shellEnv, nativeEnv
        );

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toEqual('STATE=MERGED\n');
      } finally {
        await Promise.all([shellRepo.cleanup(), nativeRepo.cleanup(), fakeGh.cleanup()]);
      }
    });
  });

  describe('pr-merge', () => {
    it('matches shell exit code and "<url>\\n" stdout for a successful merge', async () => {
      const fakeGh = await createFakeGhBin();
      const shellRepo = await createGitFixtureRepo();
      const nativeRepo = await createGitFixtureRepo();

      try {
        await Promise.all([seedGithubLikeRepo(shellRepo), seedGithubLikeRepo(nativeRepo)]);

        const prUrl = 'https://github.com/darthjee/arcanum-github-fixture/pull/42';
        const fakeGhEnv = { ...process.env, PATH: `${fakeGh.binDir}:${process.env.PATH}` };
        const { shellEnv, nativeEnv } = seedEnv(fakeGhEnv, {
          ghVars: { FAKE_GH_PR_NUMBER: '42', FAKE_GH_PR_TITLE: 'My PR', FAKE_GH_PR_URL: prUrl },
          fetchVars: { FAKE_FETCH_PR_NUMBER: '42', FAKE_FETCH_PR_TITLE: 'My PR', FAKE_FETCH_PR_URL: prUrl }
        });

        const { shell, native } = await runBoth(
          'pr-merge', 'auto-fix-all-github-pr-merge', [], shellRepo, nativeRepo, shellEnv, nativeEnv
        );

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toEqual(`${prUrl}\n`);
      } finally {
        await Promise.all([shellRepo.cleanup(), nativeRepo.cleanup(), fakeGh.cleanup()]);
      }
    });

    it('matches shell exit code and stdout when no pull request is found', async () => {
      const fakeGh = await createFakeGhBin();
      const shellRepo = await createGitFixtureRepo();
      const nativeRepo = await createGitFixtureRepo();

      try {
        await Promise.all([seedGithubLikeRepo(shellRepo), seedGithubLikeRepo(nativeRepo)]);

        const fakeGhEnv = { ...process.env, PATH: `${fakeGh.binDir}:${process.env.PATH}` };
        const { shellEnv, nativeEnv } = seedEnv(fakeGhEnv);

        const { shell, native } = await runBoth(
          'pr-merge', 'auto-fix-all-github-pr-merge', [], shellRepo, nativeRepo, shellEnv, nativeEnv
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

  describe('cleanup-branch', () => {
    // Neither `git reset --hard`'s nor `git branch -D`'s own stdout is
    // redirected by `cmd_cleanup_branch` — both leak straight through
    // (see AutoFixAllGithub.js#cleanupBranch's doc comment) and embed a
    // commit sha, which necessarily differs between the two independent
    // fixture repos this test builds (different repo, different commit
    // timestamps -> different shas), even though their tree content is
    // identical. So rather than asserting shell.stdout === native.stdout
    // directly, this predicts each side's own expected stdout from its
    // own repo's actual shas, and asserts each side matches its own
    // prediction — proving the underlying git-stdout-forwarding logic is
    // correct on both sides equally, which is what "parity" means here.
    it('matches shell/native predicted stdout (from each repo\'s own shas) and exit code, leaving both on main with the issue branch gone', async () => {
      const shellRepo = await createGitFixtureRepo();
      const nativeRepo = await createGitFixtureRepo();

      try {
        const shas = {};

        for (const [key, repo] of [['shell', shellRepo], ['native', nativeRepo]]) {
          await git(['checkout', '-b', 'issue-9'], repo.repoPath);
          await writeFile(path.join(repo.repoPath, 'change.txt'), 'x');
          await git(['add', 'change.txt'], repo.repoPath);
          await git(['commit', '--quiet', '-m', 'change'], repo.repoPath);
          await git(['push', '--quiet', 'origin', 'issue-9'], repo.repoPath);

          const { stdout: mainSha } = await execFileAsync(
            'git', ['rev-parse', '--short', 'origin/main'], { cwd: repo.repoPath }
          );
          const { stdout: issueSha } = await execFileAsync(
            'git', ['rev-parse', '--short', 'issue-9'], { cwd: repo.repoPath }
          );

          shas[key] = { mainSha: mainSha.trim(), issueSha: issueSha.trim() };
        }

        const shell = await runCommand([SHELL_SCRIPT, 'cleanup-branch', shellRepo.repoPath, '9'], shellRepo.repoPath);
        const native = await runCommand(
          [process.execPath, NATIVE_BIN, 'auto-fix-all-github-cleanup-branch', nativeRepo.repoPath, '9'],
          nativeRepo.repoPath
        );

        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toEqual(
          `Your branch is up to date with 'origin/main'.\nHEAD is now at ${shas.shell.mainSha} seed\nDeleted branch issue-9 (was ${shas.shell.issueSha}).\n`
        );
        expect(native.stdout).toEqual(
          `Your branch is up to date with 'origin/main'.\nHEAD is now at ${shas.native.mainSha} seed\nDeleted branch issue-9 (was ${shas.native.issueSha}).\n`
        );

        for (const repo of [shellRepo, nativeRepo]) {
          const { stdout: branch } = await execFileAsync('git', ['branch', '--show-current'], { cwd: repo.repoPath });
          const { stdout: branches } = await execFileAsync('git', ['branch', '--list', 'issue-9'], { cwd: repo.repoPath });

          expect(branch.trim()).toEqual('main');
          expect(branches.trim()).toEqual('');
        }
      } finally {
        await Promise.all([shellRepo.cleanup(), nativeRepo.cleanup()]);
      }
    });
  });

  describe('has-shipit-label', () => {
    it('matches shell exit code (0) and empty stdout when the shipit label is present', async () => {
      const fakeGh = await createFakeGhBin();
      const shellRepo = await createGitFixtureRepo();
      const nativeRepo = await createGitFixtureRepo();

      try {
        await Promise.all([seedGithubLikeRepo(shellRepo), seedGithubLikeRepo(nativeRepo)]);

        const fakeGhEnv = { ...process.env, PATH: `${fakeGh.binDir}:${process.env.PATH}` };
        const { shellEnv, nativeEnv } = seedEnv(fakeGhEnv, {
          ghVars: { FAKE_GH_ISSUE_LABELS: 'shipit\nOther' },
          fetchVars: { FAKE_FETCH_ISSUE_LABELS: 'shipit\nOther' }
        });

        const { shell, native } = await runBoth(
          'has-shipit-label', 'auto-fix-all-github-has-shipit-label', ['5'], shellRepo, nativeRepo, shellEnv, nativeEnv
        );

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toEqual('');
      } finally {
        await Promise.all([shellRepo.cleanup(), nativeRepo.cleanup(), fakeGh.cleanup()]);
      }
    });

    it('matches shell exit code (1) and empty stdout when the shipit label is absent', async () => {
      const fakeGh = await createFakeGhBin();
      const shellRepo = await createGitFixtureRepo();
      const nativeRepo = await createGitFixtureRepo();

      try {
        await Promise.all([seedGithubLikeRepo(shellRepo), seedGithubLikeRepo(nativeRepo)]);

        const fakeGhEnv = { ...process.env, PATH: `${fakeGh.binDir}:${process.env.PATH}` };
        const { shellEnv, nativeEnv } = seedEnv(fakeGhEnv, {
          ghVars: { FAKE_GH_ISSUE_LABELS: 'Other' },
          fetchVars: { FAKE_FETCH_ISSUE_LABELS: 'Other' }
        });

        const { shell, native } = await runBoth(
          'has-shipit-label', 'auto-fix-all-github-has-shipit-label', ['5'], shellRepo, nativeRepo, shellEnv, nativeEnv
        );

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(1);
        expect(shell.stdout).toEqual('');
      } finally {
        await Promise.all([shellRepo.cleanup(), nativeRepo.cleanup(), fakeGh.cleanup()]);
      }
    });
  });

  describe('add-tag', () => {
    it('matches shell exit code/stdout for a successful add', async () => {
      const fakeGh = await createFakeGhBin();
      const shellRepo = await createGitFixtureRepo();
      const nativeRepo = await createGitFixtureRepo();

      try {
        await Promise.all([seedGithubLikeRepo(shellRepo), seedGithubLikeRepo(nativeRepo)]);

        const fakeGhEnv = { ...process.env, PATH: `${fakeGh.binDir}:${process.env.PATH}` };
        const { shellEnv, nativeEnv } = seedEnv(fakeGhEnv, {
          ghVars: { FAKE_GH_ISSUE_LABELS: '' },
          fetchVars: { FAKE_FETCH_ISSUE_LABELS: '' }
        });

        const { shell, native } = await runBoth(
          'add-tag', 'auto-fix-all-github-add-tag', ['5', 'ready_for_work'], shellRepo, nativeRepo, shellEnv, nativeEnv
        );

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toEqual('Added tag \'ready_for_work\' to issue #5 on darthjee/arcanum-github-fixture\n');
      } finally {
        await Promise.all([shellRepo.cleanup(), nativeRepo.cleanup(), fakeGh.cleanup()]);
      }
    });

    it('matches shell exit code (1) and empty stdout for the shipit guard', async () => {
      const shellRepo = await createGitFixtureRepo();
      const nativeRepo = await createGitFixtureRepo();

      try {
        await Promise.all([seedGithubLikeRepo(shellRepo), seedGithubLikeRepo(nativeRepo)]);

        const shell = await runCommand([SHELL_SCRIPT, 'add-tag', shellRepo.repoPath, '5', 'shipit'], shellRepo.repoPath);
        const native = await runCommand(
          [process.execPath, NATIVE_BIN, 'auto-fix-all-github-add-tag', nativeRepo.repoPath, '5', 'shipit'],
          nativeRepo.repoPath
        );

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(1);
        expect(shell.stdout).toEqual('');
      } finally {
        await Promise.all([shellRepo.cleanup(), nativeRepo.cleanup()]);
      }
    });
  });

  describe('remove-tag', () => {
    it('matches shell exit code/stdout for a successful remove', async () => {
      const fakeGh = await createFakeGhBin();
      const shellRepo = await createGitFixtureRepo();
      const nativeRepo = await createGitFixtureRepo();

      try {
        await Promise.all([seedGithubLikeRepo(shellRepo), seedGithubLikeRepo(nativeRepo)]);

        const fakeGhEnv = { ...process.env, PATH: `${fakeGh.binDir}:${process.env.PATH}` };
        const { shellEnv, nativeEnv } = seedEnv(fakeGhEnv, {
          ghVars: { FAKE_GH_ISSUE_LABELS: 'Ready for Work' },
          fetchVars: { FAKE_FETCH_ISSUE_LABELS: 'Ready for Work' }
        });

        const { shell, native } = await runBoth(
          'remove-tag',
          'auto-fix-all-github-remove-tag',
          ['5', 'ready_for_work'],
          shellRepo,
          nativeRepo,
          shellEnv,
          nativeEnv
        );

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toEqual(
          'Removed tag \'ready_for_work\' from issue #5 on darthjee/arcanum-github-fixture\n'
        );
      } finally {
        await Promise.all([shellRepo.cleanup(), nativeRepo.cleanup(), fakeGh.cleanup()]);
      }
    });
  });

  // Proves arcanum/_lib/engine_dispatch.sh correctly routes based on
  // migration-status.json now marking "auto-fix-all-github" migrated
  // (node/06's own "Dispatch verification" requirement), using that
  // exact single migration-status.json key — unlike every scenario
  // above (matched 1:1 to a `core/bin/arcanum auto-fix-all-github-*`
  // COMMANDS entry each), migration-status.json tracks this whole
  // 7-subcommand entrypoint under ONE flag ("auto-fix-all-github", not
  // 7 separate per-subcommand keys — see node/05's "Files to Change"),
  // since `github.sh` hasn't been split into a per-entrypoint
  // engine_dispatch shim yet (see node/05's scope note, "all changes
  // scoped to core/"). A future shim built against that single flag
  // will need to map it to whichever specific `core/bin/arcanum`
  // command each subcommand actually dispatches to — out of scope here.
  //
  // This section exercises the real, shared arcanum/_lib/engine_dispatch.sh
  // directly via a throwaway wrapper script (built here, not committed)
  // plus a throwaway fixture standing in for "the shell implementation"
  // — the same role auto-fix-all/scripts/wait_ci_shell.sh plays for
  // autoFixAllWaitCiParity_spec.js's own routing section.
  //
  // `repoPath` here is a plain (non-git) temp directory: engine_dispatch
  // only needs it to resolve `engine.mode` via config_chain_read, which
  // works against any directory. For engine.mode=native, this proves
  // routing occurred via a distinct signal: core/bin/arcanum has no
  // "auto-fix-all-github" COMMANDS entry (each subcommand has its own,
  // more specific key instead), so it fails loudly with `arcanum:
  // unknown command 'auto-fix-all-github'` — empty stdout, non-zero
  // exit — which is trivially distinguishable from the shell fixture's
  // own fixed "SHELL: ..." stdout line, and is NOT the "no native
  // implementation... falling back to shell" warning (which would mean
  // migration-status.json's flag was never actually consulted/true).
  describe('engine_dispatch routing (via a throwaway shim standing in for github.sh)', () => {
    const COMMAND = 'auto-fix-all-github';

    /**
     * Build the throwaway wrapper (sources the real engine_dispatch.sh)
     * and throwaway shell-fixture (stands in for github.sh) used by
     * every case below.
     * @param {string} dir - the directory to build the scripts in.
     * @returns {Promise<{wrapperPath: string, fixturePath: string}>} the
     *   two built scripts' paths.
     */
    async function buildDispatchFixtures(dir) {
      const wrapperPath = path.join(dir, 'dispatch-wrapper.sh');
      const fixturePath = path.join(dir, 'fixture-shell-impl.sh');

      await writeFile(
        wrapperPath,
        [
          '#!/usr/bin/env bash',
          'set -euo pipefail',
          `source "${ENGINE_DISPATCH_SCRIPT}"`,
          'REPO_PATH="$1"',
          'COMMAND="$2"',
          'SHELL_SCRIPT="$3"',
          'shift 3',
          'engine_dispatch "$REPO_PATH" "$COMMAND" "$SHELL_SCRIPT" -- "$@"',
          ''
        ].join('\n')
      );
      await writeFile(fixturePath, ['#!/usr/bin/env bash', 'echo "SHELL: $*"', ''].join('\n'));

      return { wrapperPath, fixturePath };
    }

    /**
     * @param {string} repoDir - the (plain, non-git) directory
     *   `engine_dispatch` resolves `engine.mode` against.
     * @param {string} mode - `"shell"` or `"native"`.
     * @returns {Promise<void>} resolves once written.
     */
    async function seedEngineMode(repoDir, mode) {
      const dir = path.join(repoDir, '.claude', 'state');

      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, 'arcanum-config.json'), JSON.stringify({ engine: { mode } }));
    }

    it('routes to the shell fixture when engine.mode=shell', async () => {
      const dir = await createTempDir('arcanum-core-afag-dispatch-');

      try {
        const { wrapperPath, fixturePath } = await buildDispatchFixtures(dir);
        const repoDir = path.join(dir, 'repo');

        await mkdir(repoDir, { recursive: true });
        await seedEngineMode(repoDir, 'shell');

        const result = await runCommand(['bash', wrapperPath, repoDir, COMMAND, fixturePath, repoDir]);

        expect(result.code).toEqual(0);
        expect(result.stdout).toEqual(`SHELL: ${repoDir}\n`);
      } finally {
        await removeTempDir(dir);
      }
    });

    it('routes to core/bin/arcanum when engine.mode=native, given migration-status.json\'s true flag', async () => {
      const dir = await createTempDir('arcanum-core-afag-dispatch-');

      try {
        const { wrapperPath, fixturePath } = await buildDispatchFixtures(dir);
        const repoDir = path.join(dir, 'repo');

        await mkdir(repoDir, { recursive: true });
        await seedEngineMode(repoDir, 'native');

        const result = await runCommand(['bash', wrapperPath, repoDir, COMMAND, fixturePath, repoDir]);

        expect(result.stdout).not.toEqual(`SHELL: ${repoDir}\n`);
        expect(result.stdout).toEqual('');
        expect(result.code).not.toEqual(0);
        expect(result.stderr).not.toContain('no native implementation');
        expect(result.stderr).toContain('unknown command');
      } finally {
        await removeTempDir(dir);
      }
    });
  });
});
