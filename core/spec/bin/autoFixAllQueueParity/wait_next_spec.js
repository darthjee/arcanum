import { runPair, seedQueue } from '../../support/factories/queueParitySetup.js';
import { expectParity } from '../../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../../support/utils/tempDir.js';

// Parity test for the "auto-fix-all-queue-wait-next" migrated
// entrypoint (issue #264) — see
// docs/agents/architecture/script-engine.md's "output/exit-code
// contract" and
// docs/agents/plans/264-migrate-auto-fix-all-queue-entrypoint-save-next-wait-next-push-pop-empty-list-to-native-node-js/node.md's
// "Shared contracts". Runs
// auto-fix-all/scripts/queue_wait_next_shell.sh (invoked directly, NOT
// through the auto-fix-all/scripts/queue.sh engine_dispatch shim — so
// this isn't circular) and `core/bin/arcanum
// auto-fix-all-queue-wait-next` against identically-seeded fixture
// state, asserting byte-identical stdout and exit code for both.
// `wait-next` is pure local file I/O (no `gh`/network touchpoint at
// all), so its fixtures are plain (non-git) temp dirs.
//
// `wait-next` polls forever (a 5s `sleep` between attempts) on an
// empty queue — the scenario below seeds the queue non-empty up
// front, so both implementations resolve on their very first check
// (no real 5s wait, no hang), same testing concern already solved by
// autoFixAllWaitCiParity_spec.js.
describe('auto-fix-all-queue-* parity (shell vs. native) — wait-next', () => {
  it('matches shell output when the queue is already non-empty (resolves on the first check)', async () => {
    const shellRepo = await createTempDir('arcanum-core-afaq-parity-shell-');
    const nativeRepo = await createTempDir('arcanum-core-afaq-parity-native-');

    try {
      await Promise.all([seedQueue(shellRepo, ['7']), seedQueue(nativeRepo, ['7'])]);

      const { shell, native } = await runPair('wait-next', shellRepo, nativeRepo, []);

      expectParity(shell, native);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('7\n');
    } finally {
      await Promise.all([removeTempDir(shellRepo), removeTempDir(nativeRepo)]);
    }
  });
});
