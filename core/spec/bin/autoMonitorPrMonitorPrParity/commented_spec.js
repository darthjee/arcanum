import { OWNER, setupParityTest, runPair } from '../../support/factories/autoMonitorPrMonitorPrParitySetup.js';

// Parity test for the "auto-monitor-pr-monitor-pr" migrated entrypoint
// (issue #436) — see this suite's `pending_spec.js` header for the full
// shared-contracts context. Covers the "commented" outcome — a single
// new, non-":shipit:" owner comment — run once against each
// comments-state file shape (`--issue-id` given vs. the legacy
// per-PR-file, per plan.md's "state-file dual shape" contract), since
// the shell's `save_comments_state`/`load_comments_state` branch on
// `$ISSUE_ID` being set independently of anything observable in stdout
// alone — only running both shapes actually exercises the legacy
// (`--issue-id`-absent) file path per node/06's own note.
// The "--issue-id" shape's own test needs a longer-than-default timeout:
// both Lock.js (native) and arcanum/_lib/lock.sh (shell) sleep a real 1
// second per lock acquisition (see
// docs/agents/architecture/lock-system.md), and this scenario's
// "fetched" then "processing" phases each acquire the issue-state lock
// at least once per side -- the shell's own save_comments_state acquires
// it twice per phase (once for pr_comments, once for last_comment_time,
// via two separate issue_state.sh invocations) where native's
// IssueStateService#write merges both fields into a single locked
// write, so the shell side alone already costs ~4 real seconds before
// any other work. The legacy (--issue-id-absent) shape needs no such
// allowance -- it flat-overwrites a plain file with no lock involved on
// either side.
const ISSUE_ID_SCENARIO_TIMEOUT_MS = 20000;

describe('auto-monitor-pr-monitor-pr parity (shell vs. native) — commented', () => {
  const COMMENT_BODY = 'Please fix the typo';
  const COMMENT_URL = 'https://example.com/pr/7#issuecomment-1';

  /**
   * @param {object} ctx - the built parity fixtures.
   * @param {string} [issueId] - the `--issue-id` value, omitted for the
   *   legacy per-PR-file shape.
   * @returns {Promise<void>} resolves once asserted.
   */
  async function expectCommentedParity(ctx, issueId) {
    const { shell, native } = await runPair(ctx.shellRepo, ctx.nativeRepo, ctx.shellEnv, ctx.nativeEnv, issueId);

    expect(native.stdout).toEqual(shell.stdout);
    expect(native.code).toEqual(shell.code);
    expect(shell.code).toEqual(0);
    expect(shell.stdout).toEqual(`commented\n---\nid: IC_1\nurl: ${COMMENT_URL}\n${COMMENT_BODY}\n`);
  }

  /**
   * @returns {Promise<object>} the built parity fixtures for a single
   *   new owner comment scenario (shared by both state-file shapes).
   */
  async function setupCommentScenario() {
    const shellComments = JSON.stringify([
      { author: { login: OWNER }, createdAt: '2024-06-01T00:00:00Z', body: COMMENT_BODY, id: 'IC_1', url: COMMENT_URL }
    ]);
    const nativeComments = JSON.stringify([
      { user: { login: OWNER }, created_at: '2024-06-01T00:00:00Z', body: COMMENT_BODY, node_id: 'IC_1', html_url: COMMENT_URL }
    ]);

    return setupParityTest({
      ghVars: { FAKE_GH_PR_COMMENTS_JSON: shellComments },
      fetchVars: { FAKE_FETCH_PR_COMMENTS_JSON: nativeComments }
    });
  }

  it('matches shell exit code and stdout (--issue-id state-file shape)', async () => {
    const ctx = await setupCommentScenario();

    try {
      await expectCommentedParity(ctx, '5');
    } finally {
      await ctx.cleanup();
    }
  }, ISSUE_ID_SCENARIO_TIMEOUT_MS);

  it('matches shell exit code and stdout (legacy per-PR-file state-file shape)', async () => {
    const ctx = await setupCommentScenario();

    try {
      await expectCommentedParity(ctx);
    } finally {
      await ctx.cleanup();
    }
  });
});
