import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import GithubIssue from '../../lib/GithubIssue.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'support', 'fixtures');

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
});
