import { OWNER, setupParityTest, runPair } from '../../support/factories/autoMonitorPrMonitorPrParitySetup.js';

// Parity test for the "auto-monitor-pr-monitor-pr" migrated entrypoint
// (issue #436) — see this suite's `pending_spec.js` header for the full
// shared-contracts context. Covers the ":shipit:"-comment early-approve
// path: a brand-new owner comment whose body is exactly ":shipit:"
// reports "approved" without ever reaching the "commented" phase.
describe('auto-monitor-pr-monitor-pr parity (shell vs. native) — approved via ":shipit:"', () => {
  it('prints "approved\\n" when a new owner comment is exactly ":shipit:"', async () => {
    const shellComments = JSON.stringify([
      { author: { login: OWNER }, createdAt: '2024-06-01T00:00:00Z', body: ':shipit:', id: 'IC_1', url: 'https://example.com/pr/7#issuecomment-1' }
    ]);
    const nativeComments = JSON.stringify([
      { user: { login: OWNER }, created_at: '2024-06-01T00:00:00Z', body: ':shipit:', node_id: 'IC_1', html_url: 'https://example.com/pr/7#issuecomment-1' }
    ]);
    const ctx = await setupParityTest({
      ghVars: { FAKE_GH_PR_COMMENTS_JSON: shellComments },
      fetchVars: { FAKE_FETCH_PR_COMMENTS_JSON: nativeComments }
    });

    try {
      const { shell, native } = await runPair(ctx.shellRepo, ctx.nativeRepo, ctx.shellEnv, ctx.nativeEnv);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('approved\n');
    } finally {
      await ctx.cleanup();
    }
  });

  it('tolerates surrounding whitespace around ":shipit:"', async () => {
    const shellComments = JSON.stringify([
      { author: { login: OWNER }, createdAt: '2024-06-01T00:00:00Z', body: '  :shipit:  ', id: 'IC_1', url: 'https://example.com/pr/7#issuecomment-1' }
    ]);
    const nativeComments = JSON.stringify([
      { user: { login: OWNER }, created_at: '2024-06-01T00:00:00Z', body: '  :shipit:  ', node_id: 'IC_1', html_url: 'https://example.com/pr/7#issuecomment-1' }
    ]);
    const ctx = await setupParityTest({
      ghVars: { FAKE_GH_PR_COMMENTS_JSON: shellComments },
      fetchVars: { FAKE_FETCH_PR_COMMENTS_JSON: nativeComments }
    });

    try {
      const { shell, native } = await runPair(ctx.shellRepo, ctx.nativeRepo, ctx.shellEnv, ctx.nativeEnv);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('approved\n');
    } finally {
      await ctx.cleanup();
    }
  });
});
