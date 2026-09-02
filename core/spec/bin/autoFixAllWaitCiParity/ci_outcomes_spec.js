import {
  seedGithubLikeRepo,
  seedIgnoredCheckPatterns,
  SHELL_SCRIPT
} from '../../support/factories/autoFixAllWaitCiParitySetup.js';
import { createFakeGhBin } from '../../support/utils/fakeGhBin.js';
import { createGitFixtureRepo } from '../../support/utils/gitFixtureRepo.js';
import { FAKE_FETCH_PRELOAD, NATIVE_BIN, runCommand } from '../../support/utils/runCommand.js';

// Parity test for the "auto-fix-all-wait-ci" migrated entrypoint (issue
// #262) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/262-migrate-auto-fix-all-wait-ci-entrypoint-to-native-node-js/node.md.
// Runs auto-fix-all/scripts/wait_ci_shell.sh (invoked directly, NOT
// through the auto-fix-all/scripts/wait_ci.sh engine_dispatch shim — so
// this test isn't circular, same convention as every other sibling
// parity spec) and `core/bin/arcanum auto-fix-all-wait-ci` against
// equivalent inputs, asserting byte-identical stdout and exit code.
//
// This file covers the CI-outcome accounting scenarios — a passing PR,
// a failing PR, and a PR with an ignored-pattern check-run alongside a
// real one. See preconditions_spec.js for the precondition/validation
// failure scenarios, and engine_dispatch_spec.js for the real
// wait_ci.sh shim routing tests.
describe('auto-fix-all-wait-ci parity (shell vs. native)', () => {
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
});
