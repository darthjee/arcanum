import path from 'node:path';
import { seedGithubLikeRepo, SHELL_SCRIPT } from '../../support/factories/autoFixAllWaitCiParitySetup.js';
import { createFakeGhBin } from '../../support/utils/fakeGhBin.js';
import { createGitFixtureRepo } from '../../support/utils/gitFixtureRepo.js';
import { FAKE_FETCH_PRELOAD, NATIVE_BIN, runCommand } from '../../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../../support/utils/tempDir.js';

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
// This file covers the precondition/validation failures — a missing
// argument, a non-directory repo_path, a non-git repo_path, and no
// pull request found for the current branch. See ci_outcomes_spec.js
// for the passing/failing/ignored-pattern CI-outcome scenarios, and
// engine_dispatch_spec.js for the real wait_ci.sh shim routing tests.
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

  describe('a present-but-non-directory repo_path', () => {
    it('matches shell exit code and stderr message, with no stdout on either side', async () => {
      const cwd = await createTempDir('arcanum-core-afawc-parity-');

      try {
        const missingPath = path.join(cwd, 'no-such-dir');
        const shell = await runCommand([SHELL_SCRIPT, missingPath], cwd);
        const native = await runCommand(
          [process.execPath, NATIVE_BIN, 'auto-fix-all-wait-ci', missingPath],
          cwd
        );

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
        expect(shell.stderr.trim()).toEqual(`Error: not a directory: ${missingPath}`);
        expect(native.stderr.trim()).toContain(`Error: not a directory: ${missingPath}`);
      } finally {
        await removeTempDir(cwd);
      }
    });
  });

  describe('a non-git repo_path', () => {
    it('matches shell exit code and stderr message, with no stdout on either side', async () => {
      const cwd = await createTempDir('arcanum-core-afawc-parity-');

      try {
        const shell = await runCommand([SHELL_SCRIPT, cwd], cwd);
        const native = await runCommand(
          [process.execPath, NATIVE_BIN, 'auto-fix-all-wait-ci', cwd],
          cwd
        );

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
        expect(shell.stderr.trim()).toEqual(`Error: not a git repository: ${cwd}`);
        expect(native.stderr.trim()).toContain(`Error: not a git repository: ${cwd}`);
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
});
