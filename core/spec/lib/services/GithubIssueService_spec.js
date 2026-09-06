import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import GithubIssueService from '../../../lib/services/GithubIssueService.js';
import { loadFixture, stubDeps } from '../../support/factories/githubIssue.js';
import { createTempDir, removeTempDir } from '../../support/utils/tempDir.js';

describe('GithubIssueService#create', () => {
  let repoPath;

  beforeEach(async () => {
    repoPath = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  /**
   * @param {string} content - the body file's raw content.
   * @returns {Promise<string>} the created body file's absolute path.
   */
  async function writeBodyFile(content) {
    const filePath = path.join(repoPath, 'body.md');
    await writeFile(filePath, content);

    return filePath;
  }

  it('creates the issue, writes docs/agents/issues/<id>-<slug>.md, and returns the ID=ok fields', async () => {
    const payload = await loadFixture('github_issue_create_success.json');
    const fetchFn = jasmine.createSpy('fetch').and.resolveTo({ ok: true, json: async () => payload });
    const file = await writeBodyFile('Please add a dark mode toggle to settings.\n');
    const service = new GithubIssueService({ ...stubDeps(), fetchFn });

    const result = await service.create(repoPath, 'New feature: dark mode', file);

    expect(result).toEqual(
      'ID=42\nTITLE=New feature: dark mode\nFILE=docs/agents/issues/42-new-feature-dark-mode.md\n' +
        'DOMAIN=github.com\nREPO=darthjee/arcanum\n'
    );

    const written = await readFile(path.join(repoPath, 'docs/agents/issues/42-new-feature-dark-mode.md'), 'utf8');
    expect(written).toEqual('Please add a dark mode toggle to settings.\n');
  });

  it('strips trailing newlines from the body file, matching $(cat "$file")', async () => {
    const payload = await loadFixture('github_issue_create_success.json');

    for (const trailing of ['', '\n', '\n\n\n']) {
      const fetchFn = jasmine.createSpy('fetch').and.resolveTo({ ok: true, json: async () => payload });
      const file = await writeBodyFile(`body content${trailing}`);
      const service = new GithubIssueService({ ...stubDeps(), fetchFn });

      await service.create(repoPath, 'New feature: dark mode', file);

      const written = await readFile(path.join(repoPath, 'docs/agents/issues/42-new-feature-dark-mode.md'), 'utf8');
      expect(written).toEqual('body content\n');
      expect(fetchFn).toHaveBeenCalledWith(
        jasmine.any(String),
        jasmine.objectContaining({ body: JSON.stringify({ title: 'New feature: dark mode', body: 'body content' }) })
      );
    }
  });

  it('calls fetch with POST, the right URL, Authorization header, and JSON body', async () => {
    const payload = await loadFixture('github_issue_create_success.json');
    const fetchFn = jasmine.createSpy('fetch').and.resolveTo({ ok: true, json: async () => payload });
    const file = await writeBodyFile('the body');
    const service = new GithubIssueService({ ...stubDeps(), fetchFn });

    await service.create(repoPath, 'New feature: dark mode', file);

    expect(fetchFn).toHaveBeenCalledWith('https://api.github.com/repos/darthjee/arcanum/issues', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer fake-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title: 'New feature: dark mode', body: 'the body' }),
      signal: jasmine.any(AbortSignal)
    });
  });

  it('does not write a per-issue state file', async () => {
    const payload = await loadFixture('github_issue_create_success.json');
    const fetchFn = jasmine.createSpy('fetch').and.resolveTo({ ok: true, json: async () => payload });
    const file = await writeBodyFile('the body');
    const service = new GithubIssueService({ ...stubDeps(), fetchFn });

    await service.create(repoPath, 'New feature: dark mode', file);

    const stateFile = path.join(repoPath, '.claude', 'state', 'issue-42.json');

    await expectAsync(readFile(stateFile, 'utf8')).toBeRejected();
  });

  it('rejects with the exact file-not-found message before any origin/token/network call', async () => {
    const fetchFn = jasmine.createSpy('fetch');
    const origin = { resolve: jasmine.createSpy('resolve') };
    const missingFile = path.join(repoPath, 'does-not-exist.md');
    const service = new GithubIssueService({ ...stubDeps({ origin }), fetchFn });

    await expectAsync(service.create(repoPath, 'title', missingFile)).toBeRejectedWithError(
      `Error: file not found: ${missingFile}`
    );

    expect(fetchFn).not.toHaveBeenCalled();
    expect(origin.resolve).not.toHaveBeenCalled();
  });

  it('throws the exact create-failure message on a non-2xx response', async () => {
    const fetchFn = jasmine.createSpy('fetch').and.resolveTo({ ok: false, status: 422, json: async () => ({}) });
    const file = await writeBodyFile('the body');
    const service = new GithubIssueService({ ...stubDeps(), fetchFn });

    await expectAsync(service.create(repoPath, 'title', file)).toBeRejectedWithError(
      'Error: could not create issue on darthjee/arcanum'
    );
  });

  it('throws the exact create-failure message on a network error', async () => {
    const fetchFn = jasmine.createSpy('fetch').and.rejectWith(new Error('network down'));
    const file = await writeBodyFile('the body');
    const service = new GithubIssueService({ ...stubDeps(), fetchFn });

    await expectAsync(service.create(repoPath, 'title', file)).toBeRejectedWithError(
      'Error: could not create issue on darthjee/arcanum'
    );
  });

  it('surfaces the exact auth-failure message when a token cannot be obtained', async () => {
    const githubToken = {
      get: async () => {
        throw new Error('Error: could not obtain GitHub token via gh auth token');
      }
    };
    const file = await writeBodyFile('the body');
    const service = new GithubIssueService({ ...stubDeps({ githubToken }), fetchFn: jasmine.createSpy('fetch') });

    await expectAsync(service.create(repoPath, 'title', file)).toBeRejectedWithError(
      'Error: could not obtain GitHub token via gh auth token'
    );
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
