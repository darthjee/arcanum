import {
  createGitFixture,
  createZipFixture,
  runPair
} from '../../support/factories/arcanumUpdateRunUpdateParitySetup.js';
import { itMatchesParity } from '../../support/sharedExamples/arcanumUpdateRunUpdateParity.js';
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
  {
    let dir;

    itMatchesParity(
      'matches shell output for the zip method',
      async () => {
        dir = await createZipFixture('arcanum-core-aurru-parity-check-zip-', {
          repo: 'darthjee/arcanum-fixture',
          version: '1.0.0'
        });

        const { shell, native } = await runPair('check', dir, dir);

        return { shell, native, cleanup: () => removeTempDir(dir) };
      },
      { code: 0, get stdout() { return `METHOD=zip\nREPO=darthjee/arcanum-fixture\nCURRENT=1.0.0\nTARGET=${dir}\n`; } }
    );
  }

  {
    let dir;

    itMatchesParity(
      'matches shell output for the git method with an exact tag on HEAD',
      async () => {
        dir = await createGitFixture('arcanum-core-aurru-parity-check-git-tagged-', { tagged: true });

        const { shell, native } = await runPair('check', dir, dir);

        return { shell, native, cleanup: () => removeTempDir(dir) };
      },
      { code: 0, get stdout() { return `METHOD=git\nREPO=darthjee/arcanum-fixture\nCURRENT=v1.0.0\nTARGET=${dir}\n`; } }
    );
  }

  {
    let dir;

    itMatchesParity(
      'matches shell output for the git method falling back to the short commit hash',
      async () => {
        dir = await createGitFixture('arcanum-core-aurru-parity-check-git-untagged-', { tagged: false });

        const { shell, native } = await runPair('check', dir, dir);

        return { shell, native, cleanup: () => removeTempDir(dir) };
      },
      {
        code: 0,
        get stdout() {
          return new RegExp(`^METHOD=git\\nREPO=darthjee/arcanum-fixture\\nCURRENT=[0-9a-f]{7,}\\nTARGET=${dir}\\n$`);
        }
      }
    );
  }

  {
    let dir;

    itMatchesParity(
      'matches shell output (STATUS=missing_arcanum, exit 1) when bootstrap.sh is absent',
      async () => {
        dir = await createTempDir('arcanum-core-aurru-parity-check-missing-');

        const { shell, native } = await runPair('check', dir, dir);

        return { shell, native, cleanup: () => removeTempDir(dir) };
      },
      { code: 1, stdout: 'STATUS=missing_arcanum\n' }
    );
  }
});
