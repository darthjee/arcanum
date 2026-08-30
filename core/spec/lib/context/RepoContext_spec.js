import RepoContext from '../../../lib/context/RepoContext.js';

const REPO_PATH = '/fake/repo';

describe('RepoContext', () => {
  function newContext(overrides = {}) {
    return new RepoContext({
      repoPath: REPO_PATH,
      origin: { resolveWithRef: jasmine.createSpy(), resolve: jasmine.createSpy() },
      githubToken: { get: jasmine.createSpy() },
      issueStateService: { get: jasmine.createSpy(), appendJson: jasmine.createSpy() },
      configChain: { read: jasmine.createSpy() },
      githubIssue: { create: jasmine.createSpy() },
      repoPathValidator: { validate: jasmine.createSpy('validate').and.resolveTo(undefined) },
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
    it('delegates to issueStateService.get with id and key', async () => {
      const get = jasmine.createSpy().and.resolveTo('99');
      const context = newContext({ issueStateService: { get } });

      const result = await context.getIssueState('5', 'pr_id');

      expect(get).toHaveBeenCalledWith('5', 'pr_id');
      expect(result).toEqual('99');
    });
  });

  describe('#appendIssueState', () => {
    it('delegates to issueStateService.appendJson with id, field, and jsonValue', async () => {
      const appendJson = jasmine.createSpy().and.resolveTo(undefined);
      const context = newContext({ issueStateService: { appendJson } });

      const result = await context.appendIssueState('5', 'sub_issues', '"7"');

      expect(appendJson).toHaveBeenCalledWith('5', 'sub_issues', '"7"');
      expect(result).toBeUndefined();
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

  describe('#validate', () => {
    it('delegates to repoPathValidator.validate with this.repoPath', async () => {
      const validate = jasmine.createSpy('validate').and.resolveTo(undefined);
      const context = newContext({ repoPathValidator: { validate } });

      await context.validate();

      expect(validate).toHaveBeenCalledWith(REPO_PATH);
    });

    it('propagates the validator rejection', async () => {
      const validationError = new Error('Error: not a git repository: /fake/repo');
      const context = newContext({
        repoPathValidator: { validate: jasmine.createSpy('validate').and.rejectWith(validationError) }
      });

      await expectAsync(context.validate()).toBeRejectedWith(validationError);
    });
  });

  describe('#createIssue', () => {
    it('delegates to githubIssue.create with repoPath, title, and bodyFile', async () => {
      const create = jasmine.createSpy().and.resolveTo('ID=5\nTITLE=t\nFILE=f\nDOMAIN=github.com\nREPO=a/b\n');
      const context = newContext({ githubIssue: { create } });

      const result = await context.createIssue('t', 'f');

      expect(create).toHaveBeenCalledWith(REPO_PATH, 't', 'f');
      expect(result).toEqual('ID=5\nTITLE=t\nFILE=f\nDOMAIN=github.com\nREPO=a/b\n');
    });

    it('validates first — rejects and never calls githubIssue.create when validation fails', async () => {
      const validationError = new Error('Error: not a directory: /fake/repo');
      const create = jasmine.createSpy('create');
      const context = newContext({
        githubIssue: { create },
        repoPathValidator: { validate: jasmine.createSpy('validate').and.rejectWith(validationError) }
      });

      await expectAsync(context.createIssue('t', 'f')).toBeRejectedWith(validationError);
      expect(create).not.toHaveBeenCalled();
    });
  });

  describe('defaults', () => {
    it('builds default collaborators when none are provided', () => {
      const context = new RepoContext({ repoPath: REPO_PATH });

      expect(context.repoPath).toEqual(REPO_PATH);
    });
  });
});
