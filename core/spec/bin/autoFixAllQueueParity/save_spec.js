import { runPair, setupParityTest } from '../../support/factories/queueParitySetup.js';
import { expectParity } from '../../support/utils/runCommand.js';

// Parity test for the "auto-fix-all-queue-save" migrated entrypoint
// (issue #264) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/264-migrate-auto-fix-all-queue-entrypoint-save-next-wait-next-push-pop-empty-list-to-native-node-js/node.md's
// "Shared contracts". Runs
// auto-fix-all/scripts/queue_save_shell.sh (invoked directly, NOT
// through the auto-fix-all/scripts/queue.sh engine_dispatch shim — so
// this isn't circular) and `core/bin/arcanum auto-fix-all-queue-save`
// against identically-seeded fixture state, asserting byte-identical
// stdout and exit code for both.
//
// `save` best-effort tag-mutates the affected GitHub issues, so — per
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
describe('auto-fix-all-queue-* parity (shell vs. native) — save', () => {
  it('rejects with the same exit code and empty stdout when no ids are given', async () => {
    const ctx = await setupParityTest();

    try {
      const env = { PATH: `${ctx.fakeGh.binDir}:${process.env.PATH}` };
      const { shell, native } = await runPair('save', ctx.shellRepo.repoPath, ctx.nativeRepo.repoPath, [], { env });

      expectParity(shell, native);
      expect(shell.code).not.toEqual(0);
      expect(shell.stdout).toEqual('');
    } finally {
      await ctx.cleanup();
    }
  });

  it('matches shell output/exit code for a successful save, with the label mutation succeeding', async () => {
    const ctx = await setupParityTest();

    try {
      const env = {
        PATH: `${ctx.fakeGh.binDir}:${process.env.PATH}`,
        FAKE_GH_ISSUE_LABELS: '',
        FAKE_FETCH_ISSUE_LABELS: ''
      };
      const { shell, native } = await runPair('save', ctx.shellRepo.repoPath, ctx.nativeRepo.repoPath, ['10', '20'], {
        env,
        fakeFetch: true
      });

      expectParity(shell, native);
      expect(shell.code).toEqual(0);
      // `tag_mutate_add_label`/`tag_mutate_remove_label` (and their
      // native `_mutateTag` counterpart) print their own per-tag
      // success/no-op line to stdout, after the `Queue saved: ...`
      // confirmation — see AutoFixAllQueue.js#_mutateTag's doc comment.
      expect(shell.stdout).toEqual(
        'Queue saved: 10 20\n' +
        'Added tag \'enqueued\' to issue #10 on darthjee/arcanum-queue-fixture\n' +
        'Tag \'ready_for_work\' not present on issue #10 — nothing to do.\n' +
        'Tag \'created\' not present on issue #10 — nothing to do.\n' +
        'Added tag \'enqueued\' to issue #20 on darthjee/arcanum-queue-fixture\n' +
        'Tag \'ready_for_work\' not present on issue #20 — nothing to do.\n' +
        'Tag \'created\' not present on issue #20 — nothing to do.\n'
      );
    } finally {
      await ctx.cleanup();
    }
  });

  it('matches shell output/exit code even when the label mutation fails entirely (best-effort)', async () => {
    const ctx = await setupParityTest();

    try {
      const env = {
        PATH: `${ctx.fakeGh.binDir}:${process.env.PATH}`,
        FAKE_GH_ISSUE_VIEW_FAIL: '1',
        FAKE_FETCH_ISSUE_VIEW_FAIL: '1'
      };
      const { shell, native } = await runPair('save', ctx.shellRepo.repoPath, ctx.nativeRepo.repoPath, ['10'], {
        env,
        fakeFetch: true
      });

      expectParity(shell, native);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('Queue saved: 10\n');
    } finally {
      await ctx.cleanup();
    }
  });
});
