import AutoFixAllWaitCi from '../../../lib/commands/auto-fix-all/AutoFixAllWaitCi.js';
import RepoContext from '../../../lib/context/RepoContext.js';
import RepoContextFactory from '../../../lib/context/RepoContextFactory.js';

export const REPO_PATH = '/repo/path';
export const REPO = 'darthjee/arcanum';
export const BRANCH = 'issue-42';
export const TOKEN = 'fake-token';

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
export function fakeExecFileAsync({ branch = BRANCH } = {}) {
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
export function fakeFetch({ pulls = [{ number: 7 }], headSequence = ['sha-1'], checkRunsSequence = [[]] } = {}) {
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
 * Build an `AutoFixAllWaitCi` wired through a fake-backed
 * `RepoContext` + `RepoContextFactory`. The flat override keys
 * (`repoPath`/`origin`/`githubToken`) feed the `RepoContext`;
 * `execFileAsync`/`fetchFn`/`timeoutMs` feed the factory; any other
 * key (`repoConfig`/`pollIntervalMs`/`sleepFn`) is
 * forwarded straight to the command constructor.
 * @param {object} [overrides] - per-test wiring overrides.
 * @returns {AutoFixAllWaitCi} the assembled command instance.
 */
export function newWaitCi(overrides = {}) {
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
    ...rest
  } = overrides;

  const repoContext = new RepoContext({ repoPath, origin, githubToken });

  return new AutoFixAllWaitCi(repoContext, {
    repoContextFactory: new RepoContextFactory({ execFileAsync, fetchFn, timeoutMs }),
    ...rest
  });
}

export const stubRepoConfig = () => ({
  getIgnoredCheckPatterns: jasmine.createSpy('getIgnoredCheckPatterns').and.resolveTo([])
});
