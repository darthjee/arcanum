import AutoFixAllGithub from '../../../lib/commands/AutoFixAllGithub.js';
import BranchCleanup from '../../../lib/utils/git/BranchCleanup.js';
import DispatchFailure from '../../../lib/utils/errors/DispatchFailure.js';
import RepoContext from '../../../lib/context/RepoContext.js';
import RepoContextFactory from '../../../lib/context/RepoContextFactory.js';

const REPO = 'darthjee/arcanum';
const TOKEN = 'fake-token';
const REPO_PATH = '/fake/repo';

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
function fakeExecFileAsync({ branch = 'issue-5', failOn = [] } = {}) {
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
function fakeFetch({
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

describe('AutoFixAllGithub', () => {
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
  function newGithub(overrides = {}) {
    const {
      repoPath = REPO_PATH,
      origin = {
        resolve: async () => ({ domain: 'github.com', repo: REPO }),
        resolveWithRef: async () => ({ domain: 'github.com', repo: REPO, repoRef: REPO })
      },
      githubToken = { get: async () => TOKEN },
      issueStateService = { get: async () => '' },
      configChain = { read: async () => undefined },
      execFileAsync = fakeExecFileAsync(),
      fetchFn = fakeFetch(),
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

  describe('constructor wiring', () => {
    it('shares the same origin/githubToken instances (through the injected RepoContext) across issueTagger/prOperations', async () => {
      const origin = jasmine.createSpy('origin.resolve').and.callFake(async () => ({ domain: 'github.com', repo: REPO }));
      const originWithRef = jasmine.createSpy('origin.resolveWithRef').and.callFake(async () => ({
        domain: 'github.com', repo: REPO, repoRef: REPO
      }));
      const tokenGet = jasmine.createSpy('githubToken.get').and.resolveTo(TOKEN);

      const github = newGithub({
        origin: { resolve: origin, resolveWithRef: originWithRef },
        githubToken: { get: tokenGet },
        fetchFn: fakeFetch({
          labels: ['Ready for Work'],
          pulls: [{ number: 7, state: 'open', merged: false, merged_at: null }]
        })
      });

      // #addTag routes through the shared issueTagger flow (origin.resolveWithRef + githubToken.get) —
      // both `_mutateTag`'s own repoRef resolution and the per-call IssueClient's internal resolution
      // route through the same shared instances, so both are called more than once per #addTag call.
      await github.addTag('5', 'ready_for_work');
      expect(originWithRef).toHaveBeenCalledWith(REPO_PATH);
      expect(tokenGet).toHaveBeenCalledWith(REPO_PATH);

      const originWithRefAfterAddTag = originWithRef.calls.count();
      const tokenGetAfterAddTag = tokenGet.calls.count();

      // #prState routes through the shared prOperations flow (also origin.resolveWithRef + githubToken.get).
      await github.prState();
      expect(originWithRef.calls.count()).toEqual(originWithRefAfterAddTag + 1);
      expect(tokenGet.calls.count()).toEqual(tokenGetAfterAddTag + 1);
    });

    it('routes every call through the injected execFileAsync/fetchFn via buildFromContext, bound to the context repoPath', async () => {
      const execFileAsync = jasmine.createSpy('execFileAsync').and.callFake(async (cmd, args, options) => {
        if (args[0] === 'branch' && args[1] === '--show-current') {
          return { stdout: `branch-for-${options.cwd}\n`, stderr: '' };
        }

        return { stdout: '', stderr: '' };
      });
      const fetchFn = jasmine.createSpy('fetch').and.callFake(async (url) => {
        if (url.includes('/pulls?head=')) {
          return { ok: true, json: async () => [{ number: 7, state: 'open', merged: false, merged_at: null }] };
        }

        throw new Error(`unexpected fetch call: ${url}`);
      });

      const github = newGithub({ repoPath: '/fake/repo/one', execFileAsync, fetchFn });

      // #prState rebuilds its RepoContextFactory bundle per call, but always off the single injected
      // RepoContext — so every call routes through the same injected execFileAsync/fetchFn, bound to
      // that context's own repoPath (a defaulted/stale client would resolve against the wrong cwd).
      await github.prState();
      await github.prState();

      const cwds = execFileAsync.calls.allArgs()
        .filter(([, args]) => args[0] === 'branch')
        .map(([, , options]) => options.cwd);

      expect(cwds).toEqual(['/fake/repo/one', '/fake/repo/one']);
      expect(fetchFn.calls.allArgs().filter(([url]) => url.includes('/pulls?head=')).length).toEqual(2);
    });
  });

  describe('#prNumber', () => {
    it('rejects when repoPath is missing', async () => {
      const github = newGithub({ repoPath: '' });

      await expectAsync(github.prNumber()).toBeRejectedWithError('Usage: github.sh pr-number <repo_path>');
    });

    it('returns the cached pr_id when the branch matches issue-<id> and a cache entry exists', async () => {
      const fetchFn = fakeFetch();
      const github = newGithub({
        execFileAsync: fakeExecFileAsync({ branch: 'issue-5' }),
        issueStateService: { get: async (id, field) => (field === 'pr_id' ? '99' : '') },
        fetchFn
      });

      await expectAsync(github.prNumber()).toBeResolvedTo('99\n');
      expect(fetchFn).not.toHaveBeenCalled();
    });
  });

  describe('#prState', () => {
    it('rejects when repoPath is missing', async () => {
      const github = newGithub({ repoPath: '' });

      await expectAsync(github.prState()).toBeRejectedWithError('Usage: github.sh pr-state <repo_path>');
    });

    it('prints STATE=OPEN for an open, unmerged pull request', async () => {
      const github = newGithub({
        fetchFn: fakeFetch({ pulls: [{ number: 7, state: 'open', merged: false, merged_at: null }] })
      });

      await expectAsync(github.prState()).toBeResolvedTo('STATE=OPEN\n');
    });
  });

  describe('#prMerge', () => {
    const PULL = { number: 7, title: 'My PR', html_url: 'https://github.com/darthjee/arcanum/pull/7', state: 'open' };

    it('rejects when repoPath is missing', async () => {
      const github = newGithub({ repoPath: '' });

      await expectAsync(github.prMerge()).toBeRejectedWithError('Usage: github.sh pr-merge <repo_path> [model_email]');
    });

    it('merges with an empty body by default (merge_body_mode absent) and prints the PR URL', async () => {
      const fetchFn = fakeFetch({ pulls: [PULL] });
      const github = newGithub({ fetchFn });

      await expectAsync(github.prMerge()).toBeResolvedTo(`${PULL.html_url}\n`);

      const mergeCall = fetchFn.calls.allArgs().find(([, options]) => options.method === 'PUT');

      expect(JSON.parse(mergeCall[1].body)).toEqual({
        merge_method: 'squash',
        commit_title: 'My PR (#7)',
        commit_message: ''
      });
    });

    it('rejects with the merge-failure error when the merge REST call fails', async () => {
      const github = newGithub({ fetchFn: fakeFetch({ pulls: [PULL], mergeOk: false }) });

      await expectAsync(github.prMerge()).toBeRejectedWithError(
        'could not merge PR #7 on darthjee/arcanum'
      );
    });
  });

  describe('#cleanupBranch', () => {
    it('rejects when repoPath or id is missing', async () => {
      const github = newGithub();

      await expectAsync(github.cleanupBranch()).toBeRejectedWithError(
        'Usage: github.sh cleanup-branch <repo_path> <id>'
      );
    });

    it('runs the remote delete, checkout, reset, and local delete, in order', async () => {
      const execFileAsync = fakeExecFileAsync();
      const github = newGithub({ execFileAsync });

      await expectAsync(github.cleanupBranch('5')).toBeResolvedTo('');

      const calls = execFileAsync.calls.allArgs().map(([cmd, args]) => `${cmd} ${args.join(' ')}`);

      expect(calls).toEqual([
        'git push origin --delete issue-5',
        'git checkout main',
        'git reset --hard origin/main',
        'git branch -D issue-5'
      ]);
    });
  });

  describe('#hasShipitLabel', () => {
    it('resolves for a case-insensitive exact "shipit" label match', async () => {
      const github = newGithub({ fetchFn: fakeFetch({ labels: ['Shipit', 'Other'] }) });

      await expectAsync(github.hasShipitLabel('5')).toBeResolvedTo('');
    });

    it('rejects with an empty-stdout DispatchFailure (exit 1) when the label is absent', async () => {
      const github = newGithub({ fetchFn: fakeFetch({ labels: ['Other'] }) });
      let thrown;

      try {
        await github.hasShipitLabel('5');
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(DispatchFailure);
      expect(thrown.stdout).toEqual('');
      expect(thrown.exitCode).toEqual(1);
    });

    it('rejects with an empty-stdout DispatchFailure (exit 1) when the labels fetch fails', async () => {
      const github = newGithub({ fetchFn: fakeFetch({ issueViewFails: true }) });
      let thrown;

      try {
        await github.hasShipitLabel('5');
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(DispatchFailure);
      expect(thrown.stdout).toEqual('');
      expect(thrown.exitCode).toEqual(1);
    });
  });

  describe('#addTag', () => {
    it('rejects when repoPath, id, or tag is missing', async () => {
      const github = newGithub();

      await expectAsync(github.addTag('5')).toBeRejectedWithError(
        'Usage: github.sh add-tag <repo_path> <id> <tag>'
      );
    });

    it('rejects shipit with the human-only guard message', async () => {
      const github = newGithub();

      await expectAsync(github.addTag('5', 'shipit')).toBeRejectedWithError(
        'Error: shipit is human-only; scripts must not add or remove it'
      );
    });

    it('prints a "nothing to do" line, without mutating, when the label is already present', async () => {
      const fetchFn = fakeFetch({ labels: ['Ready for Work'] });
      const github = newGithub({ fetchFn });

      await expectAsync(github.addTag('5', 'ready_for_work')).toBeResolvedTo(
        'Tag \'ready_for_work\' already present on issue #5 — nothing to do.\n'
      );
      expect(fetchFn.calls.allArgs().some(([, options = {}]) => options.method === 'POST')).toBeFalse();
    });

    it('adds the mapped GitHub label and prints the confirmation line', async () => {
      const fetchFn = fakeFetch({ labels: [] });
      const github = newGithub({ fetchFn });

      await expectAsync(github.addTag('5', 'ready_for_work')).toBeResolvedTo(
        'Added tag \'ready_for_work\' to issue #5 on darthjee/arcanum\n'
      );

      const postCall = fetchFn.calls.allArgs().find(([, options]) => options.method === 'POST');

      expect(postCall[0]).toEqual(`https://api.github.com/repos/${REPO}/issues/5/labels`);
      expect(JSON.parse(postCall[1].body)).toEqual({ labels: ['Ready for Work'] });
    });

    it('rejects with the fetch-failure error when the current labels cannot be fetched', async () => {
      const github = newGithub({ fetchFn: fakeFetch({ issueViewFails: true }) });

      await expectAsync(github.addTag('5', 'ready_for_work')).toBeRejectedWithError(
        'Error: could not fetch issue #5 from darthjee/arcanum'
      );
    });

    it('rejects with the update-failure error when the add-label call fails', async () => {
      const github = newGithub({ fetchFn: fakeFetch({ labels: [], mutateOk: false }) });

      await expectAsync(github.addTag('5', 'ready_for_work')).toBeRejectedWithError(
        'Error: could not update issue #5 on darthjee/arcanum'
      );
    });
  });

  describe('#removeTag', () => {
    it('rejects when repoPath, id, or tag is missing', async () => {
      const github = newGithub();

      await expectAsync(github.removeTag('5')).toBeRejectedWithError(
        'Usage: github.sh remove-tag <repo_path> <id> <tag>'
      );
    });

    it('rejects shipit with the human-only guard message', async () => {
      const github = newGithub();

      await expectAsync(github.removeTag('5', 'shipit')).toBeRejectedWithError(
        'Error: shipit is human-only; scripts must not add or remove it'
      );
    });

    it('prints a "nothing to do" line, without mutating, when the label is already absent', async () => {
      const fetchFn = fakeFetch({ labels: [] });
      const github = newGithub({ fetchFn });

      await expectAsync(github.removeTag('5', 'ready_for_work')).toBeResolvedTo(
        'Tag \'ready_for_work\' not present on issue #5 — nothing to do.\n'
      );
      expect(fetchFn.calls.allArgs().some(([, options = {}]) => options.method === 'DELETE')).toBeFalse();
    });

    it('removes the mapped GitHub label and prints the confirmation line', async () => {
      const fetchFn = fakeFetch({ labels: ['Ready for Work'] });
      const github = newGithub({ fetchFn });

      await expectAsync(github.removeTag('5', 'ready_for_work')).toBeResolvedTo(
        'Removed tag \'ready_for_work\' from issue #5 on darthjee/arcanum\n'
      );

      const deleteCall = fetchFn.calls.allArgs().find(([, options]) => options.method === 'DELETE');

      expect(deleteCall[0]).toEqual(`https://api.github.com/repos/${REPO}/issues/5/labels/Ready%20for%20Work`);
    });

    it('rejects with the fetch-failure error when the current labels cannot be fetched', async () => {
      const github = newGithub({ fetchFn: fakeFetch({ issueViewFails: true }) });

      await expectAsync(github.removeTag('5', 'ready_for_work')).toBeRejectedWithError(
        'Error: could not fetch issue #5 from darthjee/arcanum'
      );
    });

    it('rejects with the update-failure error when the remove-label call fails', async () => {
      const github = newGithub({ fetchFn: fakeFetch({ labels: ['Ready for Work'], mutateOk: false }) });

      await expectAsync(github.removeTag('5', 'ready_for_work')).toBeRejectedWithError(
        'Error: could not update issue #5 on darthjee/arcanum'
      );
    });
  });
});
