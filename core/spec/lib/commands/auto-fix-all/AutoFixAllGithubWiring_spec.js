import {
  createAutoFixAllGithub,
  fakeGithubFetch,
  REPO,
  TOKEN,
  REPO_PATH
} from '../../../support/factories/autoFixAllGithub.js';

describe('AutoFixAllGithub (wiring)', () => {
  describe('constructor wiring', () => {
    it('shares the same origin/githubToken instances (through the injected RepoContext) across issueTagger/prOperations', async () => {
      const origin = jasmine.createSpy('origin.resolve').and.callFake(async () => ({ domain: 'github.com', repo: REPO }));
      const originWithRef = jasmine.createSpy('origin.resolveWithRef').and.callFake(async () => ({
        domain: 'github.com', repo: REPO, repoRef: REPO
      }));
      const tokenGet = jasmine.createSpy('githubToken.get').and.resolveTo(TOKEN);

      const github = createAutoFixAllGithub({
        origin: { resolve: origin, resolveWithRef: originWithRef },
        githubToken: { get: tokenGet },
        fetchFn: fakeGithubFetch({
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

      const github = createAutoFixAllGithub({ repoPath: '/fake/repo/one', execFileAsync, fetchFn });

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
});
