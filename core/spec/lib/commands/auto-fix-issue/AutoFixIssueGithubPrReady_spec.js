import { createAutoFixIssueGithub, REPO } from '../../../support/factories/autoFixIssueGithub.js';
import { registerSyncsGithubStateSharedExamples } from '../../../support/sharedExamples/githubStateSyncSharedExamples.js';

describe('AutoFixIssueGithub#prReady', () => {
  const pull = { number: 9, node_id: 'PR_kwABC', html_url: 'https://github.com/darthjee/arcanum/pull/9' };

  it('marks the PR ready and returns OK', async () => {
    const githubClient = {
      getPr: jasmine.createSpy('getPr').and.resolveTo(pull),
      markPrReady: jasmine.createSpy('markPrReady').and.resolveTo()
    };
    const github = createAutoFixIssueGithub({ githubClient });

    await expectAsync(github.prReady()).toBeResolvedTo('OK\n');
    expect(githubClient.markPrReady).toHaveBeenCalledWith('PR_kwABC');
  });

  it('rejects with the mark-ready-failure error text when the PR lookup fails', async () => {
    const githubClient = {
      getPr: jasmine.createSpy('getPr').and.rejectWith(new Error('not found')),
      markPrReady: jasmine.createSpy('markPrReady')
    };
    const github = createAutoFixIssueGithub({ githubClient });

    await expectAsync(github.prReady()).toBeRejectedWithError(`Error: could not mark PR ready on ${REPO}`);
  });

  it('rejects with the mark-ready-failure error text when markPrReady itself fails', async () => {
    const githubClient = {
      getPr: jasmine.createSpy('getPr').and.resolveTo(pull),
      markPrReady: jasmine.createSpy('markPrReady').and.rejectWith(new Error('boom'))
    };
    const github = createAutoFixIssueGithub({ githubClient });

    await expectAsync(github.prReady()).toBeRejectedWithError(`Error: could not mark PR ready on ${REPO}`);
  });

  registerSyncsGithubStateSharedExamples((github) => github.prReady(), {
    prUrl: pull.html_url,
    buildFixture: () => ({
      githubClient: {
        getPr: jasmine.createSpy('getPr').and.resolveTo(pull),
        markPrReady: jasmine.createSpy('markPrReady').and.resolveTo()
      }
    })
  });

  it('tolerates a failed best-effort re-fetch of the PR url after marking ready', async () => {
    const githubClient = {
      getPr: jasmine.createSpy('getPr').and.returnValues(
        Promise.resolve(pull),
        Promise.reject(new Error('refetch failed'))
      ),
      markPrReady: jasmine.createSpy('markPrReady').and.resolveTo()
    };
    const issueStateService = {
      set: jasmine.createSpy('set').and.resolveTo(),
      setJson: jasmine.createSpy('setJson').and.resolveTo()
    };
    const github = createAutoFixIssueGithub({ branch: 'issue-5', githubClient, issueStateService });

    await expectAsync(github.prReady()).toBeResolvedTo('OK\n');
    expect(issueStateService.set).not.toHaveBeenCalled();
  });
});
