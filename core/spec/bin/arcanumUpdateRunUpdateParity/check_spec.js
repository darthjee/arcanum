import {
  createGitFixture,
  createZipFixture,
  runPair
} from '../../support/factories/arcanumUpdateRunUpdateParitySetup.js';
import { createTempDir, removeTempDir } from '../../support/utils/tempDir.js';

// Parity test for the "arcanum-update-run-update-check" migrated
// entrypoint (issue #263) — see
// docs/agents/architecture/script-engine.md's "output/exit-code
// contract" and
// docs/agents/plans/263-migrate-arcanum-update-run-update-entrypoint-check-apply-to-native-node-js/plan.md's
// "Shared contracts". Runs
// arcanum-update/scripts/run_update_check_shell.sh directly (NOT
// through run_update.sh's engine_dispatch shim, so this isn't circular)
// and `core/bin/arcanum arcanum-update-run-update-check` against
// identically-seeded fixture arcanum installs, asserting byte-identical
// stdout and exit code.
//
// This file covers the `check` subcommand's scenarios. See
// apply_spec.js for the `apply` subcommand's scenarios.
describe('arcanum-update-run-update-check/-apply parity (shell vs. native) — check', () => {
  it('matches shell output for the zip method', async () => {
    const dir = await createZipFixture('arcanum-core-aurru-parity-check-zip-', {
      repo: 'darthjee/arcanum-fixture',
      version: '1.0.0'
    });

    try {
      const { shell, native } = await runPair('check', dir, dir);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual(`METHOD=zip\nREPO=darthjee/arcanum-fixture\nCURRENT=1.0.0\nTARGET=${dir}\n`);
    } finally {
      await removeTempDir(dir);
    }
  });

  it('matches shell output for the git method with an exact tag on HEAD', async () => {
    const dir = await createGitFixture('arcanum-core-aurru-parity-check-git-tagged-', { tagged: true });

    try {
      const { shell, native } = await runPair('check', dir, dir);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual(
        `METHOD=git\nREPO=darthjee/arcanum-fixture\nCURRENT=v1.0.0\nTARGET=${dir}\n`
      );
    } finally {
      await removeTempDir(dir);
    }
  });

  it('matches shell output for the git method falling back to the short commit hash', async () => {
    const dir = await createGitFixture('arcanum-core-aurru-parity-check-git-untagged-', { tagged: false });

    try {
      const { shell, native } = await runPair('check', dir, dir);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toMatch(
        new RegExp(`^METHOD=git\\nREPO=darthjee/arcanum-fixture\\nCURRENT=[0-9a-f]{7,}\\nTARGET=${dir}\\n$`)
      );
    } finally {
      await removeTempDir(dir);
    }
  });

  it('matches shell output (STATUS=missing_arcanum, exit 1) when bootstrap.sh is absent', async () => {
    const dir = await createTempDir('arcanum-core-aurru-parity-check-missing-');

    try {
      const { shell, native } = await runPair('check', dir, dir);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(1);
      expect(shell.stdout).toEqual('STATUS=missing_arcanum\n');
    } finally {
      await removeTempDir(dir);
    }
  });
});
