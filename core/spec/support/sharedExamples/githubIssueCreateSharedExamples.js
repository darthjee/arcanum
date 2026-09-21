import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadFixture, stubDeps } from '../factories/githubIssue.js';
import { createTempDir, removeTempDir } from '../utils/tempDir.js';

/**
 * Shared example: `#create` on a "create GitHub issue" wrapper, exercised
 * identically regardless of which class actually implements it (the
 * `GithubIssue` command wrapper vs. `GithubIssueService`). Registers the
 * temp-dir `beforeEach`/`afterEach` and the 8 request/response scenarios
 * common to both specs, inside whichever `describe` block calls it.
 * @param {(deps: object) => object} buildInstance - builds the instance
 *   under test from a set of collaborator overrides, e.g.
 *   `(deps) => new GithubIssue(undefined, deps)` or
 *   `(deps) => new GithubIssueService(deps)`.
 * @returns {{getRepoPath: () => string, writeBodyFile: (content: string) => Promise<string>}}
 *   a context object exposing the shared temp repo path and body-file
 *   writer, for callers that need to add their own wrapper-specific
 *   scenarios alongside this shared example.
 */
export function registerGithubIssueCreateSharedExamples(buildInstance) {
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
    const instance = buildInstance({ ...stubDeps(), fetchFn });

    const result = await instance.create(repoPath, 'New feature: dark mode', file);

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
      const instance = buildInstance({ ...stubDeps(), fetchFn });

      await instance.create(repoPath, 'New feature: dark mode', file);

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
    const instance = buildInstance({ ...stubDeps(), fetchFn });

    await instance.create(repoPath, 'New feature: dark mode', file);

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
    const instance = buildInstance({ ...stubDeps(), fetchFn });

    await instance.create(repoPath, 'New feature: dark mode', file);

    const stateFile = path.join(repoPath, '.claude', 'state', 'issue-42.json');

    await expectAsync(readFile(stateFile, 'utf8')).toBeRejected();
  });

  it('rejects with the exact file-not-found message before any origin/token/network call', async () => {
    const fetchFn = jasmine.createSpy('fetch');
    const origin = { resolve: jasmine.createSpy('resolve') };
    const missingFile = path.join(repoPath, 'does-not-exist.md');
    const instance = buildInstance({ ...stubDeps({ origin }), fetchFn });

    await expectAsync(instance.create(repoPath, 'title', missingFile)).toBeRejectedWithError(
      `Error: file not found: ${missingFile}`
    );

    expect(fetchFn).not.toHaveBeenCalled();
    expect(origin.resolve).not.toHaveBeenCalled();
  });

  it('throws the exact create-failure message on a non-2xx response', async () => {
    const fetchFn = jasmine.createSpy('fetch').and.resolveTo({ ok: false, status: 422, json: async () => ({}) });
    const file = await writeBodyFile('the body');
    const instance = buildInstance({ ...stubDeps(), fetchFn });

    await expectAsync(instance.create(repoPath, 'title', file)).toBeRejectedWithError(
      'Error: could not create issue on darthjee/arcanum'
    );
  });

  it('throws the exact create-failure message on a network error', async () => {
    const fetchFn = jasmine.createSpy('fetch').and.rejectWith(new Error('network down'));
    const file = await writeBodyFile('the body');
    const instance = buildInstance({ ...stubDeps(), fetchFn });

    await expectAsync(instance.create(repoPath, 'title', file)).toBeRejectedWithError(
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
    const instance = buildInstance({ ...stubDeps({ githubToken }), fetchFn: jasmine.createSpy('fetch') });

    await expectAsync(instance.create(repoPath, 'title', file)).toBeRejectedWithError(
      'Error: could not obtain GitHub token via gh auth token'
    );
  });

  return { getRepoPath: () => repoPath, writeBodyFile };
}
