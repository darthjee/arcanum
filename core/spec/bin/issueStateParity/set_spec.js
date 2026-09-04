import { assertStateFilesMatch, createFixtureRepo, runBoth } from '../../support/factories/issueStateParitySetup.js';
import { removeTempDir } from '../../support/utils/tempDir.js';

// Parity test for the "issue-state" migrated entrypoint (issue #238) —
// see docs/agents/architecture/script-engine.md's "output/exit-code
// contract". Runs arcanum/_lib/issue_state_shell.sh (invoked directly,
// NOT through the arcanum/_lib/issue_state.sh engine_dispatch shim — so
// this test isn't circular) and `core/bin/arcanum issue-state` against
// identical inputs applied to separate (but identically seeded) temp
// repos, asserting byte-identical stdout, exit code, and resulting
// `.claude/state/issue-<id>.json` content.

describe('issue-state parity (shell vs. native) — set', () => {
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

  describe('set creating a new field', () => {
    it('produces byte-identical resulting state-file content, stdout, and exit code', async () => {
      const { shell, native } = await runBoth(['set', '42', 'title', 'A Title'], shellRepo, nativeRepo);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('');

      await assertStateFilesMatch('42', shellRepo, nativeRepo);
    });
  });

  describe('set overwriting an existing field', () => {
    it('produces byte-identical resulting state-file content, stdout, and exit code', async () => {
      await runBoth(['set', '42', 'title', 'First'], shellRepo, nativeRepo);

      const { shell, native } = await runBoth(['set', '42', 'title', 'Second'], shellRepo, nativeRepo);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);

      await assertStateFilesMatch('42', shellRepo, nativeRepo);
    });
  });
});
