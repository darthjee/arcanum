import { createAutoFixIssueGithub, REPO } from '../../../support/factories/autoFixIssueGithub.js';

describe('AutoFixIssueGithub (shared PR-state-sync helpers)', () => {
  describe('#_persistPrState', () => {
    it('extracts the PR number from the url\'s last path segment and persists both fields', async () => {
      const issueStateService = {
        set: jasmine.createSpy('set').and.resolveTo(),
        setJson: jasmine.createSpy('setJson').and.resolveTo()
      };
      const github = createAutoFixIssueGithub({ branch: 'issue-5', issueStateService });

      await github._persistPrState('https://github.com/darthjee/arcanum/pull/42');

      expect(issueStateService.set).toHaveBeenCalledWith('5', 'pr_url', 'https://github.com/darthjee/arcanum/pull/42');
      expect(issueStateService.set).toHaveBeenCalledWith('5', 'pr_id', '42');
    });

    it('is a no-op off an issue-<id> branch', async () => {
      const issueStateService = { set: jasmine.createSpy('set').and.resolveTo() };
      const github = createAutoFixIssueGithub({ branch: 'main', issueStateService });

      await github._persistPrState('https://github.com/darthjee/arcanum/pull/42');

      expect(issueStateService.set).not.toHaveBeenCalled();
    });

    it('tolerates a failed pr_url/pr_id write (best-effort)', async () => {
      const issueStateService = { set: jasmine.createSpy('set').and.rejectWith(new Error('disk full')) };
      const github = createAutoFixIssueGithub({ branch: 'issue-5', issueStateService });

      await expectAsync(github._persistPrState('https://github.com/darthjee/arcanum/pull/42')).toBeResolved();
    });
  });

  describe('#_syncPrLabelsAndState', () => {
    it('is a no-op off an issue-<id> branch', async () => {
      const issueTagger = { mutateTag: jasmine.createSpy('mutateTag').and.resolveTo() };
      const github = createAutoFixIssueGithub({ branch: 'main', issueTagger });

      await github._syncPrLabelsAndState();

      expect(issueTagger.mutateTag).not.toHaveBeenCalled();
    });

    it('adds the "pr" tag via IssueTagger#mutateTag, tolerating a mutation failure', async () => {
      const issueTagger = {
        mutateTag: jasmine.createSpy('mutateTag').and.rejectWith(new Error('boom')),
        fetchLabels: jasmine.createSpy('fetchLabels').and.resolveTo([]),
        addLabel: jasmine.createSpy('addLabel').and.resolveTo()
      };
      const github = createAutoFixIssueGithub({ branch: 'issue-5', issueTagger });

      await expectAsync(github._syncPrLabelsAndState()).toBeResolved();
      expect(issueTagger.mutateTag).toHaveBeenCalledWith('5', REPO, 'add', 'pr');
    });

    it('refreshes tags from the issue\'s current GitHub labels via Tags.extractTags + setJson', async () => {
      const issueTagger = {
        mutateTag: jasmine.createSpy('mutateTag').and.resolveTo(),
        fetchLabels: jasmine.createSpy('fetchLabels').and.resolveTo(['Ready for Work', 'PR']),
        addLabel: jasmine.createSpy('addLabel').and.resolveTo()
      };
      const issueStateService = { setJson: jasmine.createSpy('setJson').and.resolveTo() };
      const github = createAutoFixIssueGithub({ branch: 'issue-5', issueTagger, issueStateService });

      await github._syncPrLabelsAndState();

      expect(issueStateService.setJson).toHaveBeenCalledWith('5', 'tags', JSON.stringify(['ready_for_work', 'pr']));
    });

    it('warns to stderr and stops when the issue labels fetch fails', async () => {
      const issueTagger = {
        mutateTag: jasmine.createSpy('mutateTag').and.resolveTo(),
        fetchLabels: jasmine.createSpy('fetchLabels').and.rejectWith(new Error('not found'))
      };
      const issueStateService = { setJson: jasmine.createSpy('setJson').and.resolveTo() };
      const github = createAutoFixIssueGithub({ branch: 'issue-5', issueTagger, issueStateService });

      await github._syncPrLabelsAndState();

      expect(issueStateService.setJson).not.toHaveBeenCalled();
    });

    it('tolerates a failed tags persistence (best-effort)', async () => {
      const issueTagger = {
        mutateTag: jasmine.createSpy('mutateTag').and.resolveTo(),
        fetchLabels: jasmine.createSpy('fetchLabels').and.resolveTo([]),
        addLabel: jasmine.createSpy('addLabel').and.resolveTo()
      };
      const issueStateService = { setJson: jasmine.createSpy('setJson').and.rejectWith(new Error('disk full')) };
      const github = createAutoFixIssueGithub({ branch: 'issue-5', issueTagger, issueStateService });

      await expectAsync(github._syncPrLabelsAndState()).toBeResolved();
    });

    it('adds the PR-only auto-shipit label when the refreshed tags include shipit', async () => {
      const pull = { number: 9 };
      const githubClient = { getPr: jasmine.createSpy('getPr').and.resolveTo(pull) };
      const issueTagger = {
        mutateTag: jasmine.createSpy('mutateTag').and.resolveTo(),
        fetchLabels: jasmine.createSpy('fetchLabels').and.resolveTo(['shipit']),
        addLabel: jasmine.createSpy('addLabel').and.resolveTo()
      };
      const issueStateService = { setJson: jasmine.createSpy('setJson').and.resolveTo() };
      const github = createAutoFixIssueGithub({ branch: 'issue-5', githubClient, issueTagger, issueStateService });

      await github._syncPrLabelsAndState();

      expect(githubClient.getPr).toHaveBeenCalledWith('issue-5');
      expect(issueTagger.addLabel).toHaveBeenCalledWith(9, 'auto-shipit');
    });

    it('does not add auto-shipit when shipit is not among the refreshed tags', async () => {
      const githubClient = { getPr: jasmine.createSpy('getPr') };
      const issueTagger = {
        mutateTag: jasmine.createSpy('mutateTag').and.resolveTo(),
        fetchLabels: jasmine.createSpy('fetchLabels').and.resolveTo(['Ready for Work']),
        addLabel: jasmine.createSpy('addLabel').and.resolveTo()
      };
      const issueStateService = { setJson: jasmine.createSpy('setJson').and.resolveTo() };
      const github = createAutoFixIssueGithub({ branch: 'issue-5', githubClient, issueTagger, issueStateService });

      await github._syncPrLabelsAndState();

      expect(githubClient.getPr).not.toHaveBeenCalled();
      expect(issueTagger.addLabel).not.toHaveBeenCalled();
    });

    it('tolerates a failed auto-shipit label add (best-effort)', async () => {
      const githubClient = { getPr: jasmine.createSpy('getPr').and.rejectWith(new Error('not found')) };
      const issueTagger = {
        mutateTag: jasmine.createSpy('mutateTag').and.resolveTo(),
        fetchLabels: jasmine.createSpy('fetchLabels').and.resolveTo(['shipit']),
        addLabel: jasmine.createSpy('addLabel').and.resolveTo()
      };
      const issueStateService = { setJson: jasmine.createSpy('setJson').and.resolveTo() };
      const github = createAutoFixIssueGithub({ branch: 'issue-5', githubClient, issueTagger, issueStateService });

      await expectAsync(github._syncPrLabelsAndState()).toBeResolved();
    });
  });
});
