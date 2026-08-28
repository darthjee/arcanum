import AutoFixAllWaitCi from '../../../lib/commands/AutoFixAllWaitCi.js';
import RepoContext from '../../../lib/context/RepoContext.js';
import RepoContextFactory from '../../../lib/context/RepoContextFactory.js';

const REPO_PATH = '/repo/path';
const REPO = 'darthjee/arcanum';
const BRANCH = 'issue-42';
const TOKEN = 'fake-token';

/**
 * Build a fake `execFileAsync` implementation answering the single
 * `git branch --show-current` call `AutoFixAllWaitCi` makes (via its
 * per-call `GitClient`, which invokes it as `execFileAsync('git',
 * ['branch', '--show-current'], { cwd: repoPath })`).
 * @param {object} [opts] - behavior overrides.
 * @param {string} [opts.branch] - the branch `git branch --show-current`
 *   reports.
 * @returns {Function} a jasmine spy usable as `execFileAsync`.
 */
function fakeExecFileAsync({ branch = BRANCH } = {}) {
  return jasmine.createSpy('execFileAsync').and.callFake(async (file, args = []) => {
    if (file === 'git' && args[0] === 'branch' && args[1] === '--show-current') {
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

describe('AutoFixAllWaitCi', () => {
  /**
   * Build an `AutoFixAllWaitCi` wired through a fake-backed
   * `RepoContext` + `RepoContextFactory`. The flat override keys
   * (`repoPath`/`origin`/`githubToken`) feed the `RepoContext`;
   * `execFileAsync`/`fetchFn`/`timeoutMs` feed the factory; any other
   * key (`repoConfig`/`pollIntervalMs`/`sleepFn`/`repoPathValidator`) is
   * forwarded straight to the command constructor.
   * @param {object} [overrides] - per-test wiring overrides.
   * @returns {AutoFixAllWaitCi} the assembled command instance.
   */
  function newWaitCi(overrides = {}) {
    const {
      repoPath = REPO_PATH,
      origin = {
        resolve: async () => ({ domain: 'github.com', repo: REPO }),
        resolveWithRef: async () => ({ domain: 'github.com', repo: REPO, repoRef: REPO })
      },
      githubToken = { get: async () => TOKEN },
      execFileAsync = fakeExecFileAsync(),
      fetchFn = fakeFetch(),
      timeoutMs = 5,
      repoPathValidator = { validate: jasmine.createSpy('validate').and.resolveTo(undefined) },
      ...rest
    } = overrides;

    const repoContext = new RepoContext({ repoPath, origin, githubToken });

    return new AutoFixAllWaitCi(repoContext, {
      repoContextFactory: new RepoContextFactory({ execFileAsync, fetchFn, timeoutMs }),
      repoPathValidator,
      ...rest
    });
  }

  const stubRepoConfig = () => ({
    getIgnoredCheckPatterns: jasmine.createSpy('getIgnoredCheckPatterns').and.resolveTo([])
  });

  describe('#run', () => {
    it('throws the usage message when repo_path is missing', async () => {
      const execFileAsync = fakeExecFileAsync();
      const repoPathValidator = { validate: jasmine.createSpy('validate').and.resolveTo(undefined) };
      const instance = newWaitCi({ repoPath: '', execFileAsync, repoPathValidator, repoConfig: stubRepoConfig() });

      await expectAsync(instance.run()).toBeRejectedWithError('Usage: wait_ci.sh <repo_path>');
      expect(execFileAsync).not.toHaveBeenCalled();
      expect(repoPathValidator.validate).not.toHaveBeenCalled();
    });

    it('rejects (before any I/O) when repo-path validation fails for a non-empty path', async () => {
      const execFileAsync = fakeExecFileAsync();
      const fetchFn = fakeFetch();
      const validationError = new Error('Error: not a directory: /repo/path');
      const repoPathValidator = { validate: jasmine.createSpy('validate').and.rejectWith(validationError) };
      const instance = newWaitCi({ execFileAsync, fetchFn, repoPathValidator, repoConfig: stubRepoConfig() });

      await expectAsync(instance.run()).toBeRejectedWith(validationError);
      expect(execFileAsync).not.toHaveBeenCalled();
      expect(fetchFn).not.toHaveBeenCalled();
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
