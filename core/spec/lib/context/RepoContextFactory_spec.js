import RepoContext from '../../../lib/context/RepoContext.js';
import RepoContextFactory from '../../../lib/context/RepoContextFactory.js';

const REPO = 'darthjee/arcanum';
const TOKEN = 'fake-token';
const REPO_PATH = '/fake/repo';

describe('RepoContextFactory', () => {
  function newFactory(overrides = {}) {
    return new RepoContextFactory({
      origin: {
        resolve: async () => ({ domain: 'github.com', repo: REPO }),
        resolveWithRef: async () => ({ domain: 'github.com', repo: REPO, repoRef: REPO })
      },
      githubToken: { get: async () => TOKEN },
      issueStateService: { get: async () => '' },
      configChain: { read: async () => undefined },
      execFileAsync: jasmine.createSpy('execFileAsync').and.resolveTo({ stdout: 'main\n', stderr: '' }),
      fetchFn: jasmine.createSpy('fetch').and.resolveTo({ ok: true, json: async () => ({}) }),
      timeoutMs: 5,
      ...overrides
    });
  }

  describe('#build', () => {
    it('returns a flat bundle with all six keys', () => {
      const bundle = newFactory().build(REPO_PATH);

      expect(Object.keys(bundle).sort()).toEqual(
        ['context', 'git', 'gitBranch', 'gitClient', 'githubClient', 'issueClient']
      );
    });

    it('returns a context that is a RepoContext bound to the given repoPath', () => {
      const bundle = newFactory().build(REPO_PATH);

      expect(bundle.context).toBeInstanceOf(RepoContext);
      expect(bundle.context.repoPath).toEqual(REPO_PATH);
    });

    it('forwards the injected execFileAsync into the returned gitClient', async () => {
      const execFileAsync = jasmine.createSpy('execFileAsync').and.resolveTo({ stdout: 'feature\n', stderr: '' });
      const bundle = newFactory({ execFileAsync }).build(REPO_PATH);

      await expectAsync(bundle.gitClient.currentBranch()).toBeResolvedTo('feature');
      expect(execFileAsync).toHaveBeenCalledWith('git', ['branch', '--show-current'], { cwd: REPO_PATH });
    });

    it('forwards the injected fetchFn into both the githubClient and the issueClient', async () => {
      const fetchFn = jasmine.createSpy('fetch').and.callFake(async (url) => {
        if (url === 'https://api.github.com/user') {
          return { ok: true, json: async () => ({ login: 'someone' }) };
        }

        return { ok: true, json: async () => ({ labels: [] }) };
      });
      const bundle = newFactory({ fetchFn }).build(REPO_PATH);

      await bundle.githubClient.getCurrentUser();
      await bundle.issueClient.getIssue('5');

      const urls = fetchFn.calls.allArgs().map(([url]) => url);

      expect(urls).toContain('https://api.github.com/user');
      expect(urls).toContain(`https://api.github.com/repos/${REPO}/issues/5`);
    });

    it('yields a usable context when issueStateService/configChain are omitted', () => {
      const factory = new RepoContextFactory({
        origin: { resolve: async () => ({}), resolveWithRef: async () => ({}) },
        githubToken: { get: async () => TOKEN }
      });

      const bundle = factory.build(REPO_PATH);

      expect(bundle.context).toBeInstanceOf(RepoContext);
      expect(bundle.context.repoPath).toEqual(REPO_PATH);
    });

    it('returns a distinct context instance per call', () => {
      const factory = newFactory();

      expect(factory.build(REPO_PATH).context).not.toBe(factory.build(REPO_PATH).context);
    });
  });
});
