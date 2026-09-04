import path from 'node:path';
import {
  createFixtureRepo,
  NATIVE_BIN,
  runBoth,
  runCommand,
  SHELL_SCRIPT
} from '../../support/factories/issueStateParitySetup.js';
import { createTempDir, removeTempDir } from '../../support/utils/tempDir.js';

// Parity test for the "issue-state" migrated entrypoint (issue #238) —
// see docs/agents/architecture/script-engine.md's "output/exit-code
// contract". Runs arcanum/_lib/issue_state_shell.sh (invoked directly,
// NOT through the arcanum/_lib/issue_state.sh engine_dispatch shim — so
// this test isn't circular) and `core/bin/arcanum issue-state` against
// identical inputs applied to separate (but identically seeded) temp
// repos, asserting byte-identical stdout and exit code.

describe('issue-state parity (shell vs. native) — argument validation', () => {
  let shellRepo;
  let nativeRepo;

  beforeEach(async () => {
    shellRepo = await createFixtureRepo('arcanum-core-is-parity-shell-');
    nativeRepo = await createFixtureRepo('arcanum-core-is-parity-native-');
  });

  afterEach(async () => {
    await removeTempDir(shellRepo);
    await removeTempDir(nativeRepo);
  });

  describe('missing required args', () => {
    it('matches exit code and empty stdout, with the substantive usage text in stderr', async () => {
      const shell = await runCommand([SHELL_SCRIPT, shellRepo], shellRepo);
      const native = await runCommand([process.execPath, NATIVE_BIN, 'issue-state', nativeRepo], nativeRepo);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(1);
      expect(shell.stdout).toEqual('');
      expect(shell.stderr.trim()).toContain('Usage:');
      expect(shell.stderr.trim()).toContain('<repo_path> get <id> <field>');
      expect(native.stderr.trim()).toContain('Usage:');
      expect(native.stderr.trim()).toContain('<repo_path> get <id> <field>');
    });
  });

  describe('an unknown subcommand', () => {
    it('matches exit code and empty stdout, with the "Unknown command" text in stderr', async () => {
      const { shell, native } = await runBoth(['bogus', '42', 'title'], shellRepo, nativeRepo);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(1);
      expect(shell.stdout).toEqual('');
      expect(shell.stderr.trim()).toContain('Unknown command: bogus');
      expect(native.stderr.trim()).toContain('Unknown command: bogus');
    });
  });

  describe('a present-but-non-directory repo_path', () => {
    it('matches shell exit code and stderr message, with no stdout on either side', async () => {
      const missingShell = path.join(shellRepo, 'no-such-dir');
      const missingNative = path.join(nativeRepo, 'no-such-dir');
      const shell = await runCommand([SHELL_SCRIPT, missingShell, 'get', '42', 'title'], shellRepo);
      const native = await runCommand(
        [process.execPath, NATIVE_BIN, 'issue-state', missingNative, 'get', '42', 'title'],
        nativeRepo
      );

      expect(shell.stdout).toEqual('');
      expect(native.stdout).toEqual('');
      expect(native.code).toEqual(shell.code);
      expect(shell.code).not.toEqual(0);
      expect(shell.stderr.trim()).toEqual(`Error: not a directory: ${missingShell}`);
      expect(native.stderr.trim()).toContain(`Error: not a directory: ${missingNative}`);
    });
  });

  describe('a non-git repo_path', () => {
    it('matches shell exit code and stderr message, with no stdout on either side', async () => {
      const nonGit = await createTempDir('arcanum-core-is-parity-nongit-');

      try {
        const shell = await runCommand([SHELL_SCRIPT, nonGit, 'get', '42', 'title'], shellRepo);
        const native = await runCommand(
          [process.execPath, NATIVE_BIN, 'issue-state', nonGit, 'get', '42', 'title'],
          nativeRepo
        );

        expect(shell.stdout).toEqual('');
        expect(native.stdout).toEqual('');
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stderr.trim()).toEqual(`Error: not a git repository: ${nonGit}`);
        expect(native.stderr.trim()).toContain(`Error: not a git repository: ${nonGit}`);
      } finally {
        await removeTempDir(nonGit);
      }
    });
  });
});
