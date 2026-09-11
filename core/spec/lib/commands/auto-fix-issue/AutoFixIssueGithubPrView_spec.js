import DispatchFailure from '../../../../lib/utils/errors/DispatchFailure.js';
import { createAutoFixIssueGithub } from '../../../support/factories/autoFixIssueGithub.js';

describe('AutoFixIssueGithub#prView', () => {
  it('prints URL/IS_DRAFT and persists pr_url when on an issue-<id> branch', async () => {
    const pull = { html_url: 'https://github.com/darthjee/arcanum/pull/9', draft: true };
    const githubClient = { getPr: jasmine.createSpy('getPr').and.resolveTo(pull) };
    const issueStateService = {
      set: jasmine.createSpy('set').and.resolveTo(),
      setJson: jasmine.createSpy('setJson').and.resolveTo()
    };
    const github = createAutoFixIssueGithub({ branch: 'issue-5', githubClient, issueStateService });

    await expectAsync(github.prView()).toBeResolvedTo(
      `URL=${pull.html_url}\nIS_DRAFT=true\n`
    );
    expect(issueStateService.set).toHaveBeenCalledWith('5', 'pr_url', pull.html_url);
    expect(issueStateService.set).toHaveBeenCalledWith('5', 'pr_id', '9');
  });

  it('does not persist pr state off an issue-<id> branch', async () => {
    const pull = { html_url: 'https://github.com/darthjee/arcanum/pull/9', draft: false };
    const githubClient = { getPr: jasmine.createSpy('getPr').and.resolveTo(pull) };
    const issueStateService = { set: jasmine.createSpy('set').and.resolveTo() };
    const github = createAutoFixIssueGithub({ branch: 'main', githubClient, issueStateService });

    await github.prView();

    expect(issueStateService.set).not.toHaveBeenCalled();
  });

  it('rejects with an empty-stdout DispatchFailure (exit 1) when no pull request is found', async () => {
    const githubClient = {
      getPr: jasmine.createSpy('getPr').and.rejectWith(
        new Error('Error: no pull request found for the current branch on darthjee/arcanum')
      )
    };
    const github = createAutoFixIssueGithub({ githubClient });
    let thrown;

    try {
      await github.prView();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(DispatchFailure);
    expect(thrown.stdout).toEqual('');
    expect(thrown.exitCode).toEqual(1);
  });
});
