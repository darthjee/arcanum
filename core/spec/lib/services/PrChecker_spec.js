import PrChecker from '../../../lib/services/PrChecker.js';
import SafeFetcher from '../../../lib/utils/safe/SafeFetcher.js';

const PR_NUMBER = 7;
const SHA = 'abc123';

describe('PrChecker', () => {
  function newChecker({ headSha = SHA, checkRuns = [], safeFetcher = new SafeFetcher() } = {}) {
    const prOperations = {
      headSha: jasmine.createSpy().and.callFake(async () => {
        if (headSha instanceof Error) {
          throw headSha;
        }

        return headSha;
      }),
      checkRuns: jasmine.createSpy().and.callFake(async () => {
        if (checkRuns instanceof Error) {
          throw checkRuns;
        }

        return checkRuns;
      })
    };
    const prChecker = new PrChecker({ prOperations, safeFetcher });

    return { prChecker, prOperations };
  }

  describe('#pollOnce', () => {
    it('returns "passed\\n" when every check-run has completed successfully', async () => {
      const checkRuns = [
        { name: 'build', status: 'completed', conclusion: 'success' },
        { name: 'test', status: 'completed', conclusion: 'success' }
      ];
      const { prChecker } = newChecker({ checkRuns });

      await expectAsync(prChecker.pollOnce(PR_NUMBER, [])).toBeResolvedTo('passed\n');
    });

    it('returns "failed\\n<names>\\n" when some check-runs failed/cancelled/timed out', async () => {
      const checkRuns = [
        { name: 'build', status: 'completed', conclusion: 'failure' },
        { name: 'test', status: 'completed', conclusion: 'success' },
        { name: 'lint', status: 'completed', conclusion: 'cancelled' }
      ];
      const { prChecker } = newChecker({ checkRuns });

      await expectAsync(prChecker.pollOnce(PR_NUMBER, [])).toBeResolvedTo('failed\nbuild\nlint\n');
    });

    it('returns null when some check-runs are still pending', async () => {
      const checkRuns = [
        { name: 'build', status: 'completed', conclusion: 'success' },
        { name: 'test', status: 'in_progress', conclusion: null }
      ];
      const { prChecker } = newChecker({ checkRuns });

      await expectAsync(prChecker.pollOnce(PR_NUMBER, [])).toBeResolvedTo(null);
    });

    it('returns null when the check-runs array is empty', async () => {
      const { prChecker } = newChecker({ checkRuns: [] });

      await expectAsync(prChecker.pollOnce(PR_NUMBER, [])).toBeResolvedTo(null);
    });

    it('excludes check-runs whose name matches an ignored pattern', async () => {
      const checkRuns = [
        { name: 'flaky-job', status: 'in_progress', conclusion: null },
        { name: 'build', status: 'completed', conclusion: 'success' }
      ];
      const { prChecker } = newChecker({ checkRuns });

      await expectAsync(prChecker.pollOnce(PR_NUMBER, ['^flaky-'])).toBeResolvedTo('passed\n');
    });

    it('returns null when everything is ignored, leaving an empty filtered set', async () => {
      const checkRuns = [{ name: 'flaky-job', status: 'completed', conclusion: 'success' }];
      const { prChecker } = newChecker({ checkRuns });

      await expectAsync(prChecker.pollOnce(PR_NUMBER, ['^flaky-'])).toBeResolvedTo(null);
    });

    it('returns null when prOperations.headSha() throws, via safeFetcher', async () => {
      const { prChecker, prOperations } = newChecker({ headSha: new Error('boom') });

      await expectAsync(prChecker.pollOnce(PR_NUMBER, [])).toBeResolvedTo(null);
      expect(prOperations.checkRuns).not.toHaveBeenCalled();
    });

    it('returns null when prOperations.checkRuns() throws, via safeFetcher', async () => {
      const { prChecker } = newChecker({ checkRuns: new Error('boom') });

      await expectAsync(prChecker.pollOnce(PR_NUMBER, [])).toBeResolvedTo(null);
    });

    it('returns null when an ignored pattern is malformed regex', async () => {
      const checkRuns = [{ name: 'build', status: 'completed', conclusion: 'success' }];
      const { prChecker } = newChecker({ checkRuns });

      await expectAsync(prChecker.pollOnce(PR_NUMBER, ['('])).toBeResolvedTo(null);
    });
  });
});
