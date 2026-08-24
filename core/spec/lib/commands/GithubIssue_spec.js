import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import GithubIssue from '../../../lib/commands/GithubIssue.js';
import { createTempDir, removeTempDir } from '../../support/utils/tempDir.js';

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'support', 'fixtures');

/**
 * @param {string} name - the fixture file's name.
 * @returns {Promise<object>} the parsed fixture JSON.
 */
async function loadFixture(name) {
  return JSON.parse(await readFile(path.join(fixturesDir, name), 'utf8'));
}

/**
 * @param {object} [overrides] - collaborator overrides.
 * @returns {object} a set of stub collaborators for GithubIssue.
 */
function stubDeps(overrides = {}) {
  return {
    origin: { resolve: async () => ({ domain: 'github.com', repo: 'darthjee/arcanum' }) },
    githubToken: { get: async () => 'fake-token' },
    issueState: { write: jasmine.createSpy('write').and.resolveTo(undefined) },
    repoPath: { validate: jasmine.createSpy('validate').and.resolveTo(undefined) },
    ...overrides
  };
}

describe('GithubIssue', () => {
  let repoPath;

  beforeEach(async () => {
    repoPath = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  describe('#fetch', () => {
    it('writes the issue body to docs/agents/issues/<id>-<slug>.md and returns the STATUS=ok fields', async () => {
      const payload = await loadFixture('github_issue_success.json');
      const fetchFn = jasmine.createSpy('fetch').and.resolveTo({
        ok: true,
        json: async () => payload
      });
      const deps = stubDeps();
      const githubIssue = new GithubIssue({ ...deps, fetchFn });

      const result = await githubIssue.fetch(repoPath, '321');

      expect(result.title).toEqual(payload.title);
      expect(result.domain).toEqual('github.com');
      expect(result.repo).toEqual('darthjee/arcanum');
      expect(result.file).toEqual('docs/agents/issues/321-bug-crash-on-save-caf-dition-see-12.md');

      const written = await readFile(path.join(repoPath, result.file), 'utf8');
      expect(written).toEqual(`${payload.body}\n`);
    });

    it('calls fetch with the correct REST URL and Authorization header', async () => {
      const payload = await loadFixture('github_issue_success.json');
      const fetchFn = jasmine.createSpy('fetch').and.resolveTo({ ok: true, json: async () => payload });
      const githubIssue = new GithubIssue({ ...stubDeps(), fetchFn });

      await githubIssue.fetch(repoPath, '321');

      expect(fetchFn).toHaveBeenCalledWith(
        'https://api.github.com/repos/darthjee/arcanum/issues/321',
        jasmine.objectContaining({ headers: { Authorization: 'Bearer fake-token' } })
      );
    });

    it('maps GitHub labels to canonical tags, deduplicated, and writes the state file', async () => {
      const payload = await loadFixture('github_issue_success.json');
      const fetchFn = jasmine.createSpy('fetch').and.resolveTo({ ok: true, json: async () => payload });
      const issueState = { write: jasmine.createSpy('write').and.resolveTo(undefined) };
      const githubIssue = new GithubIssue({ ...stubDeps({ issueState }), fetchFn });

      await githubIssue.fetch(repoPath, '321');

      expect(issueState.write).toHaveBeenCalledWith(repoPath, '321', {
        tags: ['created', 'ready_for_work'],
        updated_at: payload.updated_at,
        title: payload.title,
        state: payload.state
      });
    });

    it('sanitizes a title with symbols/uppercase/unicode into a safe filename slug', async () => {
      const fetchFn = jasmine.createSpy('fetch').and.resolveTo({
        ok: true,
        json: async () => ({
          title: 'Weird///Title!! ÜBER (v2)',
          body: 'body',
          state: 'open',
          updated_at: '2026-01-01T00:00:00Z',
          labels: []
        })
      });
      const githubIssue = new GithubIssue({ ...stubDeps(), fetchFn });

      const result = await githubIssue.fetch(repoPath, '7');

      expect(result.file).toEqual('docs/agents/issues/7-weird-title-ber-v2.md');
    });

    it('throws the exact fetch-failure message on a non-2xx response', async () => {
      const notFound = await loadFixture('github_issue_not_found.json');
      const fetchFn = jasmine.createSpy('fetch').and.resolveTo({
        ok: false,
        status: 404,
        json: async () => notFound
      });
      const githubIssue = new GithubIssue({ ...stubDeps(), fetchFn });

      await expectAsync(githubIssue.fetch(repoPath, '404')).toBeRejectedWithError(
        'Error: could not fetch issue #404 from darthjee/arcanum'
      );
    });

    it('throws the exact fetch-failure message on a network error', async () => {
      const fetchFn = jasmine.createSpy('fetch').and.rejectWith(new Error('network down'));
      const githubIssue = new GithubIssue({ ...stubDeps(), fetchFn });

      await expectAsync(githubIssue.fetch(repoPath, '5')).toBeRejectedWithError(
        'Error: could not fetch issue #5 from darthjee/arcanum'
      );
    });

    it('surfaces the exact auth-failure message when a token cannot be obtained', async () => {
      const githubToken = {
        get: async () => {
          throw new Error('Error: could not obtain GitHub token via gh auth token');
        }
      };
      const githubIssue = new GithubIssue({ ...stubDeps({ githubToken }), fetchFn: jasmine.createSpy('fetch') });

      await expectAsync(githubIssue.fetch(repoPath, '5')).toBeRejectedWithError(
        'Error: could not obtain GitHub token via gh auth token'
      );
    });

    it('aborts the request once the configured timeout elapses', async () => {
      const fetchFn = (url, options) =>
        new Promise((resolve, reject) => {
          options.signal.addEventListener('abort', () => reject(new Error('aborted')));
        });
      const githubIssue = new GithubIssue({ ...stubDeps(), fetchFn, timeoutMs: 10 });

      const start = Date.now();

      await expectAsync(githubIssue.fetch(repoPath, '5')).toBeRejectedWithError(
        'Error: could not fetch issue #5 from darthjee/arcanum'
      );

      expect(Date.now() - start).toBeLessThan(1000);
    });
  });

  describe('#info', () => {
    it('returns the DOMAIN=/REPO= fields resolved from origin', async () => {
      const githubIssue = new GithubIssue(stubDeps());

      const result = await githubIssue.info(repoPath);

      expect(result).toEqual('DOMAIN=github.com\nREPO=darthjee/arcanum\n');
    });

    it('round-trips a non-GitHub domain into the same DOMAIN=/REPO= shape', async () => {
      const origin = { resolve: async () => ({ domain: 'git.example.com', repo: 'acme/widgets' }) };
      const githubIssue = new GithubIssue(stubDeps({ origin }));

      const result = await githubIssue.info(repoPath);

      expect(result).toEqual('DOMAIN=git.example.com\nREPO=acme/widgets\n');
    });

    it('propagates origin.resolve\'s rejection message unchanged', async () => {
      const origin = {
        resolve: async () => {
          throw new Error(`Error: '${repoPath}' is not a git repository or has no 'origin' remote`);
        }
      };
      const githubIssue = new GithubIssue(stubDeps({ origin }));

      await expectAsync(githubIssue.info(repoPath)).toBeRejectedWithError(
        `Error: '${repoPath}' is not a git repository or has no 'origin' remote`
      );
    });
  });

  describe('#create', () => {
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
      const githubIssue = new GithubIssue({ ...stubDeps(), fetchFn });

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
        const githubIssue = new GithubIssue({ ...stubDeps(), fetchFn });

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
      const githubIssue = new GithubIssue({ ...stubDeps(), fetchFn });

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

    it('does not call issueState.write', async () => {
      const payload = await loadFixture('github_issue_create_success.json');
      const fetchFn = jasmine.createSpy('fetch').and.resolveTo({ ok: true, json: async () => payload });
      const file = await writeBodyFile('the body');
      const issueState = { write: jasmine.createSpy('write').and.resolveTo(undefined) };
      const githubIssue = new GithubIssue({ ...stubDeps({ issueState }), fetchFn });

      await githubIssue.create(repoPath, 'New feature: dark mode', file);

      expect(issueState.write).not.toHaveBeenCalled();
    });

    it('propagates repoPath.validate rejection and makes no network call', async () => {
      const repoPathDep = {
        validate: jasmine.createSpy('validate').and.rejectWith(new Error(`Error: not a directory: ${repoPath}`))
      };
      const fetchFn = jasmine.createSpy('fetch');
      const origin = { resolve: jasmine.createSpy('resolve') };
      const githubIssue = new GithubIssue({ ...stubDeps({ repoPath: repoPathDep, origin }), fetchFn });

      await expectAsync(githubIssue.create(repoPath, 'title', 'missing.md')).toBeRejectedWithError(
        `Error: not a directory: ${repoPath}`
      );

      expect(fetchFn).not.toHaveBeenCalled();
      expect(origin.resolve).not.toHaveBeenCalled();
    });

    it('rejects with the exact file-not-found message before any origin/token/network call', async () => {
      const fetchFn = jasmine.createSpy('fetch');
      const origin = { resolve: jasmine.createSpy('resolve') };
      const missingFile = path.join(repoPath, 'does-not-exist.md');
      const githubIssue = new GithubIssue({ ...stubDeps({ origin }), fetchFn });

      await expectAsync(githubIssue.create(repoPath, 'title', missingFile)).toBeRejectedWithError(
        `Error: file not found: ${missingFile}`
      );

      expect(fetchFn).not.toHaveBeenCalled();
      expect(origin.resolve).not.toHaveBeenCalled();
    });

    it('throws the exact create-failure message on a non-2xx response', async () => {
      const fetchFn = jasmine.createSpy('fetch').and.resolveTo({ ok: false, status: 422, json: async () => ({}) });
      const file = await writeBodyFile('the body');
      const githubIssue = new GithubIssue({ ...stubDeps(), fetchFn });

      await expectAsync(githubIssue.create(repoPath, 'title', file)).toBeRejectedWithError(
        'Error: could not create issue on darthjee/arcanum'
      );
    });

    it('throws the exact create-failure message on a network error', async () => {
      const fetchFn = jasmine.createSpy('fetch').and.rejectWith(new Error('network down'));
      const file = await writeBodyFile('the body');
      const githubIssue = new GithubIssue({ ...stubDeps(), fetchFn });

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
      const githubIssue = new GithubIssue({ ...stubDeps({ githubToken }), fetchFn: jasmine.createSpy('fetch') });

      await expectAsync(githubIssue.create(repoPath, 'title', file)).toBeRejectedWithError(
        'Error: could not obtain GitHub token via gh auth token'
      );
    });
  });
});
