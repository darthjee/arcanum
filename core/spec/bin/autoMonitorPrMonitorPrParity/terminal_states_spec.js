import { OWNER, itMatchesShellForState } from '../../support/factories/autoMonitorPrMonitorPrParitySetup.js';

// Parity test for the "auto-monitor-pr-monitor-pr" migrated entrypoint
// (issue #436) — see this suite's `pending_spec.js` header for the full
// shared-contracts context. Covers the three terminal-state outcomes
// that short-circuit before any comment/reaction handling: MERGED,
// CLOSED, and APPROVED via the owner's latest review.
describe('auto-monitor-pr-monitor-pr parity (shell vs. native) — terminal states', () => {
  itMatchesShellForState('prints "merged\\n" when the pull request is merged', {
    ghVars: { FAKE_GH_PR_STATE: 'MERGED' },
    fetchVars: { FAKE_FETCH_PR_MERGED: '1' },
    expectedStdout: 'merged\n'
  });

  itMatchesShellForState('prints "closed\\n" when the pull request is closed but not merged', {
    ghVars: { FAKE_GH_PR_STATE: 'CLOSED' },
    fetchVars: { FAKE_FETCH_PR_STATE: 'closed' },
    expectedStdout: 'closed\n'
  });

  const shellApprovedReviews = JSON.stringify([
    { author: { login: OWNER }, submittedAt: '2024-01-01T00:00:00Z', state: 'CHANGES_REQUESTED', body: '', id: 'PRR_1', url: 'https://example.com/pr/7#pullrequestreview-1' },
    { author: { login: OWNER }, submittedAt: '2024-01-02T00:00:00Z', state: 'APPROVED', body: '', id: 'PRR_2', url: 'https://example.com/pr/7#pullrequestreview-2' }
  ]);
  const nativeApprovedReviews = JSON.stringify([
    { user: { login: OWNER }, submitted_at: '2024-01-01T00:00:00Z', state: 'CHANGES_REQUESTED', body: '', node_id: 'PRR_1', html_url: 'https://example.com/pr/7#pullrequestreview-1' },
    { user: { login: OWNER }, submitted_at: '2024-01-02T00:00:00Z', state: 'APPROVED', body: '', node_id: 'PRR_2', html_url: 'https://example.com/pr/7#pullrequestreview-2' }
  ]);

  itMatchesShellForState('prints "approved\\n" when the owner\'s LATEST review is APPROVED', {
    ghVars: { FAKE_GH_PR_REVIEWS_JSON: shellApprovedReviews },
    fetchVars: { FAKE_FETCH_PR_REVIEWS_JSON: nativeApprovedReviews },
    expectedStdout: 'approved\n'
  });

  const shellSupersededReviews = JSON.stringify([
    { author: { login: OWNER }, submittedAt: '2024-01-01T00:00:00Z', state: 'APPROVED', body: '', id: 'PRR_1', url: 'https://example.com/pr/7#pullrequestreview-1' },
    { author: { login: OWNER }, submittedAt: '2024-01-02T00:00:00Z', state: 'CHANGES_REQUESTED', body: '', id: 'PRR_2', url: 'https://example.com/pr/7#pullrequestreview-2' }
  ]);
  const nativeSupersededReviews = JSON.stringify([
    { user: { login: OWNER }, submitted_at: '2024-01-01T00:00:00Z', state: 'APPROVED', body: '', node_id: 'PRR_1', html_url: 'https://example.com/pr/7#pullrequestreview-1' },
    { user: { login: OWNER }, submitted_at: '2024-01-02T00:00:00Z', state: 'CHANGES_REQUESTED', body: '', node_id: 'PRR_2', html_url: 'https://example.com/pr/7#pullrequestreview-2' }
  ]);

  itMatchesShellForState('does NOT report "approved\\n" when a later non-approved review supersedes an earlier APPROVED one', {
    ghVars: { FAKE_GH_PR_REVIEWS_JSON: shellSupersededReviews },
    fetchVars: { FAKE_FETCH_PR_REVIEWS_JSON: nativeSupersededReviews },
    expectedStdout: 'pending\n'
  });
});
