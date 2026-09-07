import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import QueueStore from '../../../../lib/utils/queue/QueueStore.js';
import { createRepoContextMock } from '../../../support/factories/repoContextFactory.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

describe('QueueStore', () => {
  let dir;
  let queueFile;
  let lockFile;
  let repoContext;
  let store;

  beforeEach(async () => {
    dir = await createTempDir();
    queueFile = path.join(dir, '.claude', 'state', 'auto-fix-all-queue.json');
    lockFile = path.join(dir, '.claude', 'state', 'auto-fix-all-queue.lock');
    repoContext = createRepoContextMock({ repoPath: dir });
    store = new QueueStore(repoContext);
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  describe('#queueFile', () => {
    it('resolves .claude/state/auto-fix-all-queue.json under the repoContext repo path', () => {
      expect(store.queueFile()).toEqual(queueFile);
    });
  });

  describe('#lockFile', () => {
    it('resolves .claude/state/auto-fix-all-queue.lock under the repoContext repo path', () => {
      expect(store.lockFile()).toEqual(lockFile);
    });
  });

  describe('#read', () => {
    it('returns an empty array when the queue file is absent', async () => {
      await expectAsync(store.read()).toBeResolvedTo([]);
    });

    it('returns an empty array when the queue file is empty', async () => {
      await mkdir(path.dirname(queueFile), { recursive: true });
      await writeFile(queueFile, '');

      await expectAsync(store.read()).toBeResolvedTo([]);
    });

    it('parses a non-empty queue file as JSON', async () => {
      await mkdir(path.dirname(queueFile), { recursive: true });
      await writeFile(queueFile, JSON.stringify([{ id: 'a' }, { id: 'b' }]));

      await expectAsync(store.read()).toBeResolvedTo([{ id: 'a' }, { id: 'b' }]);
    });

    it('rejects for a malformed (non-JSON) queue file', async () => {
      await mkdir(path.dirname(queueFile), { recursive: true });
      await writeFile(queueFile, 'not json');

      await expectAsync(store.read()).toBeRejected();
    });
  });

  describe('#write', () => {
    it('creates the containing directory as needed', async () => {
      await store.write([{ id: 'a' }]);

      await expectAsync(access(queueFile)).toBeResolved();
    });

    it('writes pretty-printed JSON with a trailing newline', async () => {
      await store.write([{ id: 'a' }, { id: 'b' }]);

      const raw = await readFile(queueFile, 'utf8');

      expect(raw).toEqual(`${JSON.stringify([{ id: 'a' }, { id: 'b' }], null, 2)}\n`);
      expect(JSON.parse(raw)).toEqual([{ id: 'a' }, { id: 'b' }]);
    });

    it('overwrites any existing queue file content', async () => {
      await store.write([{ id: 'old' }]);
      await store.write([{ id: 'new' }]);

      await expectAsync(store.read()).toBeResolvedTo([{ id: 'new' }]);
    });
  });
});
