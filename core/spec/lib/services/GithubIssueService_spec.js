import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import GithubIssueService from '../../../lib/services/GithubIssueService.js';
import GithubToken from '../../../lib/utils/github/GithubToken.js';
import { loadFixture, stubDeps } from '../../support/factories/githubIssue.js';
import { registerGithubIssueCreateSharedExamples } from '../../support/sharedExamples/githubIssueCreateSharedExamples.js';
import { createTempDir, removeTempDir } from '../../support/utils/tempDir.js';

describe('GithubIssueService#create', () => {
  const { getRepoPath, writeBodyFile } = registerGithubIssueCreateSharedExamples(
    (deps) => new GithubIssueService(deps)
  );

  it('falls back to `repoContext.repoPath` when no `repoPath` argument is passed', async () => {
    const repoPath = getRepoPath();
    const payload = await loadFixture('github_issue_create_success.json');
    const fetchFn = jasmine.createSpy('fetch').and.resolveTo({ ok: true, json: async () => payload });
    const file = await writeBodyFile('the body');
    const service = new GithubIssueService({ ...stubDeps(), fetchFn, repoContext: { repoPath } });

    await service.create(undefined, 'New feature: dark mode', file);

    const written = await readFile(path.join(repoPath, 'docs/agents/issues/42-new-feature-dark-mode.md'), 'utf8');
    expect(written).toEqual('the body\n');
  });

  it('prefers an explicit `repoPath` argument over the constructor `repoContext`', async () => {
    const repoPath = getRepoPath();
    const payload = await loadFixture('github_issue_create_success.json');
    const fetchFn = jasmine.createSpy('fetch').and.resolveTo({ ok: true, json: async () => payload });
    const file = await writeBodyFile('the body');
    const otherRepoPath = await createTempDir();

    try {
      const service = new GithubIssueService({ ...stubDeps(), fetchFn, repoContext: { repoPath: otherRepoPath } });

      await service.create(repoPath, 'New feature: dark mode', file);

      const written = await readFile(
        path.join(repoPath, 'docs/agents/issues/42-new-feature-dark-mode.md'),
        'utf8'
      );
      expect(written).toEqual('the body\n');
      await expectAsync(
        readFile(path.join(otherRepoPath, 'docs/agents/issues/42-new-feature-dark-mode.md'), 'utf8')
      ).toBeRejected();
    } finally {
      await removeTempDir(otherRepoPath);
    }
  });
});

describe('GithubIssueService#createWithLabels', () => {
  let repoPath;

  beforeEach(async () => {
    repoPath = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  function newService(fetchFn, overrides = {}) {
    return new GithubIssueService({ ...stubDeps(), fetchFn, timeoutMs: 5, ...overrides });
  }

  it('creates the issue with its labels in a single POST and returns number/html_url', async () => {
    const created = { number: 42, html_url: 'https://github.com/darthjee/arcanum/issues/42', title: 'T' };
    const fetchFn = jasmine.createSpy('fetch').and.resolveTo({ ok: true, json: async () => created });

    const result = await newService(fetchFn).createWithLabels(repoPath, {
      title: 'T', body: 'B', labels: ['Epic']
    });

    expect(fetchFn).toHaveBeenCalledOnceWith(
      'https://api.github.com/repos/darthjee/arcanum/issues',
      jasmine.objectContaining({
        method: 'POST',
        body: JSON.stringify({ title: 'T', body: 'B', labels: ['Epic'] })
      })
    );
    expect(result).toEqual({ number: 42, html_url: 'https://github.com/darthjee/arcanum/issues/42' });
  });

  it('omits labels when none are given', async () => {
    const fetchFn = jasmine.createSpy('fetch').and.resolveTo({ ok: true, json: async () => ({ number: 1 }) });

    await newService(fetchFn).createWithLabels(repoPath, { title: 'T', body: 'B' });

    expect(fetchFn).toHaveBeenCalledWith(
      jasmine.any(String),
      jasmine.objectContaining({ body: JSON.stringify({ title: 'T', body: 'B' }) })
    );
  });

  it('never writes a local issue file', async () => {
    const fetchFn = jasmine.createSpy('fetch').and.resolveTo({ ok: true, json: async () => ({ number: 42 }) });

    await newService(fetchFn).createWithLabels(repoPath, { title: 'T', body: 'B', labels: [] });

    await expectAsync(readFile(path.join(repoPath, 'docs/agents/issues/42-t.md'), 'utf8')).toBeRejected();
  });

  it('falls back to `repoContext.repoPath` when no `repoPath` argument is passed', async () => {
    const origin = {
      resolve: jasmine.createSpy(),
      resolveWithRef: jasmine.createSpy().and.resolveTo({ domain: 'github.com', repo: 'a/b', repoRef: 'a/b' })
    };
    const fetchFn = jasmine.createSpy('fetch').and.resolveTo({ ok: true, json: async () => ({ number: 1 }) });

    await newService(fetchFn, { origin, repoContext: { repoPath } })
      .createWithLabels(undefined, { title: 'T', body: 'B' });

    expect(origin.resolveWithRef).toHaveBeenCalledWith(repoPath);
  });

  it('rejects once, without retrying, when the request fails', async () => {
    const fetchFn = jasmine.createSpy('fetch').and.resolveTo({ ok: false });

    await expectAsync(
      newService(fetchFn).createWithLabels(repoPath, { title: 'T', body: 'B', labels: ['x'] })
    ).toBeRejectedWithError('Error: could not create issue on darthjee/arcanum');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe('GithubIssueService#readBody', () => {
  let dir;

  beforeEach(async () => {
    dir = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  it('returns the file contents with all trailing newlines stripped', async () => {
    const file = path.join(dir, 'body.md');
    await writeFile(file, 'a\n\nb\n\n\n');

    await expectAsync(new GithubIssueService(stubDeps()).readBody(file)).toBeResolvedTo('a\n\nb');
  });

  it('throws file-not-found when the file cannot be read', async () => {
    const file = path.join(dir, 'missing.md');

    await expectAsync(new GithubIssueService(stubDeps()).readBody(file)).toBeRejectedWithError(
      `Error: file not found: ${file}`
    );
  });
});

describe('GithubIssueService defaults', () => {
  it('self-builds a GithubToken carrying the constructor repoContext when none is injected', () => {
    const repoContext = { repoPath: '/fake/repo' };
    const service = new GithubIssueService({ repoContext });

    expect(service._githubToken).toBeInstanceOf(GithubToken);
    expect(service._githubToken._repoContext).toBe(repoContext);
  });

  it('forwards the injected execFileAsync into the self-built default GithubToken', async () => {
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
    const repoContext = { repoPath: '/fake/repo' };
    const service = new GithubIssueService({ repoContext, execFileAsync });

    await expectAsync(service._githubToken.get()).toBeResolvedTo('self-built-token');

    const configCall = calls.find(({ args }) => args.join(' ') === 'config user.ghuser');
    expect(configCall.options).toEqual({ cwd: '/fake/repo' });
  });

  it('does not forward execFileAsync into an explicitly injected githubToken', () => {
    const githubToken = { get: jasmine.createSpy() };
    const execFileAsync = jasmine.createSpy('execFileAsync');
    const service = new GithubIssueService({ githubToken, execFileAsync });

    expect(service._githubToken).toBe(githubToken);
  });
});

describe('GithubIssueService#issueClient', () => {
  it('builds an IssueClient whose context resolves origin/token against the given repoPath', async () => {
    const origin = {
      resolve: jasmine.createSpy(),
      resolveWithRef: jasmine.createSpy().and.resolveTo({ domain: 'github.com', repo: 'a/b', repoRef: 'a/b' })
    };
    const githubToken = { get: jasmine.createSpy().and.resolveTo('fake-token') };
    const fetchFn = jasmine.createSpy('fetch').and.resolveTo({ ok: true, json: async () => ({}) });
    const service = new GithubIssueService({ origin, githubToken, fetchFn });

    await service.issueClient('/fake/repo').getIssue('7');

    expect(origin.resolveWithRef).toHaveBeenCalledWith('/fake/repo');
    expect(githubToken.get).toHaveBeenCalledWith('/fake/repo');
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.github.com/repos/a/b/issues/7',
      jasmine.objectContaining({ headers: { Authorization: 'Bearer fake-token' } })
    );
  });

  it('falls back to `repoContext.repoPath` when no `repoPath` argument is passed', async () => {
    const origin = {
      resolve: jasmine.createSpy(),
      resolveWithRef: jasmine.createSpy().and.resolveTo({ domain: 'github.com', repo: 'a/b', repoRef: 'a/b' })
    };
    const githubToken = { get: jasmine.createSpy().and.resolveTo('fake-token') };
    const fetchFn = jasmine.createSpy('fetch').and.resolveTo({ ok: true, json: async () => ({}) });
    const service = new GithubIssueService({
      origin,
      githubToken,
      fetchFn,
      repoContext: { repoPath: '/fake/repo' }
    });

    await service.issueClient().getIssue('7');

    expect(origin.resolveWithRef).toHaveBeenCalledWith('/fake/repo');
    expect(githubToken.get).toHaveBeenCalledWith('/fake/repo');
  });

  it('prefers an explicit `repoPath` argument over the constructor `repoContext`', async () => {
    const origin = {
      resolve: jasmine.createSpy(),
      resolveWithRef: jasmine.createSpy().and.resolveTo({ domain: 'github.com', repo: 'a/b', repoRef: 'a/b' })
    };
    const githubToken = { get: jasmine.createSpy().and.resolveTo('fake-token') };
    const fetchFn = jasmine.createSpy('fetch').and.resolveTo({ ok: true, json: async () => ({}) });
    const service = new GithubIssueService({
      origin,
      githubToken,
      fetchFn,
      repoContext: { repoPath: '/fake/repo' }
    });

    await service.issueClient('/other/repo').getIssue('7');

    expect(origin.resolveWithRef).toHaveBeenCalledWith('/other/repo');
    expect(githubToken.get).toHaveBeenCalledWith('/other/repo');
  });
});

describe('GithubIssueService#rawString', () => {
  it('renders null/undefined as the literal string "null"', () => {
    const service = new GithubIssueService();

    expect(service.rawString(null)).toEqual('null');
    expect(service.rawString(undefined)).toEqual('null');
  });

  it('stringifies any other value', () => {
    const service = new GithubIssueService();

    expect(service.rawString(42)).toEqual('42');
    expect(service.rawString('open')).toEqual('open');
  });
});

describe('GithubIssueService#normalizeTitle', () => {
  it('sanitizes a title with symbols/uppercase/unicode into a safe filename slug', () => {
    const service = new GithubIssueService();

    expect(service.normalizeTitle('Weird///Title!! ÜBER (v2)')).toEqual('weird-title-ber-v2');
  });
});
