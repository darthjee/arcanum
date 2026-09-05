import { fakeFetch, newWaitCi, stubRepoConfig, TOKEN } from '../../../support/factories/autoFixAllWaitCi.js';

describe('AutoFixAllWaitCi (transient errors & auth)', () => {
  describe('#run', () => {
    describe('transient fetch/API errors', () => {
      it('retries (does not raise) when the head-commit fetch is not ok', async () => {
        const sleepFn = jasmine.createSpy('sleep').and.resolveTo(undefined);
        const instance = newWaitCi({
          fetchFn: fakeFetch({
            headSequence: [{ ok: false }, 'sha-1'],
            checkRunsSequence: [[{ name: 'build', status: 'completed', conclusion: 'success' }]]
          }),
          repoConfig: stubRepoConfig(),
          sleepFn
        });

        await expectAsync(instance.run()).toBeResolvedTo('passed\n');
        expect(sleepFn).toHaveBeenCalledTimes(1);
      });

      it('retries (does not raise) when the check-runs fetch is not ok', async () => {
        const sleepFn = jasmine.createSpy('sleep').and.resolveTo(undefined);
        const instance = newWaitCi({
          fetchFn: fakeFetch({
            checkRunsSequence: [
              { ok: false },
              { ok: true, json: async () => ({ check_runs: [{ name: 'build', status: 'completed', conclusion: 'success' }] }) }
            ]
          }),
          repoConfig: stubRepoConfig(),
          sleepFn
        });

        await expectAsync(instance.run()).toBeResolvedTo('passed\n');
        expect(sleepFn).toHaveBeenCalledTimes(1);
      });

      it('retries (does not raise) when a poll-loop fetch call rejects outright', async () => {
        let calls = 0;
        const fetchFn = jasmine.createSpy('fetch').and.callFake(async (url) => {
          if (url.includes('/pulls?head=')) {
            return { ok: true, json: async () => [{ number: 7 }] };
          }

          if (/\/pulls\/\d+$/.test(url)) {
            calls += 1;

            if (calls === 1) {
              throw new Error('network down');
            }

            return { ok: true, json: async () => ({ head: { sha: 'sha-1' } }) };
          }

          return { ok: true, json: async () => ({ check_runs: [{ name: 'build', status: 'completed', conclusion: 'success' }] }) };
        });
        const sleepFn = jasmine.createSpy('sleep').and.resolveTo(undefined);
        const instance = newWaitCi({ fetchFn, repoConfig: stubRepoConfig(), sleepFn });

        await expectAsync(instance.run()).toBeResolvedTo('passed\n');
        expect(sleepFn).toHaveBeenCalledTimes(1);
      });

      // A malformed ignored-pattern regex's "keep polling instead of
      // raising" behavior (matching the shell's own "hang forever unless
      // ignored" behavior for this case) is now covered at the
      // `PrChecker` layer — see
      // `core/spec/lib/services/PrChecker_spec.js`'s "returns null when
      // an ignored pattern is malformed regex" — since `#_pollOnce` no
      // longer exists on `AutoFixAllWaitCi` to call directly, and
      // exercising it through `run()` would loop forever (the malformed
      // pattern never resolves).
    });

    it('sends the resolved GitHub token as a bearer header on every REST call', async () => {
      const fetchFn = fakeFetch({
        checkRunsSequence: [[{ name: 'build', status: 'completed', conclusion: 'success' }]]
      });
      const instance = newWaitCi({ fetchFn, repoConfig: stubRepoConfig() });

      await instance.run();

      fetchFn.calls.allArgs().forEach(([, options]) => {
        expect(options.headers.Authorization).toEqual(`Bearer ${TOKEN}`);
      });
    });
  });
});
