import AutoFixAllGithub from '../../../lib/commands/auto-fix-all/AutoFixAllGithub.js';
import BranchCleanup from '../../../lib/utils/git/BranchCleanup.js';
import RepoContext from '../../../lib/context/RepoContext.js';
import RepoContextFactory from '../../../lib/context/RepoContextFactory.js';

export const REPO = 'darthjee/arcanum';
export const TOKEN = 'fake-token';
export const REPO_PATH = '/fake/repo';

/**
 * Build a fake `execFileAsync`, answering `git branch --show-current`
 * with `branch`, and every other `git` call successfully unless its
 * joined argv contains one of `failOn`'s substrings (in which case it
 * rejects) — used by `cleanupBranch`'s 4-command git sequence.
 * @param {object} [opts] - behavior overrides.
 * @param {string} [opts.branch] - the current branch's name.
 * @param {string[]} [opts.failOn] - argv substrings that should reject.
 * @returns {Function} a jasmine spy usable as `execFileAsync`.
 */
export function fakeGitExecFileAsync({ branch = 'issue-5', failOn = [] } = {}) {
  return jasmine.createSpy('execFileAsync').and.callFake(async (cmd, args) => {
    if (cmd === 'git' && args[0] === 'branch' && args[1] === '--show-current') {
      return { stdout: `${branch}\n`, stderr: '' };
    }

    const joined = args.join(' ');

    if (failOn.some((pattern) => joined.includes(pattern))) {
      throw new Error(`fake exec failure: git ${joined}`);
    }

    return { stdout: '', stderr: '' };
  });
}

/**
 * Build a fake `fetch`, routing every REST call `AutoFixAllGithub.js`
 * (and its delegates) makes to a configurable canned response.
 * @param {object} [config] - behavior overrides.
 * @param {Array} [config.pulls] - the `/pulls?head=...` response body.
 * @param {boolean} [config.mergeOk] - whether the merge PUT succeeds.
 * @param {string[]} [config.labels] - the issue's current GitHub labels.
 * @param {boolean} [config.issueViewFails] - whether the issue GET fails.
 * @param {boolean} [config.mutateOk] - whether label POST/DELETE succeed.
 * @returns {Function} a jasmine spy usable as `fetchFn`.
 */
export function fakeGithubFetch({
  pulls = [],
  mergeOk = true,
  labels = [],
  issueViewFails = false,
  mutateOk = true
} = {}) {
  return jasmine.createSpy('fetch').and.callFake(async (url, options = {}) => {
    if (url.includes('/pulls?head=')) {
      return { ok: true, json: async () => pulls };
    }

    if (/\/pulls\/\d+\/commits/.test(url)) {
      return { ok: true, json: async () => [] };
    }

    if (options.method === 'PUT' && /\/pulls\/\d+\/merge$/.test(url)) {
      return { ok: mergeOk, json: async () => ({}) };
    }

    if (url === 'https://api.github.com/user') {
      return { ok: true, json: async () => ({ login: 'fake-merger' }) };
    }

    if (options.method === 'DELETE' && url.includes('/git/refs/heads/')) {
      return { ok: true };
    }

    if (options.method === undefined && /\/issues\/[^/]+$/.test(url)) {
      return issueViewFails
        ? { ok: false }
        : { ok: true, json: async () => ({ labels: labels.map((name) => ({ name })) }) };
    }

    if ((options.method === 'POST' || options.method === 'DELETE') && url.includes('/labels')) {
      return { ok: mutateOk };
    }

    throw new Error(`unexpected fetch call: ${url} ${JSON.stringify(options)}`);
  });
}

/**
 * Build an `AutoFixAllGithub` wired through a fake-backed
 * `RepoContext` + `RepoContextFactory` + `BranchCleanup`. The flat
 * override keys (`repoPath`/`origin`/`githubToken`/`issueStateService`/
 * `configChain`) feed the `RepoContext`; `execFileAsync`/`fetchFn`/
 * `timeoutMs` feed the factory; any other key (e.g.
 * `issueTaggerFactory`) is forwarded straight to the constructor.
 * Mirrors `AutoFixAllWaitCi_spec.js`'s `newWaitCi`.
 * @param {object} [overrides] - per-test wiring overrides.
 * @returns {AutoFixAllGithub} the assembled command instance.
 */
export function createAutoFixAllGithub(overrides = {}) {
  const {
    repoPath = REPO_PATH,
    origin = {
      resolve: async () => ({ domain: 'github.com', repo: REPO }),
      resolveWithRef: async () => ({ domain: 'github.com', repo: REPO, repoRef: REPO })
    },
    githubToken = { get: async () => TOKEN },
    issueStateService = { get: async () => '' },
    configChain = { read: async () => undefined },
    execFileAsync = fakeGitExecFileAsync(),
    fetchFn = fakeGithubFetch(),
    timeoutMs = 5,
    ...rest
  } = overrides;

  const repoContext = new RepoContext({ repoPath, origin, githubToken, issueStateService, configChain });

  return new AutoFixAllGithub(repoContext, {
    repoContextFactory: new RepoContextFactory({ execFileAsync, fetchFn, timeoutMs }),
    branchCleanup: new BranchCleanup({ execFileAsync }),
    ...rest
  });
}
