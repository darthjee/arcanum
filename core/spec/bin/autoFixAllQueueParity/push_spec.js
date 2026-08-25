import { runPair, seedQueue, setupParityTest } from '../../support/factories/queueParitySetup.js';
import { expectParity } from '../../support/utils/runCommand.js';

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
  it('rejects with the same exit code and empty stdout when no ids are given', async () => {
    const ctx = await setupParityTest();

    try {
      await Promise.all([
        seedQueue(ctx.shellRepo.repoPath, ['existing']),
        seedQueue(ctx.nativeRepo.repoPath, ['existing'])
      ]);

      const env = { PATH: `${ctx.fakeGh.binDir}:${process.env.PATH}` };
      const { shell, native } = await runPair('push', ctx.shellRepo.repoPath, ctx.nativeRepo.repoPath, [], { env });

      expectParity(shell, native);
      expect(shell.code).not.toEqual(0);
      expect(shell.stdout).toEqual('');
    } finally {
      await ctx.cleanup();
    }
  });

  it('matches shell output/exit code for a successful push, appending to the existing queue', async () => {
    const ctx = await setupParityTest();

    try {
      await Promise.all([
        seedQueue(ctx.shellRepo.repoPath, ['existing']),
        seedQueue(ctx.nativeRepo.repoPath, ['existing'])
      ]);

      const env = {
        PATH: `${ctx.fakeGh.binDir}:${process.env.PATH}`,
        FAKE_GH_ISSUE_LABELS: 'Ready for Work',
        FAKE_FETCH_ISSUE_LABELS: 'Ready for Work'
      };
      const { shell, native } = await runPair('push', ctx.shellRepo.repoPath, ctx.nativeRepo.repoPath, ['30'], {
        env,
        fakeFetch: true
      });

      expectParity(shell, native);
      expect(shell.code).toEqual(0);
      // See the equivalent `save` test's comment: the label mutation's
      // own per-tag stdout lines follow the `Pushed: ...` confirmation.
      expect(shell.stdout).toEqual(
        'Pushed: 30\n' +
        'Added tag \'enqueued\' to issue #30 on darthjee/arcanum-queue-fixture\n' +
        'Removed tag \'ready_for_work\' from issue #30 on darthjee/arcanum-queue-fixture\n' +
        'Tag \'created\' not present on issue #30 — nothing to do.\n'
      );

      const listResult = await runPair('list', ctx.shellRepo.repoPath, ctx.nativeRepo.repoPath, []);

      expect(listResult.shell.stdout).toEqual('existing\n30\n');
      expect(listResult.native.stdout).toEqual(listResult.shell.stdout);
    } finally {
      await ctx.cleanup();
    }
  });

  it('matches shell output/exit code when a label mutation\'s own gh/fetch update call fails (best-effort)', async () => {
    const ctx = await setupParityTest();

    try {
      await Promise.all([
        seedQueue(ctx.shellRepo.repoPath, ['existing']),
        seedQueue(ctx.nativeRepo.repoPath, ['existing'])
      ]);

      const env = {
        PATH: `${ctx.fakeGh.binDir}:${process.env.PATH}`,
        FAKE_GH_ISSUE_EDIT_FAIL: '1',
        FAKE_FETCH_ISSUE_EDIT_FAIL: '1',
        FAKE_GH_ISSUE_LABELS: 'Ready for Work',
        FAKE_FETCH_ISSUE_LABELS: 'Ready for Work'
      };
      const { shell, native } = await runPair('push', ctx.shellRepo.repoPath, ctx.nativeRepo.repoPath, ['30'], {
        env,
        fakeFetch: true
      });

      expectParity(shell, native);
      expect(shell.code).toEqual(0);
      // Both the `enqueued` add and the `ready_for_work` remove reach
      // (and fail at) the `gh issue edit`/`PATCH` update call, so only
      // stderr gets their failure messages; the `created` remove is a
      // no-op (label never present) and never reaches that call, so its
      // "nothing to do" line still lands on stdout.
      expect(shell.stdout).toEqual(
        'Pushed: 30\n' +
        'Tag \'created\' not present on issue #30 — nothing to do.\n'
      );
    } finally {
      await ctx.cleanup();
    }
  });
});
