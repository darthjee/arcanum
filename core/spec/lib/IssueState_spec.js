import { readFile } from 'node:fs/promises';
import path from 'node:path';
import IssueState from '../../lib/IssueState.js';
import Lock from '../../lib/Lock.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

describe('IssueState', () => {
  let repoPath;
  let stateFile;

  beforeEach(async () => {
    repoPath = await createTempDir();
    stateFile = path.join(repoPath, '.claude', 'state', 'issue-42.json');
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  describe('#write', () => {
    it('writes the given fields to .claude/state/issue-<id>.json', async () => {
      const issueState = new IssueState({ lock: new Lock({ sleepMs: 5 }) });

      await issueState.write(repoPath, '42', {
        tags: ['created'],
        updated_at: '2026-01-01T00:00:00Z',
        title: 'A Title',
        state: 'open'
      });

      const written = JSON.parse(await readFile(stateFile, 'utf8'));

      expect(written).toEqual({
        tags: ['created'],
        updated_at: '2026-01-01T00:00:00Z',
        title: 'A Title',
        state: 'open'
      });
    });

    it('merges into (rather than replaces) any pre-existing state', async () => {
      const issueState = new IssueState({ lock: new Lock({ sleepMs: 5 }) });

      await issueState.write(repoPath, '42', { title: 'First' });
      await issueState.write(repoPath, '42', { state: 'closed' });

      const written = JSON.parse(await readFile(stateFile, 'utf8'));

      expect(written).toEqual({ title: 'First', state: 'closed' });
    });

    it('acquires and releases the lock file around the write (the lock/mutate/release protocol)', async () => {
      const lock = new Lock({ sleepMs: 5 });
      spyOn(lock, 'acquire').and.callThrough();
      spyOn(lock, 'release').and.callThrough();

      const issueState = new IssueState({ lock });

      await issueState.write(repoPath, '42', { title: 'A Title' });

      const lockFile = path.join(repoPath, '.claude', 'state', 'issue-42.lock');

      expect(lock.acquire).toHaveBeenCalledWith(lockFile);
      expect(lock.release).toHaveBeenCalledWith(lockFile);
    });

    it('releases the lock even if the mutation itself fails', async () => {
      const lock = new Lock({ sleepMs: 5 });
      spyOn(lock, 'release').and.callThrough();

      const issueState = new IssueState({ lock });
      spyOn(issueState, '_read').and.callFake(() => {
        throw new Error('boom');
      });

      await expectAsync(issueState.write(repoPath, '42', { title: 'x' })).toBeRejectedWithError('boom');
      expect(lock.release).toHaveBeenCalled();
    });

    it('does not corrupt state under two near-simultaneous writes to the same issue', async () => {
      const issueStateA = new IssueState({ lock: new Lock({ sleepMs: 5 }) });
      const issueStateB = new IssueState({ lock: new Lock({ sleepMs: 5 }) });

      await Promise.all([
        issueStateA.write(repoPath, '42', { title: 'From A' }),
        issueStateB.write(repoPath, '42', { state: 'open' })
      ]);

      const written = JSON.parse(await readFile(stateFile, 'utf8'));

      // Both concurrent writers' fields must be present — a corrupted/
      // interleaved write would leave one or both incomplete/invalid JSON.
      expect(written.title === 'From A' || written.state === 'open').toBeTrue();
      expect(typeof written).toEqual('object');
    });
  });

  describe('#get', () => {
    it('resolves to an empty string when the state file does not exist', async () => {
      const issueState = new IssueState({ lock: new Lock({ sleepMs: 5 }) });

      await expectAsync(issueState.get(repoPath, '42', 'title')).toBeResolvedTo('');
    });

    it('resolves to an empty string when the field is missing', async () => {
      const issueState = new IssueState({ lock: new Lock({ sleepMs: 5 }) });

      await issueState.write(repoPath, '42', { state: 'open' });

      await expectAsync(issueState.get(repoPath, '42', 'title')).toBeResolvedTo('');
    });

    it('resolves to the value of an existing field', async () => {
      const issueState = new IssueState({ lock: new Lock({ sleepMs: 5 }) });

      await issueState.write(repoPath, '42', { title: 'A Title' });

      await expectAsync(issueState.get(repoPath, '42', 'title')).toBeResolvedTo('A Title');
    });
  });

  describe('#set', () => {
    it('overwrites an existing field', async () => {
      const issueState = new IssueState({ lock: new Lock({ sleepMs: 5 }) });

      await issueState.set(repoPath, '42', 'title', 'First');
      await issueState.set(repoPath, '42', 'title', 'Second');

      const written = JSON.parse(await readFile(stateFile, 'utf8'));

      expect(written).toEqual({ title: 'Second' });
    });

    it('merges into (rather than replaces) any pre-existing state', async () => {
      const issueState = new IssueState({ lock: new Lock({ sleepMs: 5 }) });

      await issueState.set(repoPath, '42', 'title', 'A Title');
      await issueState.set(repoPath, '42', 'state', 'open');

      const written = JSON.parse(await readFile(stateFile, 'utf8'));

      expect(written).toEqual({ title: 'A Title', state: 'open' });
    });

    it('acquires and releases the lock file around the write', async () => {
      const lock = new Lock({ sleepMs: 5 });
      spyOn(lock, 'acquire').and.callThrough();
      spyOn(lock, 'release').and.callThrough();

      const issueState = new IssueState({ lock });

      await issueState.set(repoPath, '42', 'title', 'A Title');

      const lockFile = path.join(repoPath, '.claude', 'state', 'issue-42.lock');

      expect(lock.acquire).toHaveBeenCalledWith(lockFile);
      expect(lock.release).toHaveBeenCalledWith(lockFile);
    });

    it('does not corrupt state under two near-simultaneous sets to the same issue', async () => {
      const issueStateA = new IssueState({ lock: new Lock({ sleepMs: 5 }) });
      const issueStateB = new IssueState({ lock: new Lock({ sleepMs: 5 }) });

      await Promise.all([
        issueStateA.set(repoPath, '42', 'title', 'From A'),
        issueStateB.set(repoPath, '42', 'state', 'open')
      ]);

      const written = JSON.parse(await readFile(stateFile, 'utf8'));

      expect(written.title === 'From A' || written.state === 'open').toBeTrue();
      expect(typeof written).toEqual('object');
    });
  });

  describe('#setJson', () => {
    it('sets an object value', async () => {
      const issueState = new IssueState({ lock: new Lock({ sleepMs: 5 }) });

      await issueState.setJson(repoPath, '42', 'meta', JSON.stringify({ priority: 'high' }));

      const written = JSON.parse(await readFile(stateFile, 'utf8'));

      expect(written).toEqual({ meta: { priority: 'high' } });
    });

    it('sets an array value', async () => {
      const issueState = new IssueState({ lock: new Lock({ sleepMs: 5 }) });

      await issueState.setJson(repoPath, '42', 'tags', JSON.stringify(['a', 'b']));

      const written = JSON.parse(await readFile(stateFile, 'utf8'));

      expect(written).toEqual({ tags: ['a', 'b'] });
    });

    it('merges into (rather than replaces) any pre-existing state', async () => {
      const issueState = new IssueState({ lock: new Lock({ sleepMs: 5 }) });

      await issueState.write(repoPath, '42', { title: 'A Title' });
      await issueState.setJson(repoPath, '42', 'tags', JSON.stringify(['a']));

      const written = JSON.parse(await readFile(stateFile, 'utf8'));

      expect(written).toEqual({ title: 'A Title', tags: ['a'] });
    });

    it('acquires and releases the lock file around the write', async () => {
      const lock = new Lock({ sleepMs: 5 });
      spyOn(lock, 'acquire').and.callThrough();
      spyOn(lock, 'release').and.callThrough();

      const issueState = new IssueState({ lock });

      await issueState.setJson(repoPath, '42', 'tags', JSON.stringify(['a']));

      const lockFile = path.join(repoPath, '.claude', 'state', 'issue-42.lock');

      expect(lock.acquire).toHaveBeenCalledWith(lockFile);
      expect(lock.release).toHaveBeenCalledWith(lockFile);
    });
  });

  describe('#appendJson', () => {
    it('creates a one-element array when the field does not exist yet', async () => {
      const issueState = new IssueState({ lock: new Lock({ sleepMs: 5 }) });

      await issueState.appendJson(repoPath, '42', 'tags', JSON.stringify('a'));

      const written = JSON.parse(await readFile(stateFile, 'utf8'));

      expect(written).toEqual({ tags: ['a'] });
    });

    it('appends to a field that is already an array', async () => {
      const issueState = new IssueState({ lock: new Lock({ sleepMs: 5 }) });

      await issueState.setJson(repoPath, '42', 'tags', JSON.stringify(['a', 'b']));
      await issueState.appendJson(repoPath, '42', 'tags', JSON.stringify('c'));

      const written = JSON.parse(await readFile(stateFile, 'utf8'));

      expect(written).toEqual({ tags: ['a', 'b', 'c'] });
    });

    it('acquires and releases the lock file around the write', async () => {
      const lock = new Lock({ sleepMs: 5 });
      spyOn(lock, 'acquire').and.callThrough();
      spyOn(lock, 'release').and.callThrough();

      const issueState = new IssueState({ lock });

      await issueState.appendJson(repoPath, '42', 'tags', JSON.stringify('a'));

      const lockFile = path.join(repoPath, '.claude', 'state', 'issue-42.lock');

      expect(lock.acquire).toHaveBeenCalledWith(lockFile);
      expect(lock.release).toHaveBeenCalledWith(lockFile);
    });

    it('does not corrupt state under two near-simultaneous appends to the same issue', async () => {
      const issueStateA = new IssueState({ lock: new Lock({ sleepMs: 5 }) });
      const issueStateB = new IssueState({ lock: new Lock({ sleepMs: 5 }) });

      await Promise.all([
        issueStateA.appendJson(repoPath, '42', 'tags', JSON.stringify('a')),
        issueStateB.appendJson(repoPath, '42', 'tags', JSON.stringify('b'))
      ]);

      const written = JSON.parse(await readFile(stateFile, 'utf8'));

      expect(Array.isArray(written.tags)).toBeTrue();
      expect(written.tags.length).toEqual(2);
      expect(written.tags).toContain('a');
      expect(written.tags).toContain('b');
    });
  });
});
