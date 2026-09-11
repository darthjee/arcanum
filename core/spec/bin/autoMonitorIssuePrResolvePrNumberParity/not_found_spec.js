import { ID, setupParityTest, runPair } from '../../support/factories/autoMonitorIssuePrResolvePrNumberParitySetup.js';

// Parity test for the "auto-monitor-issue-pr-resolve-pr-number" migrated
// entrypoint (issue #435) — see this suite's cache_hit_spec.js header for
// the full shared-contracts context. Covers the not-found error path:
// no cached `pr_id`, and neither the faked `gh pr view` (shell) nor the
// faked `fetch` (native, via `GitHubClient#getPr`) find a matching pull
// request for the current branch — both sides exit non-zero with only
// stdout empty, mirroring `resolve_pr_number_shell.sh`'s own
// `Error: no pull request found for the current branch on <repo_ref>`
// contract (only stdout/exit code are required byte-identical — see
// docs/agents/architecture/script-engine.md — since the shell/native
// stderr wording isn't identical, e.g. `$0`/token-source differences).
describe('auto-monitor-issue-pr-resolve-pr-number parity (shell vs. native) — not found', () => {
  it('matches shell exit code and empty stdout when no PR is found', async () => {
    const ctx = await setupParityTest();

    try {
      const { shell, native } = await runPair(ID, ctx.shellRepo, ctx.nativeRepo, ctx.shellEnv, ctx.nativeEnv);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).not.toEqual(0);
      expect(shell.stdout).toEqual('');
      expect(native.stdout).toEqual('');
    } finally {
      await ctx.cleanup();
    }
  });
});
