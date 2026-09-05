import { readFile } from 'node:fs/promises';
import path from 'node:path';
import RepoContext from '../../../lib/context/RepoContext.js';
import IssueStateService from '../../../lib/services/IssueStateService.js';
import Lock from '../../../lib/utils/file/Lock.js';
import { createTempDir, removeTempDir } from '../../support/utils/tempDir.js';

describe('IssueStateService#appendJson', () => {
  let repoPath;
  let context;
  let stateFile;

  beforeEach(async () => {
    repoPath = await createTempDir();
    context = new RepoContext({ repoPath });
    stateFile = path.join(repoPath, '.claude', 'state', 'issue-42.json');
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  it('creates a one-element array when the field does not exist yet', async () => {
    const issueStateService = new IssueStateService({ context, lock: new Lock({ sleepMs: 5 }) });

    await issueStateService.appendJson('42', 'tags', JSON.stringify('a'));

    const written = JSON.parse(await readFile(stateFile, 'utf8'));

    expect(written).toEqual({ tags: ['a'] });
  });

  it('appends to a field that is already an array', async () => {
    const issueStateService = new IssueStateService({ context, lock: new Lock({ sleepMs: 5 }) });

    await issueStateService.setJson('42', 'tags', JSON.stringify(['a', 'b']));
    await issueStateService.appendJson('42', 'tags', JSON.stringify('c'));

    const written = JSON.parse(await readFile(stateFile, 'utf8'));

    expect(written).toEqual({ tags: ['a', 'b', 'c'] });
  });

  it('acquires and releases the lock file around the write', async () => {
    const lock = new Lock({ sleepMs: 5 });
    spyOn(lock, 'acquire').and.callThrough();
    spyOn(lock, 'release').and.callThrough();

    const issueStateService = new IssueStateService({ context, lock });

    await issueStateService.appendJson('42', 'tags', JSON.stringify('a'));

    const lockFile = path.join(repoPath, '.claude', 'state', 'issue-42.lock');

    expect(lock.acquire).toHaveBeenCalledWith(lockFile);
    expect(lock.release).toHaveBeenCalledWith(lockFile);
  });

  it('does not corrupt state under two near-simultaneous appends to the same issue', async () => {
    const issueStateServiceA = new IssueStateService({ context, lock: new Lock({ sleepMs: 5 }) });
    const issueStateServiceB = new IssueStateService({ context, lock: new Lock({ sleepMs: 5 }) });

    await Promise.all([
      issueStateServiceA.appendJson('42', 'tags', JSON.stringify('a')),
      issueStateServiceB.appendJson('42', 'tags', JSON.stringify('b'))
    ]);

    const written = JSON.parse(await readFile(stateFile, 'utf8'));

    expect(Array.isArray(written.tags)).toBeTrue();
    expect(written.tags.length).toEqual(2);
    expect(written.tags).toContain('a');
    expect(written.tags).toContain('b');
  });
});
