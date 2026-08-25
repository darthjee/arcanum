import RepoContext from '../../../lib/context/RepoContext.js';

const REPO_PATH = '/fake/repo';

describe('RepoContext', () => {
  function newContext(overrides = {}) {
    return new RepoContext({
      repoPath: REPO_PATH,
      origin: { resolveWithRef: jasmine.createSpy(), resolve: jasmine.createSpy() },
      githubToken: { get: jasmine.createSpy() },
      issueState: { get: jasmine.createSpy() },
      configChain: { read: jasmine.createSpy() },
      ...overrides
    });
  }

  describe('#resolveWithRef', () => {
    it('delegates to origin.resolveWithRef with repoPath', async () => {
      const resolveWithRef = jasmine.createSpy().and.resolveTo({ domain: 'github.com', repo: 'a/b', repoRef: 'a/b' });
      const context = newContext({ origin: { resolveWithRef, resolve: jasmine.createSpy() } });

      const result = await context.resolveWithRef();

      expect(resolveWithRef).toHaveBeenCalledWith(REPO_PATH);
      expect(result).toEqual({ domain: 'github.com', repo: 'a/b', repoRef: 'a/b' });
    });
  });

  describe('#resolve', () => {
    it('delegates to origin.resolve with repoPath', async () => {
      const resolve = jasmine.createSpy().and.resolveTo({ domain: 'github.com', repo: 'a/b' });
      const context = newContext({ origin: { resolve, resolveWithRef: jasmine.createSpy() } });

      const result = await context.resolve();

      expect(resolve).toHaveBeenCalledWith(REPO_PATH);
      expect(result).toEqual({ domain: 'github.com', repo: 'a/b' });
    });
  });

  describe('#getToken', () => {
    it('delegates to githubToken.get with repoPath', async () => {
      const get = jasmine.createSpy().and.resolveTo('fake-token');
      const context = newContext({ githubToken: { get } });

      const result = await context.getToken();

      expect(get).toHaveBeenCalledWith(REPO_PATH);
      expect(result).toEqual('fake-token');
    });
  });

  describe('#getIssueState', () => {
    it('delegates to issueState.get with repoPath, id, and key', async () => {
      const get = jasmine.createSpy().and.resolveTo('99');
      const context = newContext({ issueState: { get } });

      const result = await context.getIssueState('5', 'pr_id');

      expect(get).toHaveBeenCalledWith(REPO_PATH, '5', 'pr_id');
      expect(result).toEqual('99');
    });
  });

  describe('#readConfig', () => {
    it('delegates to configChain.read with repoPath, scope, and key', async () => {
      const read = jasmine.createSpy().and.resolveTo('full');
      const context = newContext({ configChain: { read } });

      const result = await context.readConfig('git', 'merge_body_mode');

      expect(read).toHaveBeenCalledWith(REPO_PATH, 'git', 'merge_body_mode');
      expect(result).toEqual('full');
    });
  });

  describe('defaults', () => {
    it('builds default collaborators when none are provided', () => {
      const context = new RepoContext({ repoPath: REPO_PATH });

      expect(context.repoPath).toEqual(REPO_PATH);
    });
  });
});
