import {
  seedGithubLikeRepo,
  seedLocalState,
  SHELL_SCRIPT
} from '../../support/factories/autoFixAllWaitCiAndMergeParitySetup.js';
import { createFakeGhBin } from '../../support/utils/fakeGhBin.js';
import { createGitFixtureRepo } from '../../support/utils/gitFixtureRepo.js';
import { FAKE_FETCH_PRELOAD, NATIVE_BIN, runCommand } from '../../support/utils/runCommand.js';

const MODEL_EMAIL = 'model@example.com';

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
// byte-identical stdout and exit code.
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
//
// This file covers the CI-outcome scenarios — CI passes and the merge
// succeeds, and CI fails without attempting a merge. See
// preconditions_spec.js for the precondition/validation failures, and
// engine_dispatch_spec.js for the real wait_ci_and_merge.sh shim
// routing tests.
describe('auto-fix-all-wait-ci-and-merge parity (shell vs. native) — ci outcomes', () => {
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
});
