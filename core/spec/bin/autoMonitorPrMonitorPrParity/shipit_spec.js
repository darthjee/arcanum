import { OWNER, itMatchesShellForState } from '../../support/factories/autoMonitorPrMonitorPrParitySetup.js';

// Parity test for the "auto-monitor-pr-monitor-pr" migrated entrypoint
// (issue #436) — see this suite's `pending_spec.js` header for the full
// shared-contracts context. Covers the ":shipit:"-comment early-approve
// path: a brand-new owner comment whose body is exactly ":shipit:"
// reports "approved" without ever reaching the "commented" phase.
describe('auto-monitor-pr-monitor-pr parity (shell vs. native) — approved via ":shipit:"', () => {
  const shellShipitComments = JSON.stringify([
    { author: { login: OWNER }, createdAt: '2024-06-01T00:00:00Z', body: ':shipit:', id: 'IC_1', url: 'https://example.com/pr/7#issuecomment-1' }
  ]);
  const nativeShipitComments = JSON.stringify([
    { user: { login: OWNER }, created_at: '2024-06-01T00:00:00Z', body: ':shipit:', node_id: 'IC_1', html_url: 'https://example.com/pr/7#issuecomment-1' }
  ]);

  itMatchesShellForState('prints "approved\\n" when a new owner comment is exactly ":shipit:"', {
    ghVars: { FAKE_GH_PR_COMMENTS_JSON: shellShipitComments },
    fetchVars: { FAKE_FETCH_PR_COMMENTS_JSON: nativeShipitComments },
    expectedStdout: 'approved\n'
  });

  const shellPaddedShipitComments = JSON.stringify([
    { author: { login: OWNER }, createdAt: '2024-06-01T00:00:00Z', body: '  :shipit:  ', id: 'IC_1', url: 'https://example.com/pr/7#issuecomment-1' }
  ]);
  const nativePaddedShipitComments = JSON.stringify([
    { user: { login: OWNER }, created_at: '2024-06-01T00:00:00Z', body: '  :shipit:  ', node_id: 'IC_1', html_url: 'https://example.com/pr/7#issuecomment-1' }
  ]);

  itMatchesShellForState('tolerates surrounding whitespace around ":shipit:"', {
    ghVars: { FAKE_GH_PR_COMMENTS_JSON: shellPaddedShipitComments },
    fetchVars: { FAKE_FETCH_PR_COMMENTS_JSON: nativePaddedShipitComments },
    expectedStdout: 'approved\n'
  });
});
