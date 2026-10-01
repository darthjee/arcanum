import { mkdir, readFile, stat, utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';
import DraftStore from '../../../../lib/commands/arcanum-create-issue/DraftStore.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

describe('DraftStore', () => {
  const NOW = new Date('2026-10-01T12:30:45.123Z');
  let repoPath;
  let store;
  let dir;

  beforeEach(async () => {
    repoPath = await createTempDir();
    store = new DraftStore({ repoPath, now: () => NOW });
    dir = path.join(repoPath, '.claude/state/create-issue');
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  async function writeDraft(name, content, mtime) {
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, name);

    await writeFile(file, content);
    if (mtime) {
      await utimes(file, mtime, mtime);
    }

    return file;
  }

  describe('#dir', () => {
    it('is the absolute drafts directory', () => {
      expect(store.dir).toEqual(dir);
    });
  });

  describe('#list', () => {
    it('returns an empty list when the directory does not exist', async () => {
      expect(await store.list()).toEqual([]);
    });

    it('lists *.md drafts newest first with timestamp and title', async () => {
      const older = await writeDraft('a.md', '# Older idea\nbody\n', new Date('2026-09-01T00:00:00Z'));
      const newer = await writeDraft('b.md', 'just a line\n', new Date('2026-09-30T10:00:00Z'));
      await writeDraft('notes.txt', 'ignored');
      await mkdir(path.join(dir, 'sub.md'));

      const drafts = await store.list();

      expect(drafts.map(({ path: file, timestamp, title }) => ({ file, timestamp, title }))).toEqual([
        { file: newer, timestamp: '2026-09-30T10:00:00Z', title: 'just a line' },
        { file: older, timestamp: '2026-09-01T00:00:00Z', title: 'Older idea' }
      ]);
    });

    it('breaks mtime ties by path, descending', async () => {
      const mtime = new Date('2026-09-01T00:00:00Z');
      const first = await writeDraft('a.md', '', mtime);
      const second = await writeDraft('b.md', '', mtime);

      expect((await store.list()).map((draft) => draft.path)).toEqual([second, first]);
    });
  });

  describe('#create', () => {
    it('creates an empty, timestamp-named draft', async () => {
      const file = await store.create();

      expect(file).toEqual(path.join(dir, '20261001-123045.md'));
      expect(await readFile(file, 'utf8')).toEqual('');
    });

    it('adds a suffix when the name is taken', async () => {
      await store.create();

      expect(await store.create()).toEqual(path.join(dir, '20261001-123045-1.md'));
    });

    it('rethrows unexpected write errors', async () => {
      const error = Object.assign(new Error('permission denied'), { code: 'EACCES' });
      const writeFile = jasmine.createSpy('writeFile').and.rejectWith(error);

      store = new DraftStore({ repoPath, now: () => NOW, writeFile });

      await expectAsync(store.create()).toBeRejectedWith(error);
      expect(writeFile).toHaveBeenCalledTimes(1);
    });

    it('gives up after too many taken names', async () => {
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, '20261001-123045.md'), '');
      for (let index = 1; index < 100; index += 1) {
        await writeFile(path.join(dir, `20261001-123045-${index}.md`), '');
      }

      await expectAsync(store.create()).toBeRejectedWithError(`could not create a draft under ${dir}`);
    });
  });

  describe('#resolve', () => {
    it('resolves a repo-relative draft path', async () => {
      const file = await writeDraft('a.md', 'x');

      expect(await store.resolve('.claude/state/create-issue/a.md', repoPath)).toEqual(file);
    });

    it('resolves an absolute draft path', async () => {
      const file = await writeDraft('a.md', 'x');

      expect(await store.resolve(file, repoPath)).toEqual(file);
    });

    it('rejects a missing draft', async () => {
      expect(await store.resolve(path.join(dir, 'missing.md'), repoPath)).toBeNull();
    });

    it('rejects a file outside the drafts directory', async () => {
      await writeFile(path.join(repoPath, 'outside.md'), 'x');

      expect(await store.resolve('outside.md', repoPath)).toBeNull();
    });

    it('rejects a non-markdown file', async () => {
      await writeDraft('a.txt', 'x');

      expect(await store.resolve(path.join(dir, 'a.txt'), repoPath)).toBeNull();
    });

    it('rejects a directory', async () => {
      await mkdir(path.join(dir, 'd.md'), { recursive: true });

      expect(await store.resolve(path.join(dir, 'd.md'), repoPath)).toBeNull();
    });
  });

  describe('#label', () => {
    it('prefers the first level-1 heading', async () => {
      const file = await writeDraft('a.md', '\nintro\n## Sub\n# The title \nbody\n');

      expect(await store.label(file)).toEqual('The title');
    });

    it('falls back to the first non-blank line', async () => {
      const file = await writeDraft('a.md', '\n\n  first line  \nsecond\n');

      expect(await store.label(file)).toEqual('first line');
    });

    it('is empty for a blank draft', async () => {
      const file = await writeDraft('a.md', '\n\n');

      expect(await store.label(file)).toEqual('');
    });
  });

  describe('#body', () => {
    it('strips the first level-1 heading and surrounding blank lines', async () => {
      const file = await writeDraft('a.md', '# Title\n\n## Context\n\n  indented\n# Other\n\n\n');

      expect(await store.body(file)).toEqual('## Context\n\n  indented\n# Other');
    });

    it('keeps everything when there is no heading', async () => {
      const file = await writeDraft('a.md', 'plain body\n');

      expect(await store.body(file)).toEqual('plain body');
    });

    it('is empty when only the heading exists', async () => {
      const file = await writeDraft('a.md', '# Title\n\n');

      expect(await store.body(file)).toEqual('');
    });
  });

  describe('#delete', () => {
    it('removes the draft', async () => {
      const file = await writeDraft('a.md', 'x');

      await store.delete(file);

      await expectAsync(stat(file)).toBeRejected();
    });
  });

  describe('defaults', () => {
    it('uses the real clock when none is injected', async () => {
      const file = await new DraftStore({ repoPath }).create();

      expect(path.basename(file)).toMatch(/^\d{8}-\d{6}\.md$/);
    });
  });
});
