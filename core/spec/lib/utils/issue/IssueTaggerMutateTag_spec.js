import { fakeIssueClient, newTagger, REPO } from '../../../support/factories/issueTagger.js';
import { captureStdout } from '../../../support/utils/captureStdout.js';

describe('IssueTagger#mutateTag', () => {
  it('prints a "nothing to do" line to stdout and stops when adding an already-present label', async () => {
    const tagger = newTagger({ issueClient: fakeIssueClient({ existingLabels: ['Enqueued'] }) });

    const { stdout } = await captureStdout(() =>
      tagger.mutateTag('10', REPO, 'add', 'enqueued')
    );

    expect(stdout).toEqual('Tag \'enqueued\' already present on issue #10 — nothing to do.\n');
  });

  it('prints a "nothing to do" line to stdout and stops when removing an absent label', async () => {
    const tagger = newTagger({ issueClient: fakeIssueClient({ existingLabels: [] }) });

    const { stdout } = await captureStdout(() =>
      tagger.mutateTag('10', REPO, 'remove', 'ready_for_work')
    );

    expect(stdout).toEqual('Tag \'ready_for_work\' not present on issue #10 — nothing to do.\n');
  });

  it('prints a success line to stdout when adding a not-yet-present label', async () => {
    const tagger = newTagger({ issueClient: fakeIssueClient({ existingLabels: [] }) });

    const { stdout } = await captureStdout(() =>
      tagger.mutateTag('10', REPO, 'add', 'enqueued')
    );

    expect(stdout).toEqual('Added tag \'enqueued\' to issue #10 on darthjee/arcanum\n');
  });

  it('prints a success line to stdout when removing a present label', async () => {
    const tagger = newTagger({ issueClient: fakeIssueClient({ existingLabels: ['Ready for Work'] }) });

    const { stdout } = await captureStdout(() =>
      tagger.mutateTag('10', REPO, 'remove', 'ready_for_work')
    );

    expect(stdout).toEqual('Removed tag \'ready_for_work\' from issue #10 on darthjee/arcanum\n');
  });

  it('warns to stderr and prints nothing else when the labels fetch fails', async () => {
    spyOn(process.stderr, 'write');

    const tagger = newTagger({ issueClient: fakeIssueClient({ getFails: true }) });

    const { stdout } = await captureStdout(() =>
      tagger.mutateTag('10', REPO, 'add', 'enqueued')
    );

    expect(stdout).toEqual('');
    expect(process.stderr.write).toHaveBeenCalledWith(
      'Warning: could not add \'enqueued\' tag to issue #10 on darthjee/arcanum\n'
    );
  });

  it('warns to stderr and prints nothing else when the mutation itself fails', async () => {
    spyOn(process.stderr, 'write');

    const tagger = newTagger({ issueClient: fakeIssueClient({ existingLabels: [], mutateFails: true }) });

    const { stdout } = await captureStdout(() =>
      tagger.mutateTag('10', REPO, 'add', 'enqueued')
    );

    expect(stdout).toEqual('');
    expect(process.stderr.write).toHaveBeenCalledWith(
      'Warning: could not add \'enqueued\' tag to issue #10 on darthjee/arcanum\n'
    );
  });
});
