import DispatchFailure from '../../../../lib/utils/errors/DispatchFailure.js';
import { fakeIssueClient, newTagger, REPO } from '../../../support/factories/issueTagger.js';

describe('IssueTagger (label operations)', () => {
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
