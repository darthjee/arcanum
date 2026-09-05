import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import GithubIssue from '../../../../lib/commands/shared/GithubIssue.js';
import RepoContext from '../../../../lib/context/RepoContext.js';
import { loadFixture, stubDeps } from '../../../support/factories/githubIssue.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

describe('GithubIssue#create', () => {
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
    const githubIssue = new GithubIssue(undefined, { ...stubDeps(), fetchFn });

    const result = await githubIssue.create(repoPath, 'New feature: dark mode', file);

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
      const githubIssue = new GithubIssue(undefined, { ...stubDeps(), fetchFn });

      await githubIssue.create(repoPath, 'New feature: dark mode', file);

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
    const githubIssue = new GithubIssue(undefined, { ...stubDeps(), fetchFn });

    await githubIssue.create(repoPath, 'New feature: dark mode', file);

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
    const githubIssue = new GithubIssue(undefined, { ...stubDeps(), fetchFn });

    await githubIssue.create(repoPath, 'New feature: dark mode', file);

    const stateFile = path.join(repoPath, '.claude', 'state', 'issue-42.json');

    await expectAsync(readFile(stateFile, 'utf8')).toBeRejected();
  });

  it('rejects with the exact file-not-found message before any origin/token/network call', async () => {
    const fetchFn = jasmine.createSpy('fetch');
    const origin = { resolve: jasmine.createSpy('resolve') };
    const missingFile = path.join(repoPath, 'does-not-exist.md');
    const githubIssue = new GithubIssue(undefined, { ...stubDeps({ origin }), fetchFn });

    await expectAsync(githubIssue.create(repoPath, 'title', missingFile)).toBeRejectedWithError(
      `Error: file not found: ${missingFile}`
    );

    expect(fetchFn).not.toHaveBeenCalled();
    expect(origin.resolve).not.toHaveBeenCalled();
  });

  it('throws the exact create-failure message on a non-2xx response', async () => {
    const fetchFn = jasmine.createSpy('fetch').and.resolveTo({ ok: false, status: 422, json: async () => ({}) });
    const file = await writeBodyFile('the body');
    const githubIssue = new GithubIssue(undefined, { ...stubDeps(), fetchFn });

    await expectAsync(githubIssue.create(repoPath, 'title', file)).toBeRejectedWithError(
      'Error: could not create issue on darthjee/arcanum'
    );
  });

  it('throws the exact create-failure message on a network error', async () => {
    const fetchFn = jasmine.createSpy('fetch').and.rejectWith(new Error('network down'));
    const file = await writeBodyFile('the body');
    const githubIssue = new GithubIssue(undefined, { ...stubDeps(), fetchFn });

    await expectAsync(githubIssue.create(repoPath, 'title', file)).toBeRejectedWithError(
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
    const githubIssue = new GithubIssue(undefined, { ...stubDeps({ githubToken }), fetchFn: jasmine.createSpy('fetch') });

    await expectAsync(githubIssue.create(repoPath, 'title', file)).toBeRejectedWithError(
      'Error: could not obtain GitHub token via gh auth token'
    );
  });

  it('resolves repoPath from the injected RepoContext and shifts the passed positionals', async () => {
    const payload = await loadFixture('github_issue_create_success.json');
    const fetchFn = jasmine.createSpy('fetch').and.resolveTo({ ok: true, json: async () => payload });
    const file = await writeBodyFile('the body');
    const deps = stubDeps();
    const githubIssue = new GithubIssue(new RepoContext({ repoPath }), { ...deps, fetchFn });

    const result = await githubIssue.create('New feature: dark mode', file);

    expect(result).toEqual(
      'ID=42\nTITLE=New feature: dark mode\nFILE=docs/agents/issues/42-new-feature-dark-mode.md\n' +
        'DOMAIN=github.com\nREPO=darthjee/arcanum\n'
    );
    expect(fetchFn).toHaveBeenCalledWith('https://api.github.com/repos/darthjee/arcanum/issues', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer fake-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title: 'New feature: dark mode', body: 'the body' }),
      signal: jasmine.any(AbortSignal)
    });

    const written = await readFile(path.join(repoPath, 'docs/agents/issues/42-new-feature-dark-mode.md'), 'utf8');
    expect(written).toEqual('the body\n');
  });
});
