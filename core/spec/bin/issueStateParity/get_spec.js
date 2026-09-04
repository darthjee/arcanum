import { createFixtureRepo, runBoth } from '../../support/factories/issueStateParitySetup.js';
import { removeTempDir } from '../../support/utils/tempDir.js';

// Parity test for the "issue-state" migrated entrypoint (issue #238) —
// see docs/agents/architecture/script-engine.md's "output/exit-code
// contract". Runs arcanum/_lib/issue_state_shell.sh (invoked directly,
// NOT through the arcanum/_lib/issue_state.sh engine_dispatch shim — so
// this test isn't circular) and `core/bin/arcanum issue-state` against
// identical inputs applied to separate (but identically seeded) temp
// repos, asserting byte-identical stdout and exit code.

describe('issue-state parity (shell vs. native) — get', () => {
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

  describe('get on a missing state file', () => {
    it('matches shell stdout and exit code (empty output, exit 0)', async () => {
      const { shell, native } = await runBoth(['get', '42', 'title'], shellRepo, nativeRepo);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('');
    });
  });

  describe('get on a missing field', () => {
    it('matches shell stdout and exit code (empty output, exit 0)', async () => {
      await runBoth(['set', '42', 'state', 'open'], shellRepo, nativeRepo);

      const { shell, native } = await runBoth(['get', '42', 'title'], shellRepo, nativeRepo);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('');
    });
  });

  describe('get on an existing field', () => {
    it('matches shell stdout and exit code', async () => {
      await runBoth(['set', '42', 'title', 'A Title'], shellRepo, nativeRepo);

      const { shell, native } = await runBoth(['get', '42', 'title'], shellRepo, nativeRepo);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('A Title\n');
    });
  });
});
