import PrMonitor from '../../../lib/services/PrMonitor.js';

const PR_NUMBER = 7;
const OWNER = 'darthjee';

describe('PrMonitor', () => {
  function newMonitor(overrides = {}) {
    const githubClient = {
      getPrState: jasmine.createSpy().and.resolveTo({ state: 'open', merged: false, merged_at: null }),
      getPrReviews: jasmine.createSpy().and.resolveTo([]),
      getIssueComments: jasmine.createSpy().and.resolveTo([]),
      getPrReviewComments: jasmine.createSpy().and.resolveTo([]),
      addReaction: jasmine.createSpy().and.resolveTo(undefined),
      removeReaction: jasmine.createSpy().and.resolveTo(undefined),
      ...overrides
    };
    const prMonitor = new PrMonitor({ githubClient });

    return { prMonitor, githubClient };
  }

  describe('#resolveState', () => {
    it('returns "merged" when the pull request is merged', async () => {
      const { prMonitor } = newMonitor({
        getPrState: jasmine.createSpy().and.resolveTo({ state: 'closed', merged: true, merged_at: '2024-01-01T00:00:00Z' })
      });

      await expectAsync(prMonitor.resolveState(PR_NUMBER, OWNER)).toBeResolvedTo('merged');
    });

    it('returns "closed" when the pull request is closed but not merged', async () => {
      const { prMonitor } = newMonitor({
        getPrState: jasmine.createSpy().and.resolveTo({ state: 'closed', merged: false, merged_at: null })
      });

      await expectAsync(prMonitor.resolveState(PR_NUMBER, OWNER)).toBeResolvedTo('closed');
    });

    it('returns "approved" when the LATEST review from owner is APPROVED', async () => {
      const reviews = [
        { user: { login: OWNER }, state: 'CHANGES_REQUESTED', submitted_at: '2024-01-01T00:00:00Z' },
        { user: { login: OWNER }, state: 'APPROVED', submitted_at: '2024-01-02T00:00:00Z' },
        { user: { login: 'someone-else' }, state: 'APPROVED', submitted_at: '2024-01-03T00:00:00Z' }
      ];
      const { prMonitor } = newMonitor({ getPrReviews: jasmine.createSpy().and.resolveTo(reviews) });

      await expectAsync(prMonitor.resolveState(PR_NUMBER, OWNER)).toBeResolvedTo('approved');
    });

    it('does not return "approved" when a later non-approved review from owner supersedes an earlier APPROVED one', async () => {
      const reviews = [
        { user: { login: OWNER }, state: 'APPROVED', submitted_at: '2024-01-01T00:00:00Z' },
        { user: { login: OWNER }, state: 'CHANGES_REQUESTED', submitted_at: '2024-01-02T00:00:00Z' }
      ];
      const { prMonitor } = newMonitor({ getPrReviews: jasmine.createSpy().and.resolveTo(reviews) });

      await expectAsync(prMonitor.resolveState(PR_NUMBER, OWNER)).toBeResolvedTo(null);
    });

    it('returns null when nothing terminal is found yet', async () => {
      const { prMonitor } = newMonitor();

      await expectAsync(prMonitor.resolveState(PR_NUMBER, OWNER)).toBeResolvedTo(null);
    });

    it('returns null on a transient getPrState failure, without calling getPrReviews', async () => {
      const { prMonitor, githubClient } = newMonitor({
        getPrState: jasmine.createSpy().and.rejectWith(new Error('network error'))
      });

      await expectAsync(prMonitor.resolveState(PR_NUMBER, OWNER)).toBeResolvedTo(null);
      expect(githubClient.getPrReviews).not.toHaveBeenCalled();
    });

    it('returns null on a transient getPrReviews failure', async () => {
      const { prMonitor } = newMonitor({
        getPrReviews: jasmine.createSpy().and.rejectWith(new Error('network error'))
      });

      await expectAsync(prMonitor.resolveState(PR_NUMBER, OWNER)).toBeResolvedTo(null);
    });
  });

  describe('#newOwnerComments', () => {
    const SINCE = '2024-01-01T00:00:00Z';

    it('normalizes and concatenates issue comments, then inline comments, then review bodies, in that order', async () => {
      const issueComments = [{ user: { login: OWNER }, created_at: '2024-01-02T00:00:00Z', body: 'issue comment', node_id: 'IC_1', html_url: 'https://x/1' }];
      const inlineComments = [{ user: { login: OWNER }, created_at: '2024-01-03T00:00:00Z', body: 'inline comment', node_id: 'RC_1', html_url: 'https://x/2' }];
      const reviews = [{ user: { login: OWNER }, submitted_at: '2024-01-04T00:00:00Z', body: 'review comment', node_id: 'PRR_1', html_url: 'https://x/3' }];
      const { prMonitor } = newMonitor({
        getIssueComments: jasmine.createSpy().and.resolveTo(issueComments),
        getPrReviewComments: jasmine.createSpy().and.resolveTo(inlineComments),
        getPrReviews: jasmine.createSpy().and.resolveTo(reviews)
      });

      const result = await prMonitor.newOwnerComments(PR_NUMBER, OWNER, SINCE);

      expect(result).toEqual([
        { login: OWNER, createdAt: '2024-01-02T00:00:00Z', body: 'issue comment', id: 'IC_1', url: 'https://x/1' },
        { login: OWNER, createdAt: '2024-01-03T00:00:00Z', body: 'inline comment', id: 'RC_1', url: 'https://x/2' },
        { login: OWNER, createdAt: '2024-01-04T00:00:00Z', body: 'review comment', id: 'PRR_1', url: 'https://x/3' }
      ]);
    });

    it('filters out comments not from owner and not newer than sinceIso', async () => {
      const issueComments = [
        { user: { login: OWNER }, created_at: '2023-12-31T00:00:00Z', body: 'too old', node_id: 'IC_1', html_url: 'https://x/1' },
        { user: { login: 'someone-else' }, created_at: '2024-01-05T00:00:00Z', body: 'not owner', node_id: 'IC_2', html_url: 'https://x/2' },
        { user: { login: OWNER }, created_at: '2024-01-05T00:00:00Z', body: 'keep me', node_id: 'IC_3', html_url: 'https://x/3' }
      ];
      const { prMonitor } = newMonitor({ getIssueComments: jasmine.createSpy().and.resolveTo(issueComments) });

      const result = await prMonitor.newOwnerComments(PR_NUMBER, OWNER, SINCE);

      expect(result).toEqual([
        { login: OWNER, createdAt: '2024-01-05T00:00:00Z', body: 'keep me', id: 'IC_3', url: 'https://x/3' }
      ]);
    });

    it('skips review bodies that are null or whitespace-only', async () => {
      const reviews = [
        { user: { login: OWNER }, submitted_at: '2024-01-05T00:00:00Z', body: null, node_id: 'PRR_1', html_url: 'https://x/1' },
        { user: { login: OWNER }, submitted_at: '2024-01-05T00:00:00Z', body: '   \n  ', node_id: 'PRR_2', html_url: 'https://x/2' },
        { user: { login: OWNER }, submitted_at: '2024-01-05T00:00:00Z', body: 'real body', node_id: 'PRR_3', html_url: 'https://x/3' }
      ];
      const { prMonitor } = newMonitor({ getPrReviews: jasmine.createSpy().and.resolveTo(reviews) });

      const result = await prMonitor.newOwnerComments(PR_NUMBER, OWNER, SINCE);

      expect(result).toEqual([
        { login: OWNER, createdAt: '2024-01-05T00:00:00Z', body: 'real body', id: 'PRR_3', url: 'https://x/3' }
      ]);
    });

    it('returns null on any transient fetch failure', async () => {
      const { prMonitor } = newMonitor({
        getPrReviewComments: jasmine.createSpy().and.rejectWith(new Error('network error'))
      });

      await expectAsync(prMonitor.newOwnerComments(PR_NUMBER, OWNER, SINCE)).toBeResolvedTo(null);
    });
  });

  describe('#isShipit', () => {
    it('matches an exact ":shipit:" body', () => {
      const { prMonitor } = newMonitor();

      expect(prMonitor.isShipit(':shipit:')).toBeTrue();
    });

    it('matches ":shipit:" with surrounding whitespace', () => {
      const { prMonitor } = newMonitor();

      expect(prMonitor.isShipit('  :shipit:  \n')).toBeTrue();
    });

    it('does not match a body with extra text', () => {
      const { prMonitor } = newMonitor();

      expect(prMonitor.isShipit('looks good :shipit:')).toBeFalse();
    });
  });

  describe('#addEyes', () => {
    it('adds an EYES reaction to the given node id', async () => {
      const { prMonitor, githubClient } = newMonitor();

      await prMonitor.addEyes('IC_1');

      expect(githubClient.addReaction).toHaveBeenCalledWith('IC_1', 'EYES');
    });
  });

  describe('#resolveAddressed', () => {
    it('removes the EYES reaction then adds a THUMBS_UP reaction, in that order', async () => {
      const { prMonitor, githubClient } = newMonitor();
      const calls = [];

      githubClient.removeReaction.and.callFake(async (id, content) => calls.push(['remove', id, content]));
      githubClient.addReaction.and.callFake(async (id, content) => calls.push(['add', id, content]));

      await prMonitor.resolveAddressed('IC_1');

      expect(calls).toEqual([
        ['remove', 'IC_1', 'EYES'],
        ['add', 'IC_1', 'THUMBS_UP']
      ]);
    });
  });
});
