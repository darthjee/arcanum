import { fakeExecFileAsync, fakeFetch, newWaitCi, REPO, stubRepoConfig } from '../../../support/factories/autoFixAllWaitCi.js';

describe('AutoFixAllWaitCi (usage & no PR)', () => {
  describe('#run', () => {
    it('throws the usage message when repo_path is missing', async () => {
      const execFileAsync = fakeExecFileAsync();
      const instance = newWaitCi({ repoPath: '', execFileAsync, repoConfig: stubRepoConfig() });

      await expectAsync(instance.run()).toBeRejectedWithError('Usage: wait_ci.sh <repo_path>');
      expect(execFileAsync).not.toHaveBeenCalled();
    });

    describe('when no pull request is found for the current branch', () => {
      it('throws the same error message the shell script prints', async () => {
        const instance = newWaitCi({ fetchFn: fakeFetch({ pulls: [] }), repoConfig: stubRepoConfig() });

        await expectAsync(instance.run()).toBeRejectedWithError(
          `Error: no pull request found for the current branch on ${REPO}`
        );
      });

      it('also throws when the pulls lookup itself fails', async () => {
        const instance = newWaitCi({
          fetchFn: jasmine.createSpy('fetch').and.rejectWith(new Error('network down')),
          repoConfig: stubRepoConfig()
        });

        await expectAsync(instance.run()).toBeRejectedWithError(
          `Error: no pull request found for the current branch on ${REPO}`
        );
      });
    });
  });
});
