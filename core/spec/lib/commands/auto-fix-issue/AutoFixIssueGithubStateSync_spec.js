import { createAutoFixIssueGithub, REPO } from '../../../support/factories/autoFixIssueGithub.js';
import { githubStateFixture } from '../../../support/sharedExamples/githubStateSyncSharedExamples.js';

describe('AutoFixIssueGithub (shared PR-state-sync helpers)', () => {
  describe('#_persistPrState', () => {
    it('extracts the PR number from the url\'s last path segment and persists both fields', async () => {
      const fixture = githubStateFixture();
      const github = createAutoFixIssueGithub(fixture);

      await github._persistPrState('https://github.com/darthjee/arcanum/pull/42');

      expect(fixture.issueStateService.set)
        .toHaveBeenCalledWith('5', 'pr_url', 'https://github.com/darthjee/arcanum/pull/42');
      expect(fixture.issueStateService.set).toHaveBeenCalledWith('5', 'pr_id', '42');
    });

    it('is a no-op off an issue-<id> branch', async () => {
      const fixture = githubStateFixture({ branch: 'main' });
      const github = createAutoFixIssueGithub(fixture);

      await github._persistPrState('https://github.com/darthjee/arcanum/pull/42');

      expect(fixture.issueStateService.set).not.toHaveBeenCalled();
    });

    it('tolerates a failed pr_url/pr_id write (best-effort)', async () => {
      const fixture = githubStateFixture({
        issueStateService: { set: jasmine.createSpy('set').and.rejectWith(new Error('disk full')) }
      });
      const github = createAutoFixIssueGithub(fixture);

      await expectAsync(github._persistPrState('https://github.com/darthjee/arcanum/pull/42')).toBeResolved();
    });
  });

  describe('#_syncPrLabelsAndState', () => {
    it('is a no-op off an issue-<id> branch', async () => {
      const fixture = githubStateFixture({ branch: 'main' });
      const github = createAutoFixIssueGithub(fixture);

      await github._syncPrLabelsAndState();

      expect(fixture.issueTagger.mutateTag).not.toHaveBeenCalled();
    });

    it('adds the "pr" tag via IssueTagger#mutateTag, tolerating a mutation failure', async () => {
      const fixture = githubStateFixture({
        issueTagger: { mutateTag: jasmine.createSpy('mutateTag').and.rejectWith(new Error('boom')) }
      });
      const github = createAutoFixIssueGithub(fixture);

      await expectAsync(github._syncPrLabelsAndState()).toBeResolved();
      expect(fixture.issueTagger.mutateTag).toHaveBeenCalledWith('5', REPO, 'add', 'pr');
    });

    it('refreshes tags from the issue\'s current GitHub labels via Tags.extractTags + setJson', async () => {
      const fixture = githubStateFixture({
        issueTagger: { fetchLabels: jasmine.createSpy('fetchLabels').and.resolveTo(['Ready for Work', 'PR']) }
      });
      const github = createAutoFixIssueGithub(fixture);

      await github._syncPrLabelsAndState();

      expect(fixture.issueStateService.setJson)
        .toHaveBeenCalledWith('5', 'tags', JSON.stringify(['ready_for_work', 'pr']));
    });

    it('warns to stderr and stops when the issue labels fetch fails', async () => {
      const fixture = githubStateFixture({
        issueTagger: { fetchLabels: jasmine.createSpy('fetchLabels').and.rejectWith(new Error('not found')) }
      });
      const github = createAutoFixIssueGithub(fixture);

      await github._syncPrLabelsAndState();

      expect(fixture.issueStateService.setJson).not.toHaveBeenCalled();
    });

    it('tolerates a failed tags persistence (best-effort)', async () => {
      const fixture = githubStateFixture({
        issueStateService: { setJson: jasmine.createSpy('setJson').and.rejectWith(new Error('disk full')) }
      });
      const github = createAutoFixIssueGithub(fixture);

      await expectAsync(github._syncPrLabelsAndState()).toBeResolved();
    });

    it('adds the PR-only auto-shipit label when the refreshed tags include shipit', async () => {
      const pull = { number: 9 };
      const fixture = githubStateFixture({
        githubClient: { getPr: jasmine.createSpy('getPr').and.resolveTo(pull) },
        issueTagger: { fetchLabels: jasmine.createSpy('fetchLabels').and.resolveTo(['shipit']) }
      });
      const github = createAutoFixIssueGithub(fixture);

      await github._syncPrLabelsAndState();

      expect(fixture.githubClient.getPr).toHaveBeenCalledWith('issue-5');
      expect(fixture.issueTagger.addLabel).toHaveBeenCalledWith(9, 'auto-shipit');
    });

    it('does not add auto-shipit when shipit is not among the refreshed tags', async () => {
      const fixture = githubStateFixture({
        githubClient: { getPr: jasmine.createSpy('getPr') },
        issueTagger: { fetchLabels: jasmine.createSpy('fetchLabels').and.resolveTo(['Ready for Work']) }
      });
      const github = createAutoFixIssueGithub(fixture);

      await github._syncPrLabelsAndState();

      expect(fixture.githubClient.getPr).not.toHaveBeenCalled();
      expect(fixture.issueTagger.addLabel).not.toHaveBeenCalled();
    });

    it('tolerates a failed auto-shipit label add (best-effort)', async () => {
      const fixture = githubStateFixture({
        githubClient: { getPr: jasmine.createSpy('getPr').and.rejectWith(new Error('not found')) },
        issueTagger: { fetchLabels: jasmine.createSpy('fetchLabels').and.resolveTo(['shipit']) }
      });
      const github = createAutoFixIssueGithub(fixture);

      await expectAsync(github._syncPrLabelsAndState()).toBeResolved();
    });
  });
});
