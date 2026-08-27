import DispatchFailure from '../../../../lib/utils/errors/DispatchFailure.js';
import IssueTagger from '../../../../lib/utils/issue/IssueTagger.js';
import { createRepoContextMock } from '../../../support/factories/repoContextFactory.js';
import { captureStdout } from '../../../support/utils/captureStdout.js';

const REPO = 'darthjee/arcanum';

/**
 * Build a fake `IssueClient`, answering the 3 REST calls `IssueTagger`'s
 * label mutation makes per tag: `getIssue` (current labels), `addLabel`,
 * `removeLabel`.
 * @param {object} [opts] - behavior overrides.
 * @param {string[]} [opts.existingLabels] - the labels every `getIssue`
 *   call reports as already present.
 * @param {boolean} [opts.getFails] - whether `getIssue` fails.
 * @param {boolean} [opts.mutateFails] - whether every `addLabel`/
 *   `removeLabel` call fails.
 * @returns {object} a fake `IssueClient`.
 */
function fakeIssueClient({ existingLabels = ['Ready for Work', 'Created'], getFails = false, mutateFails = false } = {}) {
  return {
    getIssue: jasmine.createSpy().and.callFake(async () => {
      if (getFails) {
        throw new Error(`Error: could not fetch issue from ${REPO}`);
      }

      return { labels: existingLabels.map((name) => ({ name })) };
    }),
    addLabel: jasmine.createSpy().and.callFake(async () => {
      if (mutateFails) {
        throw new Error(`could not add label on ${REPO}`);
      }
    }),
    removeLabel: jasmine.createSpy().and.callFake(async () => {
      if (mutateFails) {
        throw new Error(`could not remove label on ${REPO}`);
      }
    })
  };
}

describe('IssueTagger', () => {
  function newTagger({ issueClient = fakeIssueClient(), ...contextOverrides } = {}) {
    const context = createRepoContextMock({
      origin: { resolveWithRef: async () => ({ domain: 'github.com', repo: REPO, repoRef: REPO }) },
      githubToken: { get: async () => 'fake-token' },
      ...contextOverrides
    });

    return new IssueTagger({ context, issueClient });
  }

  describe('#markEnqueued', () => {
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

  describe('#mutateTag', () => {
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

  describe('#fetchLabels', () => {
    it('returns the issue\'s current label names', async () => {
      const tagger = newTagger({ issueClient: fakeIssueClient({ existingLabels: ['Ready for Work', 'Created'] }) });

      await expectAsync(tagger.fetchLabels('10')).toBeResolvedTo(['Ready for Work', 'Created']);
    });

    it('rejects when the labels fetch fails', async () => {
      const tagger = newTagger({ issueClient: fakeIssueClient({ getFails: true }) });

      await expectAsync(tagger.fetchLabels('10')).toBeRejected();
    });
  });

  describe('#addLabel', () => {
    it('resolves when the add succeeds', async () => {
      const tagger = newTagger();

      await expectAsync(tagger.addLabel('10', 'Enqueued')).toBeResolved();
    });

    it('rejects when the add fails', async () => {
      const tagger = newTagger({ issueClient: fakeIssueClient({ mutateFails: true }) });

      await expectAsync(tagger.addLabel('10', 'Enqueued')).toBeRejected();
    });
  });

  describe('#removeLabel', () => {
    it('resolves when the remove succeeds', async () => {
      const tagger = newTagger();

      await expectAsync(tagger.removeLabel('10', 'Ready for Work')).toBeResolved();
    });

    it('rejects when the remove fails', async () => {
      const tagger = newTagger({ issueClient: fakeIssueClient({ mutateFails: true }) });

      await expectAsync(tagger.removeLabel('10', 'Ready for Work')).toBeRejected();
    });
  });

  describe('#hasLabel', () => {
    it('resolves true when the label is present (case-insensitive, exact match)', async () => {
      const tagger = newTagger({ issueClient: fakeIssueClient({ existingLabels: ['shipit'] }) });

      await expectAsync(tagger.hasLabel('10', 'ShipIt')).toBeResolvedTo(true);
    });

    it('resolves false when the label is absent', async () => {
      const tagger = newTagger({ issueClient: fakeIssueClient({ existingLabels: ['Created'] }) });

      await expectAsync(tagger.hasLabel('10', 'shipit')).toBeResolvedTo(false);
    });

    it('rejects with a plain Error (not DispatchFailure) when the labels fetch fails', async () => {
      const tagger = newTagger({ issueClient: fakeIssueClient({ getFails: true }) });
      let thrown;

      try {
        await tagger.hasLabel('10', 'shipit');
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(Error);
      expect(thrown).not.toBeInstanceOf(DispatchFailure);
    });
  });

  describe('#warnMutationFailure', () => {
    it('prints the add-side warning to stderr', () => {
      spyOn(process.stderr, 'write');

      const tagger = newTagger();

      tagger.warnMutationFailure('add', 'enqueued', '10', REPO);

      expect(process.stderr.write).toHaveBeenCalledWith(
        'Warning: could not add \'enqueued\' tag to issue #10 on darthjee/arcanum\n'
      );
    });

    it('prints the remove-side warning to stderr', () => {
      spyOn(process.stderr, 'write');

      const tagger = newTagger();

      tagger.warnMutationFailure('remove', 'ready_for_work', '10', REPO);

      expect(process.stderr.write).toHaveBeenCalledWith(
        'Warning: could not remove \'ready_for_work\' tag from issue #10 on darthjee/arcanum\n'
      );
    });
  });
});
