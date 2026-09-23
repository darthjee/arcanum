import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import GithubIssue from '../../../../lib/commands/shared/GithubIssue.js';
import RepoContext from '../../../../lib/context/RepoContext.js';
import { stubDeps } from '../../../support/factories/githubIssue.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

describe('GithubIssue#update', () => {
  let repoPath;
  let bodyDir;

  beforeEach(async () => {
    repoPath = await createTempDir();
    bodyDir = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
    await removeTempDir(bodyDir);
  });

  async function writeBodyFile(contents) {
    const file = path.join(bodyDir, 'body.md');

    await writeFile(file, contents);

    return file;
  }

  function newGithubIssue(deps) {
    return new GithubIssue(new RepoContext({ repoPath }), { ...stubDeps(), ...deps });
  }

  it('returns the Updated output', async () => {
    const fetchFn = jasmine.createSpy('fetch').and.resolveTo({ ok: true });
    const file = await writeBodyFile('the body');

    const result = await newGithubIssue({ fetchFn }).update('12', 'New title', file);

    expect(result).toEqual('Updated issue #12 on darthjee/arcanum\n');
  });

  it('PATCHes the title and the body with all trailing newlines stripped', async () => {
    const fetchFn = jasmine.createSpy('fetch').and.resolveTo({ ok: true });
    const file = await writeBodyFile('line one\n\nline two\n\n\n');

    await newGithubIssue({ fetchFn }).update('12', 'New title', file);

    expect(fetchFn).toHaveBeenCalledWith('https://api.github.com/repos/darthjee/arcanum/issues/12', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer fake-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New title', body: 'line one\n\nline two' }),
      signal: jasmine.any(AbortSignal)
    });
  });

  it('resolves a relative file against the cwd, not against repoPath', async () => {
    const fetchFn = jasmine.createSpy('fetch').and.resolveTo({ ok: true });
    const file = path.relative(process.cwd(), await writeBodyFile('relative body'));

    await newGithubIssue({ fetchFn }).update('12', 'New title', file);

    expect(fetchFn).toHaveBeenCalledWith(
      jasmine.any(String),
      jasmine.objectContaining({ body: JSON.stringify({ title: 'New title', body: 'relative body' }) })
    );
  });

  it('throws file-not-found without resolving the origin when the file is missing', async () => {
    const fetchFn = jasmine.createSpy('fetch');
    const origin = jasmine.createSpyObj('origin', ['resolve', 'resolveWithRef']);
    const file = path.join(bodyDir, 'missing.md');

    await expectAsync(newGithubIssue({ fetchFn, origin }).update('12', 'New title', file))
      .toBeRejectedWithError(`Error: file not found: ${file}`);
    expect(origin.resolve).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('propagates the origin resolution error', async () => {
    const fetchFn = jasmine.createSpy('fetch');
    const message = `Error: '${repoPath}' is not a git repository or has no 'origin' remote`;
    const origin = {
      resolve: jasmine.createSpy('resolve').and.rejectWith(new Error(message)),
      resolveWithRef: jasmine.createSpy('resolveWithRef')
    };
    const file = await writeBodyFile('the body');

    await expectAsync(newGithubIssue({ fetchFn, origin }).update('12', 'New title', file))
      .toBeRejectedWithError(message);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('throws the update-failure message on a non-ok response', async () => {
    const fetchFn = jasmine.createSpy('fetch').and.resolveTo({ ok: false, status: 422 });
    const file = await writeBodyFile('the body');

    await expectAsync(newGithubIssue({ fetchFn }).update('12', 'New title', file))
      .toBeRejectedWithError('Error: could not update issue #12 on darthjee/arcanum');
  });

  it('throws the update-failure message on a network error', async () => {
    const fetchFn = jasmine.createSpy('fetch').and.rejectWith(new Error('network down'));
    const file = await writeBodyFile('the body');

    await expectAsync(newGithubIssue({ fetchFn }).update('12', 'New title', file))
      .toBeRejectedWithError('Error: could not update issue #12 on darthjee/arcanum');
  });
});
