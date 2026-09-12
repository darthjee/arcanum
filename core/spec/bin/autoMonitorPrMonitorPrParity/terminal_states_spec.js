import { OWNER, setupParityTest, runPair } from '../../support/factories/autoMonitorPrMonitorPrParitySetup.js';

// Parity test for the "auto-monitor-pr-monitor-pr" migrated entrypoint
// (issue #436) — see this suite's `pending_spec.js` header for the full
// shared-contracts context. Covers the three terminal-state outcomes
// that short-circuit before any comment/reaction handling: MERGED,
// CLOSED, and APPROVED via the owner's latest review.
describe('auto-monitor-pr-monitor-pr parity (shell vs. native) — terminal states', () => {
  it('prints "merged\\n" when the pull request is merged', async () => {
    const ctx = await setupParityTest({
      ghVars: { FAKE_GH_PR_STATE: 'MERGED' },
      fetchVars: { FAKE_FETCH_PR_MERGED: '1' }
    });

    try {
      const { shell, native } = await runPair(ctx.shellRepo, ctx.nativeRepo, ctx.shellEnv, ctx.nativeEnv);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('merged\n');
    } finally {
      await ctx.cleanup();
    }
  });

  it('prints "closed\\n" when the pull request is closed but not merged', async () => {
    const ctx = await setupParityTest({
      ghVars: { FAKE_GH_PR_STATE: 'CLOSED' },
      fetchVars: { FAKE_FETCH_PR_STATE: 'closed' }
    });

    try {
      const { shell, native } = await runPair(ctx.shellRepo, ctx.nativeRepo, ctx.shellEnv, ctx.nativeEnv);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('closed\n');
    } finally {
      await ctx.cleanup();
    }
  });

  it('prints "approved\\n" when the owner\'s LATEST review is APPROVED', async () => {
    const shellReviews = JSON.stringify([
      { author: { login: OWNER }, submittedAt: '2024-01-01T00:00:00Z', state: 'CHANGES_REQUESTED', body: '', id: 'PRR_1', url: 'https://example.com/pr/7#pullrequestreview-1' },
      { author: { login: OWNER }, submittedAt: '2024-01-02T00:00:00Z', state: 'APPROVED', body: '', id: 'PRR_2', url: 'https://example.com/pr/7#pullrequestreview-2' }
    ]);
    const nativeReviews = JSON.stringify([
      { user: { login: OWNER }, submitted_at: '2024-01-01T00:00:00Z', state: 'CHANGES_REQUESTED', body: '', node_id: 'PRR_1', html_url: 'https://example.com/pr/7#pullrequestreview-1' },
      { user: { login: OWNER }, submitted_at: '2024-01-02T00:00:00Z', state: 'APPROVED', body: '', node_id: 'PRR_2', html_url: 'https://example.com/pr/7#pullrequestreview-2' }
    ]);
    const ctx = await setupParityTest({
      ghVars: { FAKE_GH_PR_REVIEWS_JSON: shellReviews },
      fetchVars: { FAKE_FETCH_PR_REVIEWS_JSON: nativeReviews }
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

  it('does NOT report "approved\\n" when a later non-approved review supersedes an earlier APPROVED one', async () => {
    const shellReviews = JSON.stringify([
      { author: { login: OWNER }, submittedAt: '2024-01-01T00:00:00Z', state: 'APPROVED', body: '', id: 'PRR_1', url: 'https://example.com/pr/7#pullrequestreview-1' },
      { author: { login: OWNER }, submittedAt: '2024-01-02T00:00:00Z', state: 'CHANGES_REQUESTED', body: '', id: 'PRR_2', url: 'https://example.com/pr/7#pullrequestreview-2' }
    ]);
    const nativeReviews = JSON.stringify([
      { user: { login: OWNER }, submitted_at: '2024-01-01T00:00:00Z', state: 'APPROVED', body: '', node_id: 'PRR_1', html_url: 'https://example.com/pr/7#pullrequestreview-1' },
      { user: { login: OWNER }, submitted_at: '2024-01-02T00:00:00Z', state: 'CHANGES_REQUESTED', body: '', node_id: 'PRR_2', html_url: 'https://example.com/pr/7#pullrequestreview-2' }
    ]);
    const ctx = await setupParityTest({
      ghVars: { FAKE_GH_PR_REVIEWS_JSON: shellReviews },
      fetchVars: { FAKE_FETCH_PR_REVIEWS_JSON: nativeReviews }
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
