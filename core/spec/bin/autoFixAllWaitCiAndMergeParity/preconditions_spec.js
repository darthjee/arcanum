import { SHELL_SCRIPT } from '../../support/factories/autoFixAllWaitCiAndMergeParitySetup.js';
import { itRejectsInvalidRepoPath } from '../../support/sharedExamples/cliParityValidation.js';
import { NATIVE_BIN, runCommand } from '../../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../../support/utils/tempDir.js';

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
// This file covers the precondition/validation failures — a missing
// argument, a non-directory repo_path, and a non-git repo_path. See
// ci_outcomes_spec.js for the passing/failing CI-outcome scenarios,
// and engine_dispatch_spec.js for the real wait_ci_and_merge.sh shim
// routing tests.
describe('auto-fix-all-wait-ci-and-merge parity (shell vs. native) — preconditions', () => {
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

  // `wait_ci_and_merge_shell.sh` composes the `wait_ci.sh` /
  // `github.sh pr-merge` shims rather than calling `repo_path_enter`
  // itself, so its own stderr wording for a bad `repo_path` isn't
  // byte-identical to the native dispatcher's — only the stdout /
  // exit-code contract (empty stdout, non-zero exit, matching codes) is,
  // which is what's asserted here (`assertShellStderr: false`).
  itRejectsInvalidRepoPath(
    async (repoPath, cwd) => {
      const shell = await runCommand([SHELL_SCRIPT, repoPath, MODEL_EMAIL], cwd);
      const native = await runCommand(
        [process.execPath, NATIVE_BIN, 'auto-fix-all-wait-ci-and-merge', repoPath, MODEL_EMAIL],
        cwd
      );

      return { shell, native };
    },
    {
      notDirectoryDescribe: 'a present-but-non-directory repo_path',
      notGitRepoDescribe: 'a non-git repo_path',
      itDescription: 'matches shell exit code, with no stdout on either side',
      assertShellStderr: false,
      cwdPrefix: 'arcanum-core-afawcam-parity-'
    }
  );
});
