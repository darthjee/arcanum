import { itMatchesShellForQueueOp } from '../../support/sharedExamples/queueParitySharedExamples.js';

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
  itMatchesShellForQueueOp('matches shell output for a non-empty queue', {
    op: 'list',
    seed: ['a', 'b', 'c'],
    expectedCode: 0,
    expectedStdout: 'a\nb\nc\n'
  });

  itMatchesShellForQueueOp('matches shell output ("(empty)") for a zero-length queue', {
    op: 'list',
    seed: [],
    expectedCode: 0,
    expectedStdout: '(empty)\n'
  });
});
