import { NON_ZERO, itMatchesShellForQueueOp } from '../../support/sharedExamples/queueParitySharedExamples.js';

const LABELS_ENV = {
  FAKE_GH_ISSUE_LABELS: 'Ready for Work',
  FAKE_FETCH_ISSUE_LABELS: 'Ready for Work'
};

// Parity test for the "auto-fix-all-queue-push" migrated entrypoint
// (issue #264) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/264-migrate-auto-fix-all-queue-entrypoint-save-next-wait-next-push-pop-empty-list-to-native-node-js/node.md's
// "Shared contracts". Runs
// auto-fix-all/scripts/queue_push_shell.sh (invoked directly, NOT
// through the auto-fix-all/scripts/queue.sh engine_dispatch shim — so
// this isn't circular) and `core/bin/arcanum auto-fix-all-queue-push`
// against identically-seeded fixture state, asserting byte-identical
// stdout and exit code for both.
//
// `push` best-effort tag-mutates the affected GitHub issues, so — per
// the repo-wide "no real network calls in specs" rule — its fixtures
// are git repos with a github.com-shaped `origin` (so
// `Origin.js`/`origin.sh` can resolve `{ domain, repo }`), and both
// `gh` (shell side) and `fetch` (native side) are replaced:
//   - `gh` itself is replaced (via a `PATH`-prepended fake binary, see
//     fakeGhBin.js) for both sides — the shell script's `gh issue
//     view`/`gh issue edit` calls and the native side's
//     `GithubToken#get`'s `gh auth token` call.
//   - the native side's raw `fetch` calls to `api.github.com` are
//     replaced by preloading fakeGithubApiFetchPreload.js's `queue`
//     mode via `node --import` (monkey-patches the global `fetch`
//     before `core/bin/arcanum` is ever imported).
//
// None of this touches the real network at any point.
describe('auto-fix-all-queue-* parity (shell vs. native) — push', () => {
  itMatchesShellForQueueOp('rejects with the same exit code and empty stdout when no ids are given', {
    op: 'push',
    github: true,
    seed: ['existing'],
    expectedCode: NON_ZERO,
    expectedStdout: ''
  });

  itMatchesShellForQueueOp('matches shell output/exit code for a successful push, appending to the existing queue', {
    op: 'push',
    github: true,
    seed: ['existing'],
    args: ['30'],
    env: LABELS_ENV,
    fakeFetch: true,
    expectedCode: 0,
    // See the equivalent `save` test's comment: the label mutation's
    // own per-tag stdout lines follow the `Pushed: ...` confirmation.
    expectedStdout:
      'Pushed: 30\n' +
      'Added tag \'enqueued\' to issue #30 on darthjee/arcanum-queue-fixture\n' +
      'Removed tag \'ready_for_work\' from issue #30 on darthjee/arcanum-queue-fixture\n' +
      'Tag \'created\' not present on issue #30 — nothing to do.\n',
    followUp: { op: 'list', expectedStdout: 'existing\n30\n' }
  });

  itMatchesShellForQueueOp('matches shell output/exit code when a label mutation\'s own gh/fetch update call fails (best-effort)', {
    op: 'push',
    github: true,
    seed: ['existing'],
    args: ['30'],
    env: { FAKE_GH_ISSUE_EDIT_FAIL: '1', FAKE_FETCH_ISSUE_EDIT_FAIL: '1', ...LABELS_ENV },
    fakeFetch: true,
    expectedCode: 0,
    // Both the `enqueued` add and the `ready_for_work` remove reach
    // (and fail at) the `gh issue edit`/`PATCH` update call, so only
    // stderr gets their failure messages; the `created` remove is a
    // no-op (label never present) and never reaches that call, so its
    // "nothing to do" line still lands on stdout.
    expectedStdout:
      'Pushed: 30\n' +
      'Tag \'created\' not present on issue #30 — nothing to do.\n'
  });
});
