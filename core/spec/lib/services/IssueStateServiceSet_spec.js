import { readFile } from 'node:fs/promises';
import path from 'node:path';
import RepoContext from '../../../lib/context/RepoContext.js';
import IssueStateService from '../../../lib/services/IssueStateService.js';
import Lock from '../../../lib/utils/file/Lock.js';
import { createTempDir, removeTempDir } from '../../support/utils/tempDir.js';

describe('IssueStateService (field setters)', () => {
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

  describe('#set', () => {
    it('overwrites an existing field', async () => {
      const issueStateService = new IssueStateService({ context, lock: new Lock({ sleepMs: 5 }) });

      await issueStateService.set('42', 'title', 'First');
      await issueStateService.set('42', 'title', 'Second');

      const written = JSON.parse(await readFile(stateFile, 'utf8'));

      expect(written).toEqual({ title: 'Second' });
    });

    it('merges into (rather than replaces) any pre-existing state', async () => {
      const issueStateService = new IssueStateService({ context, lock: new Lock({ sleepMs: 5 }) });

      await issueStateService.set('42', 'title', 'A Title');
      await issueStateService.set('42', 'state', 'open');

      const written = JSON.parse(await readFile(stateFile, 'utf8'));

      expect(written).toEqual({ title: 'A Title', state: 'open' });
    });

    it('acquires and releases the lock file around the write', async () => {
      const lock = new Lock({ sleepMs: 5 });
      spyOn(lock, 'acquire').and.callThrough();
      spyOn(lock, 'release').and.callThrough();

      const issueStateService = new IssueStateService({ context, lock });

      await issueStateService.set('42', 'title', 'A Title');

      const lockFile = path.join(repoPath, '.claude', 'state', 'issue-42.lock');

      expect(lock.acquire).toHaveBeenCalledWith(lockFile);
      expect(lock.release).toHaveBeenCalledWith(lockFile);
    });

    it('does not corrupt state under two near-simultaneous sets to the same issue', async () => {
      const issueStateServiceA = new IssueStateService({ context, lock: new Lock({ sleepMs: 5 }) });
      const issueStateServiceB = new IssueStateService({ context, lock: new Lock({ sleepMs: 5 }) });

      await Promise.all([
        issueStateServiceA.set('42', 'title', 'From A'),
        issueStateServiceB.set('42', 'state', 'open')
      ]);

      const written = JSON.parse(await readFile(stateFile, 'utf8'));

      expect(written.title === 'From A' || written.state === 'open').toBeTrue();
      expect(typeof written).toEqual('object');
    });
  });

  describe('#setJson', () => {
    it('sets an object value', async () => {
      const issueStateService = new IssueStateService({ context, lock: new Lock({ sleepMs: 5 }) });

      await issueStateService.setJson('42', 'meta', JSON.stringify({ priority: 'high' }));

      const written = JSON.parse(await readFile(stateFile, 'utf8'));

      expect(written).toEqual({ meta: { priority: 'high' } });
    });

    it('sets an array value', async () => {
      const issueStateService = new IssueStateService({ context, lock: new Lock({ sleepMs: 5 }) });

      await issueStateService.setJson('42', 'tags', JSON.stringify(['a', 'b']));

      const written = JSON.parse(await readFile(stateFile, 'utf8'));

      expect(written).toEqual({ tags: ['a', 'b'] });
    });

    it('merges into (rather than replaces) any pre-existing state', async () => {
      const issueStateService = new IssueStateService({ context, lock: new Lock({ sleepMs: 5 }) });

      await issueStateService.write('42', { title: 'A Title' });
      await issueStateService.setJson('42', 'tags', JSON.stringify(['a']));

      const written = JSON.parse(await readFile(stateFile, 'utf8'));

      expect(written).toEqual({ title: 'A Title', tags: ['a'] });
    });

    it('acquires and releases the lock file around the write', async () => {
      const lock = new Lock({ sleepMs: 5 });
      spyOn(lock, 'acquire').and.callThrough();
      spyOn(lock, 'release').and.callThrough();

      const issueStateService = new IssueStateService({ context, lock });

      await issueStateService.setJson('42', 'tags', JSON.stringify(['a']));

      const lockFile = path.join(repoPath, '.claude', 'state', 'issue-42.lock');

      expect(lock.acquire).toHaveBeenCalledWith(lockFile);
      expect(lock.release).toHaveBeenCalledWith(lockFile);
    });
  });
});
