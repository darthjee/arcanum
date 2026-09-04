import { fakeFetch, newWaitCi, stubRepoConfig } from '../../../support/factories/autoFixAllWaitCi.js';

describe('AutoFixAllWaitCi (ignored check patterns)', () => {
  describe('#run', () => {
    describe('ignored check patterns', () => {
      it('excludes matching check-runs (case-insensitively) from the passed/failed/total accounting', async () => {
        const sleepFn = jasmine.createSpy('sleep').and.resolveTo(undefined);
        const instance = newWaitCi({
          repoConfig: {
            getIgnoredCheckPatterns: jasmine.createSpy('getIgnoredCheckPatterns').and.resolveTo(['codacy'])
          },
          fetchFn: fakeFetch({
            checkRunsSequence: [
              [
                { name: 'Codacy Static Code Analysis', status: 'completed', conclusion: 'action_required' },
                { name: 'build', status: 'completed', conclusion: 'success' }
              ]
            ]
          }),
          sleepFn
        });

        await expectAsync(instance.run()).toBeResolvedTo('passed\n');
        expect(sleepFn).not.toHaveBeenCalled();
      });

      it('is read only once, not re-read on every poll iteration', async () => {
        const repoConfig = stubRepoConfig();
        const instance = newWaitCi({
          fetchFn: fakeFetch({
            checkRunsSequence: [
              [{ name: 'build', status: 'in_progress', conclusion: null }],
              [{ name: 'build', status: 'completed', conclusion: 'success' }]
            ]
          }),
          repoConfig,
          sleepFn: jasmine.createSpy('sleep').and.resolveTo(undefined)
        });

        await expectAsync(instance.run()).toBeResolvedTo('passed\n');
        expect(repoConfig.getIgnoredCheckPatterns).toHaveBeenCalledTimes(1);
      });
    });
  });
});
