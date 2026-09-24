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

// Each shell/native write acquires the issue-state lock, which sleeps a
// real 1 second per acquisition (see docs/agents/architecture/lock-system.md),
// so these specs get a generous timeout rather than Jasmine's 5000ms default
// to avoid flaking on slower CI runners.
const LOCKED_WRITE_TIMEOUT_MS = 30000;

describe('issue-state parity (shell vs. native) — set-json', () => {
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

  describe('set-json with an object value', () => {
    it('produces byte-identical resulting state-file content, stdout, and exit code', async () => {
      const { shell, native } = await runBoth(['set-json', '42', 'meta', '{"priority":"high"}'], shellRepo, nativeRepo);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);

      await assertStateFilesMatch('42', shellRepo, nativeRepo);
    }, LOCKED_WRITE_TIMEOUT_MS);
  });

  describe('set-json with an array value', () => {
    it('produces byte-identical resulting state-file content, stdout, and exit code', async () => {
      const { shell, native } = await runBoth(['set-json', '42', 'tags', '["a","b"]'], shellRepo, nativeRepo);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);

      await assertStateFilesMatch('42', shellRepo, nativeRepo);
    }, LOCKED_WRITE_TIMEOUT_MS);
  });
});
