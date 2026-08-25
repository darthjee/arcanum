import { runPair, seedQueue } from '../../support/factories/queueParitySetup.js';
import { expectParity } from '../../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../../support/utils/tempDir.js';

// Parity test for the "auto-fix-all-queue-list" migrated entrypoint
// (issue #264) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/264-migrate-auto-fix-all-queue-entrypoint-save-next-wait-next-push-pop-empty-list-to-native-node-js/node.md's
// "Shared contracts". Runs
// auto-fix-all/scripts/queue_list_shell.sh (invoked directly, NOT
// through the auto-fix-all/scripts/queue.sh engine_dispatch shim — so
// this isn't circular) and `core/bin/arcanum auto-fix-all-queue-list`
// against identically-seeded fixture state, asserting byte-identical
// stdout and exit code for both. `list` is pure local file I/O (no
// `gh`/network touchpoint at all), so its fixtures are plain (non-git)
// temp dirs.
describe('auto-fix-all-queue-* parity (shell vs. native) — list', () => {
  it('matches shell output for a non-empty queue', async () => {
    const shellRepo = await createTempDir('arcanum-core-afaq-parity-shell-');
    const nativeRepo = await createTempDir('arcanum-core-afaq-parity-native-');

    try {
      await Promise.all([seedQueue(shellRepo, ['a', 'b', 'c']), seedQueue(nativeRepo, ['a', 'b', 'c'])]);

      const { shell, native } = await runPair('list', shellRepo, nativeRepo, []);

      expectParity(shell, native);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('a\nb\nc\n');
    } finally {
      await Promise.all([removeTempDir(shellRepo), removeTempDir(nativeRepo)]);
    }
  });

  it('matches shell output ("(empty)") for a zero-length queue', async () => {
    const shellRepo = await createTempDir('arcanum-core-afaq-parity-shell-');
    const nativeRepo = await createTempDir('arcanum-core-afaq-parity-native-');

    try {
      await Promise.all([seedQueue(shellRepo, []), seedQueue(nativeRepo, [])]);

      const { shell, native } = await runPair('list', shellRepo, nativeRepo, []);

      expectParity(shell, native);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('(empty)\n');
    } finally {
      await Promise.all([removeTempDir(shellRepo), removeTempDir(nativeRepo)]);
    }
  });
});
