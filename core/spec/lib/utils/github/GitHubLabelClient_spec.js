import GitHubLabelClient from '../../../../lib/utils/github/GitHubLabelClient.js';
import { newFocusedClient, REPO, TOKEN } from '../../../support/factories/githubClient.js';
import { fakeRepoLabelsFetch } from '../../../support/utils/fakeFetch.js';

const newClient = (fetchFn) => newFocusedClient(GitHubLabelClient, fetchFn);
const labelsUrl = (page) => `https://api.github.com/repos/${REPO}/labels?per_page=100&page=${page}`;

describe('GitHubLabelClient', () => {
  describe('#listLabelNames', () => {
    it('returns a single short page', async () => {
      const fetchFn = fakeRepoLabelsFetch({ labels: ['bug', 'Ready for Work'] });

      await expectAsync(newClient(fetchFn).listLabelNames()).toBeResolvedTo(['bug', 'Ready for Work']);
      expect(fetchFn).toHaveBeenCalledOnceWith(
        labelsUrl(1),
        jasmine.objectContaining({ headers: { Authorization: `Bearer ${TOKEN}` } })
      );
    });

    it('paginates across more than 100 labels until a short page', async () => {
      const labels = Array.from({ length: 205 }, (_, index) => `label-${index}`);
      const fetchFn = fakeRepoLabelsFetch({ labels });

      await expectAsync(newClient(fetchFn).listLabelNames()).toBeResolvedTo(labels);
      expect(fetchFn.calls.allArgs().map(([url]) => url)).toEqual([labelsUrl(1), labelsUrl(2), labelsUrl(3)]);
    });

    it('requests one extra empty page for an exact multiple of 100', async () => {
      const labels = Array.from({ length: 100 }, (_, index) => `label-${index}`);
      const fetchFn = fakeRepoLabelsFetch({ labels });

      await expectAsync(newClient(fetchFn).listLabelNames()).toBeResolvedTo(labels);
      expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    it('skips entries without a string name', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: true, json: async () => [{ name: 'a' }, null, { name: 3 }] });

      await expectAsync(newClient(fetchFn).listLabelNames()).toBeResolvedTo(['a']);
    });

    it('throws naming the repo ref on failure', async () => {
      const fetchFn = fakeRepoLabelsFetch({ listFails: true });

      await expectAsync(newClient(fetchFn).listLabelNames()).toBeRejectedWithError(
        `Error: could not list labels on ${REPO}`
      );
    });
  });

  describe('#createLabel', () => {
    it('POSTs {name, color}', async () => {
      const fetchFn = fakeRepoLabelsFetch();

      await expectAsync(newClient(fetchFn).createLabel('Ready for Work', 'ffaa04')).toBeResolved();
      expect(fetchFn).toHaveBeenCalledOnceWith(
        `https://api.github.com/repos/${REPO}/labels`,
        jasmine.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Ready for Work', color: 'ffaa04' }) })
      );
    });

    it('throws naming the label and repo ref on failure', async () => {
      const fetchFn = fakeRepoLabelsFetch({ writeFails: true });

      await expectAsync(newClient(fetchFn).createLabel('Bug', 'b60205')).toBeRejectedWithError(
        `Error: could not create label 'Bug' on ${REPO}`
      );
    });
  });

  describe('#updateLabel', () => {
    it('PATCHes the URL-encoded existing name with {new_name, color}', async () => {
      const fetchFn = fakeRepoLabelsFetch();

      await expectAsync(newClient(fetchFn).updateLabel('ready for work', 'Ready for Work', 'ffaa04')).toBeResolved();
      expect(fetchFn).toHaveBeenCalledOnceWith(
        `https://api.github.com/repos/${REPO}/labels/ready%20for%20work`,
        jasmine.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ new_name: 'Ready for Work', color: 'ffaa04' })
        })
      );
    });

    it('throws naming the label and repo ref on failure', async () => {
      const fetchFn = fakeRepoLabelsFetch({ writeFails: true });

      await expectAsync(newClient(fetchFn).updateLabel('bug', 'Bug', 'b60205')).toBeRejectedWithError(
        `Error: could not update label 'bug' on ${REPO}`
      );
    });
  });
});
