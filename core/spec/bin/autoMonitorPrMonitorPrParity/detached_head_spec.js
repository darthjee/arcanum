import {
  DEFAULT_PARITY_TIMEOUT_MS, runPair, setupParityTest
} from '../../support/factories/autoMonitorPrMonitorPrParitySetup.js';
import { detachHead, snapshotRepoState } from '../../support/utils/detachedHead.js';

// See `autoMonitorPrMonitorPrParitySetup.js`'s own header for the shared
// fixture/fake-`gh`/fake-`fetch` context. `monitor_pr` is the one
// best-effort push caller (issue #947): on a detached HEAD the strict
// push helper refuses, and both engines swallow that refusal (shell:
// `push_current_branch 2>/dev/null || true`; native: its own
// `try/catch`) and carry on polling — never pushing anything.
describe('auto-monitor-pr-monitor-pr parity (shell vs. native) — detached HEAD (issue #947)', () => {
  it('succeeds with identical output on both sides, without pushing anything', async () => {
    const ctx = await setupParityTest();

    try {
      await Promise.all([detachHead(ctx.shellRepo.repoPath), detachHead(ctx.nativeRepo.repoPath)]);
      const [shellBefore, nativeBefore] = await Promise.all([
        snapshotRepoState(ctx.shellRepo), snapshotRepoState(ctx.nativeRepo)
      ]);

      const { shell, native } = await runPair(ctx.shellRepo, ctx.nativeRepo, ctx.shellEnv, ctx.nativeEnv);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('pending\n');

      const [shellAfter, nativeAfter] = await Promise.all([
        snapshotRepoState(ctx.shellRepo), snapshotRepoState(ctx.nativeRepo)
      ]);

      expect(shellAfter.remoteRefs).toEqual(shellBefore.remoteRefs);
      expect(nativeAfter.remoteRefs).toEqual(nativeBefore.remoteRefs);
      expect(shellAfter.head).toEqual(shellBefore.head);
      expect(nativeAfter.head).toEqual(nativeBefore.head);
    } finally {
      await ctx.cleanup();
    }
  }, DEFAULT_PARITY_TIMEOUT_MS);
});
