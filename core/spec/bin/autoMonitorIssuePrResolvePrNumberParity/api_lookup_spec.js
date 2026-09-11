import { ID, setupParityTest, runPair } from '../../support/factories/autoMonitorIssuePrResolvePrNumberParitySetup.js';

// Parity test for the "auto-monitor-issue-pr-resolve-pr-number" migrated
// entrypoint (issue #435) — see this suite's cache_hit_spec.js header for
// the full shared-contracts context. Covers the cache-miss -> GitHub API
// lookup path: no cached `pr_id` state exists, so both sides fall back
// to resolving the current (`issue-<id>`) branch's pull request — via
// `gh pr view -R <repo_ref> <branch> --json number` (shell, faked) and
// `GitHubClient#getPr` (native, faked `fetch`) respectively.
describe('auto-monitor-issue-pr-resolve-pr-number parity (shell vs. native) — cache miss, API lookup', () => {
  it('matches shell exit code and stdout for a resolved PR', async () => {
    const ctx = await setupParityTest({
      ghVars: { FAKE_GH_PR_NUMBER: '42' },
      fetchVars: { FAKE_FETCH_PR_NUMBER: '42' }
    });

    try {
      const { shell, native } = await runPair(ID, ctx.shellRepo, ctx.nativeRepo, ctx.shellEnv, ctx.nativeEnv);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('42\n');
    } finally {
      await ctx.cleanup();
    }
  });
});
