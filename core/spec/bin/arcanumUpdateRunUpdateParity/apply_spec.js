import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  createZipFixture,
  NATIVE_BIN,
  NATIVE_COMMANDS,
  runCommand,
  runPair,
  SHELL_SCRIPTS
} from '../../support/factories/arcanumUpdateRunUpdateParitySetup.js';
import { createTempDir, removeTempDir } from '../../support/utils/tempDir.js';

// Parity test for the "arcanum-update-run-update-apply" migrated
// entrypoint (issue #263) — see
// docs/agents/architecture/script-engine.md's "output/exit-code
// contract" and
// docs/agents/plans/263-migrate-arcanum-update-run-update-entrypoint-check-apply-to-native-node-js/plan.md's
// "Shared contracts". Runs
// arcanum-update/scripts/run_update_apply_shell.sh directly (NOT
// through run_update.sh's engine_dispatch shim, so this isn't circular)
// and `core/bin/arcanum arcanum-update-run-update-apply` against
// identically-seeded fixture arcanum installs, asserting byte-identical
// stdout and exit code. Fixtures use a deterministic stub
// arcanum/update/bootstrap.sh (see
// core/spec/support/fixtures/arcanum_update_bootstrap_stub.sh) instead
// of the real one, so no real network install is ever attempted.
//
// This file covers the `apply` subcommand's scenarios. See
// check_spec.js for the `check` subcommand's scenarios.
describe('arcanum-update-run-update-check/-apply parity (shell vs. native) — apply', () => {
  it('matches shell output (RESULT=updated) when bootstrap.sh bumps the version', async () => {
    const shellDir = await createZipFixture('arcanum-core-aurru-parity-apply-shell-', { version: '1.0.0' });
    const nativeDir = await createZipFixture('arcanum-core-aurru-parity-apply-native-', { version: '1.0.0' });

    try {
      await writeFile(path.join(shellDir, '.fixture-new-version'), '1.1.0');
      await writeFile(path.join(nativeDir, '.fixture-new-version'), '1.1.0');

      const shell = await runCommand([SHELL_SCRIPTS.apply, shellDir], shellDir);
      const native = await runCommand(
        [process.execPath, NATIVE_BIN, NATIVE_COMMANDS.apply, nativeDir],
        nativeDir
      );

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('bootstrap: starting\nbootstrap: done\nRESULT=updated FROM=1.0.0 TO=1.1.0\n');
    } finally {
      await removeTempDir(shellDir);
      await removeTempDir(nativeDir);
    }
  });

  it('matches shell output (RESULT=noop) when bootstrap.sh does not change the version', async () => {
    const shellDir = await createZipFixture('arcanum-core-aurru-parity-apply-shell-noop-', { version: '1.0.0' });
    const nativeDir = await createZipFixture('arcanum-core-aurru-parity-apply-native-noop-', { version: '1.0.0' });

    try {
      const shell = await runCommand([SHELL_SCRIPTS.apply, shellDir], shellDir);
      const native = await runCommand(
        [process.execPath, NATIVE_BIN, NATIVE_COMMANDS.apply, nativeDir],
        nativeDir
      );

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('bootstrap: starting\nbootstrap: done\nRESULT=noop VERSION=1.0.0\n');
    } finally {
      await removeTempDir(shellDir);
      await removeTempDir(nativeDir);
    }
  });

  it('matches shell output and exit code when bootstrap.sh fails, printing nothing further', async () => {
    const shellDir = await createZipFixture('arcanum-core-aurru-parity-apply-shell-fail-', { version: '1.0.0' });
    const nativeDir = await createZipFixture('arcanum-core-aurru-parity-apply-native-fail-', { version: '1.0.0' });

    try {
      await writeFile(path.join(shellDir, '.fixture-fail'), '9');
      await writeFile(path.join(nativeDir, '.fixture-fail'), '9');

      const shell = await runCommand([SHELL_SCRIPTS.apply, shellDir], shellDir);
      const native = await runCommand(
        [process.execPath, NATIVE_BIN, NATIVE_COMMANDS.apply, nativeDir],
        nativeDir
      );

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(9);
      expect(shell.stdout).toEqual('bootstrap: starting\n');
    } finally {
      await removeTempDir(shellDir);
      await removeTempDir(nativeDir);
    }
  });

  it('matches shell output (STATUS=missing_arcanum, exit 1) when bootstrap.sh is absent', async () => {
    const dir = await createTempDir('arcanum-core-aurru-parity-apply-missing-');

    try {
      const { shell, native } = await runPair('apply', dir, dir);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(1);
      expect(shell.stdout).toEqual('STATUS=missing_arcanum\n');
    } finally {
      await removeTempDir(dir);
    }
  });
});
