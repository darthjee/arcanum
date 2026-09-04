import { fakeFetch, newWaitCi, stubRepoConfig } from '../../../support/factories/autoFixAllWaitCi.js';

describe('AutoFixAllWaitCi (check-run outcomes)', () => {
  describe('#run', () => {
    describe('when zero check-runs are registered yet', () => {
      it('keeps polling until check-runs show up', async () => {
        const sleepFn = jasmine.createSpy('sleep').and.resolveTo(undefined);
        const instance = newWaitCi({
          fetchFn: fakeFetch({
            checkRunsSequence: [
              [],
              [{ name: 'build', status: 'completed', conclusion: 'success' }]
            ]
          }),
          repoConfig: stubRepoConfig(),
          sleepFn
        });

        await expectAsync(instance.run()).toBeResolvedTo('passed\n');
        expect(sleepFn).toHaveBeenCalledTimes(1);
        expect(sleepFn).toHaveBeenCalledWith(5000);
      });
    });

    describe('when every (non-ignored) check-run has completed successfully', () => {
      it('resolves with "passed\\n"', async () => {
        const instance = newWaitCi({
          fetchFn: fakeFetch({
            checkRunsSequence: [[
              { name: 'build', status: 'completed', conclusion: 'success' },
              { name: 'lint', status: 'completed', conclusion: 'success' }
            ]]
          }),
          repoConfig: stubRepoConfig()
        });

        await expectAsync(instance.run()).toBeResolvedTo('passed\n');
      });
    });

    describe('when a check-run has completed with a failure/cancelled/timed_out conclusion', () => {
      it('resolves with "failed\\n" plus each failed check-run\'s name', async () => {
        const instance = newWaitCi({
          fetchFn: fakeFetch({
            checkRunsSequence: [[
              { name: 'build', status: 'completed', conclusion: 'failure' },
              { name: 'lint', status: 'completed', conclusion: 'success' },
              { name: 'e2e', status: 'completed', conclusion: 'cancelled' },
              { name: 'deploy', status: 'completed', conclusion: 'timed_out' }
            ]]
          }),
          repoConfig: stubRepoConfig()
        });

        await expectAsync(instance.run()).toBeResolvedTo('failed\nbuild\ne2e\ndeploy\n');
      });
    });

    describe('when a check-run is still pending', () => {
      it('keeps polling until every check-run has completed', async () => {
        const sleepFn = jasmine.createSpy('sleep').and.resolveTo(undefined);
        const instance = newWaitCi({
          fetchFn: fakeFetch({
            checkRunsSequence: [
              [{ name: 'build', status: 'in_progress', conclusion: null }],
              [{ name: 'build', status: 'completed', conclusion: 'success' }]
            ]
          }),
          repoConfig: stubRepoConfig(),
          sleepFn
        });

        await expectAsync(instance.run()).toBeResolvedTo('passed\n');
        expect(sleepFn).toHaveBeenCalledTimes(1);
      });
    });
  });
});
