import TagMutationService from '../../../lib/services/TagMutationService.js';
import { TAG_TO_LABEL } from '../../../lib/utils/issue/Tags.js';

const REPO_REF = 'darthjee/arcanum';
const ID = '5';
const TAG = 'ready_for_work';
const LABEL = TAG_TO_LABEL[TAG];

describe('TagMutationService', () => {
  function newService({ labels = [], addLabel, removeLabel } = {}) {
    const issueTagger = {
      fetchLabels: jasmine.createSpy('fetchLabels').and.callFake(async () => {
        if (labels instanceof Error) {
          throw labels;
        }

        return labels;
      }),
      addLabel: addLabel || jasmine.createSpy('addLabel').and.resolveTo(undefined),
      removeLabel: removeLabel || jasmine.createSpy('removeLabel').and.resolveTo(undefined)
    };
    const context = { resolveWithRef: jasmine.createSpy('resolveWithRef').and.resolveTo({ repoRef: REPO_REF }) };
    const service = new TagMutationService({ issueTagger, context });

    return { service, issueTagger, context };
  }

  describe('#addTag', () => {
    it('returns a "nothing to do" line without mutating when the label is already present', async () => {
      const { service, issueTagger } = newService({ labels: [LABEL] });

      await expectAsync(service.addTag(ID, TAG)).toBeResolvedTo(
        `Tag '${TAG}' already present on issue #${ID} — nothing to do.\n`
      );
      expect(issueTagger.addLabel).not.toHaveBeenCalled();
    });

    it('adds the mapped label and returns the confirmation line', async () => {
      const { service, issueTagger } = newService({ labels: [] });

      await expectAsync(service.addTag(ID, TAG)).toBeResolvedTo(
        `Added tag '${TAG}' to issue #${ID} on ${REPO_REF}\n`
      );
      expect(issueTagger.addLabel).toHaveBeenCalledWith(ID, LABEL);
    });

    it('rejects with the update-failure error when addLabel throws', async () => {
      const { service } = newService({
        labels: [],
        addLabel: jasmine.createSpy('addLabel').and.rejectWith(new Error('boom'))
      });

      await expectAsync(service.addTag(ID, TAG)).toBeRejectedWithError(
        `Error: could not update issue #${ID} on ${REPO_REF}`
      );
    });
  });

  describe('#removeTag', () => {
    it('returns a "nothing to do" line without mutating when the label is absent', async () => {
      const { service, issueTagger } = newService({ labels: [] });

      await expectAsync(service.removeTag(ID, TAG)).toBeResolvedTo(
        `Tag '${TAG}' not present on issue #${ID} — nothing to do.\n`
      );
      expect(issueTagger.removeLabel).not.toHaveBeenCalled();
    });

    it('removes the mapped label and returns the confirmation line', async () => {
      const { service, issueTagger } = newService({ labels: [LABEL] });

      await expectAsync(service.removeTag(ID, TAG)).toBeResolvedTo(
        `Removed tag '${TAG}' from issue #${ID} on ${REPO_REF}\n`
      );
      expect(issueTagger.removeLabel).toHaveBeenCalledWith(ID, LABEL);
    });

    it('rejects with the update-failure error when removeLabel throws', async () => {
      const { service } = newService({
        labels: [LABEL],
        removeLabel: jasmine.createSpy('removeLabel').and.rejectWith(new Error('boom'))
      });

      await expectAsync(service.removeTag(ID, TAG)).toBeRejectedWithError(
        `Error: could not update issue #${ID} on ${REPO_REF}`
      );
    });
  });

  describe('shipit guard', () => {
    it('rejects with the verbatim human-only error before fetching labels', async () => {
      const { service, issueTagger } = newService();

      await expectAsync(service.addTag(ID, 'shipit')).toBeRejectedWithError(
        'Error: shipit is human-only; scripts must not add or remove it'
      );
      await expectAsync(service.removeTag(ID, 'shipit')).toBeRejectedWithError(
        'Error: shipit is human-only; scripts must not add or remove it'
      );
      expect(issueTagger.fetchLabels).not.toHaveBeenCalled();
    });
  });

  describe('fetch failure', () => {
    it('rejects with the fetch-failure error when fetchLabels throws', async () => {
      const { service } = newService({ labels: new Error('nope') });

      await expectAsync(service.addTag(ID, TAG)).toBeRejectedWithError(
        `Error: could not fetch issue #${ID} from ${REPO_REF}`
      );
    });
  });

  describe('no writes', () => {
    it('returns a string and writes nothing to stdout/stderr', async () => {
      const { service } = newService({ labels: [] });
      const stdout = spyOn(process.stdout, 'write').and.callThrough();
      const stderr = spyOn(process.stderr, 'write').and.callThrough();

      const result = await service.addTag(ID, TAG);

      expect(typeof result).toEqual('string');
      expect(stdout).not.toHaveBeenCalled();
      expect(stderr).not.toHaveBeenCalled();
    });
  });
});
