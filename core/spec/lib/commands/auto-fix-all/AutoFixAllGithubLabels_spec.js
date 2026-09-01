import DispatchFailure from '../../../../lib/utils/errors/DispatchFailure.js';
import {
  createAutoFixAllGithub,
  fakeGithubFetch,
  REPO
} from '../../../support/factories/autoFixAllGithub.js';

describe('AutoFixAllGithub (label subcommands)', () => {
  describe('#hasShipitLabel', () => {
    it('rejects when repoPath is missing', async () => {
      const github = createAutoFixAllGithub({ repoPath: '' });

      await expectAsync(github.hasShipitLabel('5')).toBeRejectedWithError(
        'Usage: github.sh has-shipit-label <repo_path> <id>'
      );
    });

    it('rejects when id is missing', async () => {
      const github = createAutoFixAllGithub();

      await expectAsync(github.hasShipitLabel()).toBeRejectedWithError(
        'Usage: github.sh has-shipit-label <repo_path> <id>'
      );
    });

    it('resolves for a case-insensitive exact "shipit" label match', async () => {
      const github = createAutoFixAllGithub({ fetchFn: fakeGithubFetch({ labels: ['Shipit', 'Other'] }) });

      await expectAsync(github.hasShipitLabel('5')).toBeResolvedTo('');
    });

    it('rejects with an empty-stdout DispatchFailure (exit 1) when the label is absent', async () => {
      const github = createAutoFixAllGithub({ fetchFn: fakeGithubFetch({ labels: ['Other'] }) });
      let thrown;

      try {
        await github.hasShipitLabel('5');
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(DispatchFailure);
      expect(thrown.stdout).toEqual('');
      expect(thrown.exitCode).toEqual(1);
    });

    it('rejects with an empty-stdout DispatchFailure (exit 1) when the labels fetch fails', async () => {
      const github = createAutoFixAllGithub({ fetchFn: fakeGithubFetch({ issueViewFails: true }) });
      let thrown;

      try {
        await github.hasShipitLabel('5');
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(DispatchFailure);
      expect(thrown.stdout).toEqual('');
      expect(thrown.exitCode).toEqual(1);
    });
  });

  describe('#addTag', () => {
    it('rejects when repoPath, id, or tag is missing', async () => {
      const github = createAutoFixAllGithub();

      await expectAsync(github.addTag('5')).toBeRejectedWithError(
        'Usage: github.sh add-tag <repo_path> <id> <tag>'
      );
    });

    it('rejects shipit with the human-only guard message', async () => {
      const github = createAutoFixAllGithub();

      await expectAsync(github.addTag('5', 'shipit')).toBeRejectedWithError(
        'Error: shipit is human-only; scripts must not add or remove it'
      );
    });

    it('prints a "nothing to do" line, without mutating, when the label is already present', async () => {
      const fetchFn = fakeGithubFetch({ labels: ['Ready for Work'] });
      const github = createAutoFixAllGithub({ fetchFn });

      await expectAsync(github.addTag('5', 'ready_for_work')).toBeResolvedTo(
        'Tag \'ready_for_work\' already present on issue #5 — nothing to do.\n'
      );
      expect(fetchFn.calls.allArgs().some(([, options = {}]) => options.method === 'POST')).toBeFalse();
    });

    it('adds the mapped GitHub label and prints the confirmation line', async () => {
      const fetchFn = fakeGithubFetch({ labels: [] });
      const github = createAutoFixAllGithub({ fetchFn });

      await expectAsync(github.addTag('5', 'ready_for_work')).toBeResolvedTo(
        'Added tag \'ready_for_work\' to issue #5 on darthjee/arcanum\n'
      );

      const postCall = fetchFn.calls.allArgs().find(([, options]) => options.method === 'POST');

      expect(postCall[0]).toEqual(`https://api.github.com/repos/${REPO}/issues/5/labels`);
      expect(JSON.parse(postCall[1].body)).toEqual({ labels: ['Ready for Work'] });
    });

    it('rejects with the fetch-failure error when the current labels cannot be fetched', async () => {
      const github = createAutoFixAllGithub({ fetchFn: fakeGithubFetch({ issueViewFails: true }) });

      await expectAsync(github.addTag('5', 'ready_for_work')).toBeRejectedWithError(
        'Error: could not fetch issue #5 from darthjee/arcanum'
      );
    });

    it('rejects with the update-failure error when the add-label call fails', async () => {
      const github = createAutoFixAllGithub({ fetchFn: fakeGithubFetch({ labels: [], mutateOk: false }) });

      await expectAsync(github.addTag('5', 'ready_for_work')).toBeRejectedWithError(
        'Error: could not update issue #5 on darthjee/arcanum'
      );
    });
  });

  describe('#removeTag', () => {
    it('rejects when repoPath, id, or tag is missing', async () => {
      const github = createAutoFixAllGithub();

      await expectAsync(github.removeTag('5')).toBeRejectedWithError(
        'Usage: github.sh remove-tag <repo_path> <id> <tag>'
      );
    });

    it('rejects shipit with the human-only guard message', async () => {
      const github = createAutoFixAllGithub();

      await expectAsync(github.removeTag('5', 'shipit')).toBeRejectedWithError(
        'Error: shipit is human-only; scripts must not add or remove it'
      );
    });

    it('prints a "nothing to do" line, without mutating, when the label is already absent', async () => {
      const fetchFn = fakeGithubFetch({ labels: [] });
      const github = createAutoFixAllGithub({ fetchFn });

      await expectAsync(github.removeTag('5', 'ready_for_work')).toBeResolvedTo(
        'Tag \'ready_for_work\' not present on issue #5 — nothing to do.\n'
      );
      expect(fetchFn.calls.allArgs().some(([, options = {}]) => options.method === 'DELETE')).toBeFalse();
    });

    it('removes the mapped GitHub label and prints the confirmation line', async () => {
      const fetchFn = fakeGithubFetch({ labels: ['Ready for Work'] });
      const github = createAutoFixAllGithub({ fetchFn });

      await expectAsync(github.removeTag('5', 'ready_for_work')).toBeResolvedTo(
        'Removed tag \'ready_for_work\' from issue #5 on darthjee/arcanum\n'
      );

      const deleteCall = fetchFn.calls.allArgs().find(([, options]) => options.method === 'DELETE');

      expect(deleteCall[0]).toEqual(`https://api.github.com/repos/${REPO}/issues/5/labels/Ready%20for%20Work`);
    });

    it('rejects with the fetch-failure error when the current labels cannot be fetched', async () => {
      const github = createAutoFixAllGithub({ fetchFn: fakeGithubFetch({ issueViewFails: true }) });

      await expectAsync(github.removeTag('5', 'ready_for_work')).toBeRejectedWithError(
        'Error: could not fetch issue #5 from darthjee/arcanum'
      );
    });

    it('rejects with the update-failure error when the remove-label call fails', async () => {
      const github = createAutoFixAllGithub({ fetchFn: fakeGithubFetch({ labels: ['Ready for Work'], mutateOk: false }) });

      await expectAsync(github.removeTag('5', 'ready_for_work')).toBeRejectedWithError(
        'Error: could not update issue #5 on darthjee/arcanum'
      );
    });
  });
});
