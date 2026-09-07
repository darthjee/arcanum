import GithubIssueService from '../../../lib/services/GithubIssueService.js';
import GithubToken from '../../../lib/utils/github/GithubToken.js';
import Origin from '../../../lib/utils/git/Origin.js';
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
      githubIssueService: { create: jasmine.createSpy() },
      repoPathValidator: { validate: jasmine.createSpy('validate').and.resolveTo(undefined) },
      ...overrides
    });
  }

  describe('#resolveWithRef', () => {
    it('delegates to origin.resolveWithRef with no arguments', async () => {
      const resolveWithRef = jasmine.createSpy().and.resolveTo({ domain: 'github.com', repo: 'a/b', repoRef: 'a/b' });
      const context = newContext({ origin: { resolveWithRef, resolve: jasmine.createSpy() } });

      const result = await context.resolveWithRef();

      expect(resolveWithRef).toHaveBeenCalledWith();
      expect(result).toEqual({ domain: 'github.com', repo: 'a/b', repoRef: 'a/b' });
    });
  });

  describe('#resolve', () => {
    it('delegates to origin.resolve with no arguments', async () => {
      const resolve = jasmine.createSpy().and.resolveTo({ domain: 'github.com', repo: 'a/b' });
      const context = newContext({ origin: { resolve, resolveWithRef: jasmine.createSpy() } });

      const result = await context.resolve();

      expect(resolve).toHaveBeenCalledWith();
      expect(result).toEqual({ domain: 'github.com', repo: 'a/b' });
    });
  });

  describe('#getToken', () => {
    it('delegates to githubToken.get with no arguments', async () => {
      const get = jasmine.createSpy().and.resolveTo('fake-token');
      const context = newContext({ githubToken: { get } });

      const result = await context.getToken();

      expect(get).toHaveBeenCalledWith();
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
    it('delegates to githubIssueService.create with repoPath, title, and bodyFile', async () => {
      const create = jasmine.createSpy().and.resolveTo('ID=5\nTITLE=t\nFILE=f\nDOMAIN=github.com\nREPO=a/b\n');
      const context = newContext({ githubIssueService: { create } });

      const result = await context.createIssue('t', 'f');

      expect(create).toHaveBeenCalledWith(REPO_PATH, 't', 'f');
      expect(result).toEqual('ID=5\nTITLE=t\nFILE=f\nDOMAIN=github.com\nREPO=a/b\n');
    });

    it('validates first — rejects and never calls githubIssueService.create when validation fails', async () => {
      const validationError = new Error('Error: not a directory: /fake/repo');
      const create = jasmine.createSpy('create');
      const context = newContext({
        githubIssueService: { create },
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

    it('self-builds a GithubToken carrying itself as repoContext when none is injected', () => {
      const context = new RepoContext({ repoPath: REPO_PATH });

      expect(context._githubToken).toBeInstanceOf(GithubToken);
      expect(context._githubToken._repoContext).toBe(context);
    });

    it('self-builds an Origin carrying itself as repoContext when none is injected', () => {
      const context = new RepoContext({ repoPath: REPO_PATH });

      expect(context._origin).toBeInstanceOf(Origin);
      expect(context._origin._repoContext).toBe(context);
    });

    it('resolves getToken() against this.repoPath through the self-built GithubToken', async () => {
      const calls = [];
      const execFileAsync = jasmine.createSpy('execFileAsync').and.callFake((file, args, options) => {
        calls.push({ args, options });

        if (args[0] === 'config' && args[1] === 'user.ghuser') {
          return Promise.reject(new Error('not set'));
        }

        if (args.join(' ') === 'auth token') {
          return Promise.resolve({ stdout: 'self-built-token\n', stderr: '' });
        }

        return Promise.reject(new Error('unexpected call'));
      });
      const context = new RepoContext({
        repoPath: REPO_PATH,
        githubToken: new GithubToken({ execFileAsync, repoContext: { repoPath: REPO_PATH } })
      });

      await expectAsync(context.getToken()).toBeResolvedTo('self-built-token');

      const configCall = calls.find(({ args }) => args.join(' ') === 'config user.ghuser');
      expect(configCall.options).toEqual({ cwd: REPO_PATH });
    });

    it('self-builds a GithubIssueService carrying itself as repoContext when none is injected', () => {
      const context = new RepoContext({ repoPath: REPO_PATH });

      expect(context._githubIssueService).toBeInstanceOf(GithubIssueService);
      expect(context._githubIssueService._repoContext).toBe(context);
    });

    it('forwards a constructor-injected execFileAsync into the self-built GithubToken\'s real get()', async () => {
      const calls = [];
      const execFileAsync = jasmine.createSpy('execFileAsync').and.callFake((file, args, options) => {
        calls.push({ args, options });

        if (args[0] === 'config' && args[1] === 'user.ghuser') {
          return Promise.reject(new Error('not set'));
        }

        if (args.join(' ') === 'auth token') {
          return Promise.resolve({ stdout: 'forwarded-token\n', stderr: '' });
        }

        return Promise.reject(new Error('unexpected call'));
      });
      const context = new RepoContext({ repoPath: REPO_PATH, execFileAsync });

      await expectAsync(context.getToken()).toBeResolvedTo('forwarded-token');

      const configCall = calls.find(({ args }) => args.join(' ') === 'config user.ghuser');
      expect(configCall.options).toEqual({ cwd: REPO_PATH });
    });

    it('forwards a constructor-injected execFileAsync into the self-built GithubIssueService\'s default GithubToken', () => {
      const execFileAsync = jasmine.createSpy('execFileAsync');
      const context = new RepoContext({ repoPath: REPO_PATH, execFileAsync });

      expect(context._githubIssueService._githubToken._execFileAsync).toBe(execFileAsync);
    });

    it('does not forward execFileAsync into an explicitly injected githubToken', () => {
      const githubToken = { get: jasmine.createSpy() };
      const execFileAsync = jasmine.createSpy('execFileAsync');
      const context = new RepoContext({ repoPath: REPO_PATH, githubToken, execFileAsync });

      expect(context._githubToken).toBe(githubToken);
    });

    it('does not forward execFileAsync into an explicitly injected githubIssueService', () => {
      const githubIssueService = { create: jasmine.createSpy() };
      const execFileAsync = jasmine.createSpy('execFileAsync');
      const context = new RepoContext({ repoPath: REPO_PATH, githubIssueService, execFileAsync });

      expect(context._githubIssueService).toBe(githubIssueService);
    });
  });
});
