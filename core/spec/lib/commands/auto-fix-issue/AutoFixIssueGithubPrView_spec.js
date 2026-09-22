import DispatchFailure from '../../../../lib/utils/errors/DispatchFailure.js';
import { createAutoFixIssueGithub } from '../../../support/factories/autoFixIssueGithub.js';
import { registerSyncsGithubStateSharedExamples } from '../../../support/sharedExamples/githubStateSyncSharedExamples.js';
import { captureRejection } from '../../../support/utils/captureRejection.js';

describe('AutoFixIssueGithub#prView', () => {
  const pull = { html_url: 'https://github.com/darthjee/arcanum/pull/9', draft: true };

  it('prints URL/IS_DRAFT when on an issue-<id> branch', async () => {
    const githubClient = { getPr: jasmine.createSpy('getPr').and.resolveTo(pull) };
    const github = createAutoFixIssueGithub({ branch: 'issue-5', githubClient });

    await expectAsync(github.prView()).toBeResolvedTo(
      `URL=${pull.html_url}\nIS_DRAFT=true\n`
    );
  });

  registerSyncsGithubStateSharedExamples((github) => github.prView(), {
    prUrl: pull.html_url,
    prId: '9',
    tag: false,
    buildFixture: () => ({
      githubClient: { getPr: jasmine.createSpy('getPr').and.resolveTo(pull) }
    })
  });

  it('rejects with an empty-stdout DispatchFailure (exit 1) when no pull request is found', async () => {
    const githubClient = {
      getPr: jasmine.createSpy('getPr').and.rejectWith(
        new Error('Error: no pull request found for the current branch on darthjee/arcanum')
      )
    };
    const github = createAutoFixIssueGithub({ githubClient });
    const thrown = await captureRejection(github.prView());

    expect(thrown).toBeInstanceOf(DispatchFailure);
    expect(thrown.stdout).toEqual('');
    expect(thrown.exitCode).toEqual(1);
  });
});
