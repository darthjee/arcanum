import { itMatchesShellForQueueOp } from '../../support/sharedExamples/queueParitySharedExamples.js';

// Parity test for the "auto-fix-all-queue-pop" migrated entrypoint
// (issue #264) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/264-migrate-auto-fix-all-queue-entrypoint-save-next-wait-next-push-pop-empty-list-to-native-node-js/node.md's
// "Shared contracts". Runs
// auto-fix-all/scripts/queue_pop_shell.sh (invoked directly, NOT
// through the auto-fix-all/scripts/queue.sh engine_dispatch shim — so
// this isn't circular) and `core/bin/arcanum auto-fix-all-queue-pop`
// against identically-seeded fixture state, asserting byte-identical
// stdout and exit code for both. `pop` is pure local file I/O (no
// `gh`/network touchpoint at all), so its fixtures are plain (non-git)
// temp dirs.
describe('auto-fix-all-queue-* parity (shell vs. native) — pop', () => {
  itMatchesShellForQueueOp('matches shell output (exit 0, empty stdout) removing the first entry', {
    op: 'pop',
    seed: ['a', 'b'],
    expectedCode: 0,
    expectedStdout: '',
    followUp: { op: 'next', expectedStdout: 'b\n' }
  });
});
