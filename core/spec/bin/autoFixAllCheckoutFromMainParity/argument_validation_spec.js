import path from 'node:path';
import {
  NATIVE_BIN,
  runCommand,
  SHELL_SCRIPT
} from '../../support/factories/autoFixAllCheckoutFromMainParitySetup.js';
import { createGitFixtureRepo } from '../../support/utils/gitFixtureRepo.js';
import { createTempDir, removeTempDir } from '../../support/utils/tempDir.js';

// Parity test for the "auto-fix-all-checkout-from-main" migrated
// entrypoint (issue #258) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/258-migrate-auto-fix-all-checkout-from-main-entrypoint-to-native-node-js/plan.md's
// "Shared contracts". Runs auto-fix-all/scripts/checkout_from_main.sh
// (directly — the scripter half of this plan, which renames this file to
// checkout_from_main_shell.sh and replaces it with a thin engine_dispatch
// shim, hasn't landed on this branch yet; today's checkout_from_main.sh
// content IS the "straight rename, no behavior change" shell fallback
// plan.md describes, so it's the correct comparison target either way)
// and `core/bin/arcanum auto-fix-all-checkout-from-main` against
// identically-seeded fixture repos, asserting byte-identical stdout and
// exit code for both. This is what proves node/01's `DispatchFailure`
// exit-code generalization actually reaches the real process exit code
// (exit 2 on a merge conflict), not just the thrown object in isolation.
//
// Note: neither the shell script nor the native module redirects/quiets
// `git checkout`/`git merge`'s own porcelain output — e.g. `git checkout
// -b <branch> <remote-ref>` prints a "branch '<branch>' set up to track
// '<remote-ref>'." line to stdout (not stderr), and a failed `git merge
// --no-edit origin/main` prints its own "Auto-merging .../CONFLICT
// .../Automatic merge failed..." lines to stdout too, ahead of the
// conflicted-path list. Both sides forward this porcelain text
// verbatim, so `native.stdout === shell.stdout` below is the real
// parity assertion; the additional `shell.stdout` checks only assert on
// the substantive `BRANCH=`/`STATUS=` contract, not git's exact
// (version-dependent) wording.
describe('auto-fix-all-checkout-from-main parity (shell vs. native) — argument validation', () => {
  describe('missing required args', () => {
    // The empty-leading-arg case is the one intentional stdout-clean
    // divergence from strict stderr parity (see #333 and
    // docs/agents/architecture/script-engine.md's "output/exit-code
    // contract"): the native `context: 'repo'` dispatcher now validates
    // `repoPath` unconditionally, so it rejects with
    // `arcanum: Error: repo_path is required` before the command's own
    // `Usage:` guard runs, whereas the shell script short-circuits with
    // its `Usage:` block. The output/exit-code contract skills rely on —
    // empty stdout, exit 1 — still matches on both sides.
    it('matches exit code and empty stdout for an empty repo_path, with the intentional #333 stderr divergence', async () => {
      const cwd = await createTempDir('arcanum-core-afacfm-parity-');

      try {
        const shell = await runCommand([SHELL_SCRIPT, '', ''], cwd);
        const native = await runCommand(
          [process.execPath, NATIVE_BIN, 'auto-fix-all-checkout-from-main', '', ''],
          cwd
        );

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(1);
        expect(shell.stdout).toEqual('');
        expect(shell.stderr.trim()).toContain('Usage:');
        expect(shell.stderr.trim()).toContain('<repo_path> <id>');
        expect(native.stderr.trim()).toEqual('arcanum: Error: repo_path is required');
      } finally {
        await removeTempDir(cwd);
      }
    });

    it('matches exit code, empty stdout, and the Usage: stderr text for a present repo_path but missing id', async () => {
      const repo = await createGitFixtureRepo();

      try {
        const shell = await runCommand([SHELL_SCRIPT, repo.repoPath, ''], repo.repoPath);
        const native = await runCommand(
          [process.execPath, NATIVE_BIN, 'auto-fix-all-checkout-from-main', repo.repoPath, ''],
          repo.repoPath
        );

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(1);
        expect(shell.stdout).toEqual('');
        expect(shell.stderr.trim()).toContain('Usage:');
        expect(shell.stderr.trim()).toContain('<repo_path> <id>');
        expect(native.stderr.trim()).toContain('Usage:');
        expect(native.stderr.trim()).toContain('<repo_path> <id>');
      } finally {
        await repo.cleanup();
      }
    });
  });

  describe('a present-but-non-directory repo_path', () => {
    it('matches shell exit code and stderr message, with no stdout on either side', async () => {
      const cwd = await createTempDir('arcanum-core-afacfm-parity-');

      try {
        const missingPath = path.join(cwd, 'no-such-dir');
        const shell = await runCommand([SHELL_SCRIPT, missingPath, '42'], cwd);
        const native = await runCommand(
          [process.execPath, NATIVE_BIN, 'auto-fix-all-checkout-from-main', missingPath, '42'],
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
      const cwd = await createTempDir('arcanum-core-afacfm-parity-');

      try {
        const shell = await runCommand([SHELL_SCRIPT, cwd, '42'], cwd);
        const native = await runCommand(
          [process.execPath, NATIVE_BIN, 'auto-fix-all-checkout-from-main', cwd, '42'],
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
});
