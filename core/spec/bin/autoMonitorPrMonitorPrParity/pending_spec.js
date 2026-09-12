import { setupParityTest, runPair } from '../../support/factories/autoMonitorPrMonitorPrParitySetup.js';

// Parity test for the "auto-monitor-pr-monitor-pr" migrated entrypoint
// (issue #436) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/436-migrate-auto-monitor-pr-monitor-pr-entrypoint-to-native-node-js/node.md's
// "Shared contracts". Runs `auto-monitor-pr/scripts/monitor_pr_shell.sh`
// (invoked directly, NOT through the `monitor_pr.sh` engine_dispatch
// shim — so this test isn't circular, same convention as every other
// sibling parity spec) and `core/bin/arcanum auto-monitor-pr-monitor-pr`
// against equivalent inputs, asserting byte-identical stdout and exit
// code.
//
// This file covers the "pending" outcome: nothing new this pass, and
// separately, a transient `gh`/API error along the way (see
// `autoMonitorPrMonitorPrParitySetup.js`'s own header for why the
// gh-error scenario uses a shell-only `FAKE_GH_PR_NUMBER`-unset gate and
// a distinct native-only `FAKE_FETCH_MONITOR_PR_FAIL` flag rather than a
// single mirrored variable). See `terminal_states_spec.js` for
// merged/closed/approved-by-review, `shipit_spec.js` for
// approved-by-":shipit:"`, and `commented_spec.js` for the "commented"
// outcome (both state-file shapes).
describe('auto-monitor-pr-monitor-pr parity (shell vs. native) — pending', () => {
  it('prints "pending\\n" when there is nothing new this pass', async () => {
    const ctx = await setupParityTest();

    try {
      const { shell, native } = await runPair(ctx.shellRepo, ctx.nativeRepo, ctx.shellEnv, ctx.nativeEnv);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('pending\n');
    } finally {
      await ctx.cleanup();
    }
  });

  it('prints "pending\\n" on a transient gh/API error', async () => {
    const ctx = await setupParityTest({
      ghVars: { FAKE_GH_PR_NUMBER: '' },
      fetchVars: { FAKE_FETCH_MONITOR_PR_FAIL: '1' }
    });

    try {
      const { shell, native } = await runPair(ctx.shellRepo, ctx.nativeRepo, ctx.shellEnv, ctx.nativeEnv);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('pending\n');
    } finally {
      await ctx.cleanup();
    }
  });
});
