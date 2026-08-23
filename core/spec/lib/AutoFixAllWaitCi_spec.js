import AutoFixAllWaitCi from '../../lib/AutoFixAllWaitCi.js';

const REPO_PATH = '/repo/path';
const REPO = 'darthjee/arcanum';
const BRANCH = 'issue-42';
const TOKEN = 'fake-token';

/**
 * Build a fake `execFileAsync` implementation answering the single
 * `git branch --show-current` call `AutoFixAllWaitCi` makes.
 * @param {object} [opts] - behavior overrides.
 * @param {string} [opts.branch] - the branch `git branch --show-current`
 *   reports.
 * @returns {Function} a jasmine spy usable as `execFileAsync`.
 */
function fakeExecFileAsync({ branch = BRANCH } = {}) {
  return jasmine.createSpy('execFileAsync').and.callFake(async (file, args = []) => {
    if (file === 'git' && args[2] === 'branch') {
      return { stdout: `${branch}\n` };
    }

    throw new Error(`unexpected execFileAsync call: ${file} ${JSON.stringify(args)}`);
  });
}

/**
 * Build a fake `fetch` implementation answering the three REST calls
 * `AutoFixAllWaitCi` makes: resolving the PR number (`GET .../pulls?head=...`),
 * fetching the PR's head commit (`GET .../pulls/<number>`), and fetching
 * that commit's check-runs (`GET .../commits/<sha>/check-runs`). Each of
 * the latter two supports a per-call sequence of responses, so a spec
 * can exercise multiple poll iterations deterministically without a real
 * 5s wait.
 * @param {object} [opts] - behavior overrides.
 * @param {Array|Function} [opts.pulls] - the `pulls?head=...` response
 *   body (an array of `{ number }`), or a function returning one.
 * @param {Array<Array|Function>} [opts.headSequence] - one response
 *   (`{ ok, json }`-shaped, or a plain sha to wrap as `{ head: { sha } }`)
 *   per successive `pulls/<number>` call; the last entry repeats once
 *   exhausted.
 * @param {Array} [opts.checkRunsSequence] - one response per successive
 *   `check-runs` call (an array of check-run objects, or a function
 *   returning `{ ok, json }` directly for transient-error simulation);
 *   the last entry repeats once exhausted.
 * @returns {Function} a jasmine spy usable as `fetchFn`.
 */
function fakeFetch({ pulls = [{ number: 7 }], headSequence = ['sha-1'], checkRunsSequence = [[]] } = {}) {
  let headCallIndex = 0;
  let checkRunsCallIndex = 0;

  return jasmine.createSpy('fetch').and.callFake(async (url) => {
    if (url.includes('/pulls?head=')) {
      return { ok: true, json: async () => pulls };
    }

    if (/\/pulls\/\d+$/.test(url)) {
      const entry = headSequence[Math.min(headCallIndex, headSequence.length - 1)];

      headCallIndex += 1;

      if (entry && typeof entry === 'object' && 'ok' in entry) {
        return entry;
      }

      return { ok: true, json: async () => ({ head: { sha: entry } }) };
    }

    if (url.includes('/check-runs')) {
      const entry = checkRunsSequence[Math.min(checkRunsCallIndex, checkRunsSequence.length - 1)];

      checkRunsCallIndex += 1;

      if (entry && typeof entry === 'object' && !Array.isArray(entry) && 'ok' in entry) {
        return entry;
      }

      return { ok: true, json: async () => ({ check_runs: entry }) };
    }

    throw new Error(`unexpected fetch call: ${url}`);
  });
}

/**
 * @param {object} [overrides] - collaborator overrides.
 * @returns {object} a set of stub collaborators for AutoFixAllWaitCi.
 */
function stubDeps(overrides = {}) {
  return {
    origin: { resolve: async () => ({ domain: 'github.com', repo: REPO }) },
    githubToken: { get: async () => TOKEN },
    repoConfig: { getIgnoredCheckPatterns: jasmine.createSpy('getIgnoredCheckPatterns').and.resolveTo([]) },
    execFileAsync: fakeExecFileAsync(),
    fetchFn: fakeFetch(),
    sleepFn: jasmine.createSpy('sleep').and.resolveTo(undefined),
    pollIntervalMs: 5000,
    ...overrides
  };
}

describe('AutoFixAllWaitCi', () => {
  describe('#run', () => {
    it('throws the usage message when repo_path is missing', async () => {
      const deps = stubDeps();
      const instance = new AutoFixAllWaitCi(deps);

      await expectAsync(instance.run('')).toBeRejectedWithError('Usage: wait_ci.sh <repo_path>');
      expect(deps.execFileAsync).not.toHaveBeenCalled();
    });

    describe('when no pull request is found for the current branch', () => {
      it('throws the same error message the shell script prints', async () => {
        const deps = stubDeps({ fetchFn: fakeFetch({ pulls: [] }) });
        const instance = new AutoFixAllWaitCi(deps);

        await expectAsync(instance.run(REPO_PATH)).toBeRejectedWithError(
          `Error: no pull request found for the current branch on ${REPO}`
        );
      });

      it('also throws when the pulls lookup itself fails', async () => {
        const deps = stubDeps({
          fetchFn: jasmine.createSpy('fetch').and.rejectWith(new Error('network down'))
        });
        const instance = new AutoFixAllWaitCi(deps);

        await expectAsync(instance.run(REPO_PATH)).toBeRejectedWithError(
          `Error: no pull request found for the current branch on ${REPO}`
        );
      });
    });

    describe('when zero check-runs are registered yet', () => {
      it('keeps polling until check-runs show up', async () => {
        const deps = stubDeps({
          fetchFn: fakeFetch({
            checkRunsSequence: [
              [],
              [{ name: 'build', status: 'completed', conclusion: 'success' }]
            ]
          })
        });
        const instance = new AutoFixAllWaitCi(deps);

        await expectAsync(instance.run(REPO_PATH)).toBeResolvedTo('passed\n');
        expect(deps.sleepFn).toHaveBeenCalledTimes(1);
        expect(deps.sleepFn).toHaveBeenCalledWith(5000);
      });
    });

    describe('ignored check patterns', () => {
      it('excludes matching check-runs (case-insensitively) from the passed/failed/total accounting', async () => {
        const deps = stubDeps({
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
          })
        });
        const instance = new AutoFixAllWaitCi(deps);

        await expectAsync(instance.run(REPO_PATH)).toBeResolvedTo('passed\n');
        expect(deps.sleepFn).not.toHaveBeenCalled();
      });

      it('is read only once, not re-read on every poll iteration', async () => {
        const deps = stubDeps({
          fetchFn: fakeFetch({
            checkRunsSequence: [
              [{ name: 'build', status: 'in_progress', conclusion: null }],
              [{ name: 'build', status: 'completed', conclusion: 'success' }]
            ]
          })
        });
        const instance = new AutoFixAllWaitCi(deps);

        await expectAsync(instance.run(REPO_PATH)).toBeResolvedTo('passed\n');
        expect(deps.repoConfig.getIgnoredCheckPatterns).toHaveBeenCalledTimes(1);
      });
    });

    describe('when every (non-ignored) check-run has completed successfully', () => {
      it('resolves with "passed\\n"', async () => {
        const deps = stubDeps({
          fetchFn: fakeFetch({
            checkRunsSequence: [[
              { name: 'build', status: 'completed', conclusion: 'success' },
              { name: 'lint', status: 'completed', conclusion: 'success' }
            ]]
          })
        });
        const instance = new AutoFixAllWaitCi(deps);

        await expectAsync(instance.run(REPO_PATH)).toBeResolvedTo('passed\n');
      });
    });

    describe('when a check-run has completed with a failure/cancelled/timed_out conclusion', () => {
      it('resolves with "failed\\n" plus each failed check-run\'s name', async () => {
        const deps = stubDeps({
          fetchFn: fakeFetch({
            checkRunsSequence: [[
              { name: 'build', status: 'completed', conclusion: 'failure' },
              { name: 'lint', status: 'completed', conclusion: 'success' },
              { name: 'e2e', status: 'completed', conclusion: 'cancelled' },
              { name: 'deploy', status: 'completed', conclusion: 'timed_out' }
            ]]
          })
        });
        const instance = new AutoFixAllWaitCi(deps);

        await expectAsync(instance.run(REPO_PATH)).toBeResolvedTo('failed\nbuild\ne2e\ndeploy\n');
      });
    });

    describe('when a check-run is still pending', () => {
      it('keeps polling until every check-run has completed', async () => {
        const deps = stubDeps({
          fetchFn: fakeFetch({
            checkRunsSequence: [
              [{ name: 'build', status: 'in_progress', conclusion: null }],
              [{ name: 'build', status: 'completed', conclusion: 'success' }]
            ]
          })
        });
        const instance = new AutoFixAllWaitCi(deps);

        await expectAsync(instance.run(REPO_PATH)).toBeResolvedTo('passed\n');
        expect(deps.sleepFn).toHaveBeenCalledTimes(1);
      });
    });

    describe('transient fetch/API errors', () => {
      it('retries (does not raise) when the head-commit fetch is not ok', async () => {
        const deps = stubDeps({
          fetchFn: fakeFetch({
            headSequence: [{ ok: false }, 'sha-1'],
            checkRunsSequence: [[{ name: 'build', status: 'completed', conclusion: 'success' }]]
          })
        });
        const instance = new AutoFixAllWaitCi(deps);

        await expectAsync(instance.run(REPO_PATH)).toBeResolvedTo('passed\n');
        expect(deps.sleepFn).toHaveBeenCalledTimes(1);
      });

      it('retries (does not raise) when the check-runs fetch is not ok', async () => {
        const deps = stubDeps({
          fetchFn: fakeFetch({
            checkRunsSequence: [
              { ok: false },
              { ok: true, json: async () => ({ check_runs: [{ name: 'build', status: 'completed', conclusion: 'success' }] }) }
            ]
          })
        });
        const instance = new AutoFixAllWaitCi(deps);

        await expectAsync(instance.run(REPO_PATH)).toBeResolvedTo('passed\n');
        expect(deps.sleepFn).toHaveBeenCalledTimes(1);
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
        const deps = stubDeps({ fetchFn });
        const instance = new AutoFixAllWaitCi(deps);

        await expectAsync(instance.run(REPO_PATH)).toBeResolvedTo('passed\n');
        expect(deps.sleepFn).toHaveBeenCalledTimes(1);
      });

      it('does not raise when an ignored-pattern regex is malformed — keeps polling instead (#_pollOnce directly, matching the shell\'s own "hang forever unless ignored" behavior for this case)', async () => {
        const deps = stubDeps({
          fetchFn: fakeFetch({
            checkRunsSequence: [[{ name: 'build', status: 'completed', conclusion: 'success' }]]
          })
        });
        const instance = new AutoFixAllWaitCi(deps);

        await expectAsync(instance._pollOnce(REPO, 7, TOKEN, ['('])).toBeResolvedTo(null);
      });
    });

    it('sends the resolved GitHub token as a bearer header on every REST call', async () => {
      const deps = stubDeps({
        fetchFn: fakeFetch({
          checkRunsSequence: [[{ name: 'build', status: 'completed', conclusion: 'success' }]]
        })
      });
      const instance = new AutoFixAllWaitCi(deps);

      await instance.run(REPO_PATH);

      deps.fetchFn.calls.allArgs().forEach(([, options]) => {
        expect(options.headers.Authorization).toEqual(`Bearer ${TOKEN}`);
      });
    });
  });
});
