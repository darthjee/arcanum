import DispatchFailure from '../../../../lib/utils/errors/DispatchFailure.js';
import { fakeIssueClient, newTagger, REPO } from '../../../support/factories/issueTagger.js';
import { captureStdout } from '../../../support/utils/captureStdout.js';

describe('IssueTagger#markEnqueued', () => {
  it('best-effort attempts the label mutation for every given id', async () => {
    const issueClient = fakeIssueClient();
    const tagger = newTagger({ issueClient });

    await captureStdout(() => tagger.markEnqueued(['10', '20']));

    // 3 getIssue calls per id (enqueued/ready_for_work/created), 1
    // addLabel (add enqueued, not yet present) and 2 removeLabel
    // (remove ready_for_work/created, both present) per id.
    const getIds = issueClient.getIssue.calls.allArgs().map(([id]) => id);

    expect(getIds.filter((id) => id === '10').length).toEqual(3);
    expect(getIds.filter((id) => id === '20').length).toEqual(3);
    expect(issueClient.addLabel.calls.count()).toEqual(2);
    expect(issueClient.removeLabel.calls.count()).toEqual(4);
  });

  it('warns to stderr, without stopping, when a label mutation fails', async () => {
    spyOn(process.stderr, 'write');

    const tagger = newTagger({ issueClient: fakeIssueClient({ getFails: true }) });

    await captureStdout(() => tagger.markEnqueued(['10']));

    expect(process.stderr.write).toHaveBeenCalledWith(
      'Warning: could not add \'enqueued\' tag to issue #10 on darthjee/arcanum\n'
    );
    expect(process.stderr.write).toHaveBeenCalledWith(
      'Warning: could not remove \'ready_for_work\' tag from issue #10 on darthjee/arcanum\n'
    );
    expect(process.stderr.write).toHaveBeenCalledWith(
      'Warning: could not remove \'created\' tag from issue #10 on darthjee/arcanum\n'
    );
  });

  it('rejects with a DispatchFailure (stdout "", exit code 1) when resolving the origin fails', async () => {
    const tagger = newTagger({ origin: { resolveWithRef: async () => { throw new Error('no origin'); } } });
    let thrown;

    try {
      await tagger.markEnqueued(['10']);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(DispatchFailure);
    expect(thrown.stdout).toEqual('');
    expect(thrown.exitCode).toEqual(1);
  });

  it('rejects with a DispatchFailure (stdout "", exit code 1) when resolving the github token fails', async () => {
    const tagger = newTagger({ githubToken: { get: async () => { throw new Error('no token'); } } });
    let thrown;

    try {
      await tagger.markEnqueued(['10']);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(DispatchFailure);
    expect(thrown.stdout).toEqual('');
    expect(thrown.exitCode).toEqual(1);
  });

  it('domain-qualifies the repo ref for a non-github.com origin', async () => {
    spyOn(process.stderr, 'write');

    const tagger = newTagger({
      origin: {
        resolveWithRef: async () => ({ domain: 'example.com', repo: REPO, repoRef: `example.com/${REPO}` })
      },
      issueClient: fakeIssueClient({ getFails: true })
    });

    await captureStdout(() => tagger.markEnqueued(['10']));

    expect(process.stderr.write).toHaveBeenCalledWith(
      'Warning: could not add \'enqueued\' tag to issue #10 on example.com/darthjee/arcanum\n'
    );
  });
});
