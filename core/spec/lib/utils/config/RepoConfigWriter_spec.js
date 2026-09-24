import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import RepoConfigWriter from '../../../../lib/utils/config/RepoConfigWriter.js';
import Lock from '../../../../lib/utils/file/Lock.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

describe('RepoConfigWriter', () => {
  let dir;
  let lock;
  let writer;
  let newFile;
  let legacyFile;

  beforeEach(async () => {
    dir = await createTempDir();
    lock = new Lock({ sleepMs: 5 });
    writer = new RepoConfigWriter({ lock });
    newFile = path.join(dir, '.claude', 'configuration', 'arcanum-repo-config.json');
    legacyFile = path.join(dir, '.claude', 'configuration', 'auto-fix-all.json');
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  /**
   * @param {string} file - the file to create (parents included).
   * @param {string} contents - its contents.
   * @returns {Promise<void>} resolves once written.
   */
  async function seedFile(file, contents) {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, contents);
  }

  /**
   * @param {object} [overrides] - `write` argument overrides.
   * @returns {Promise<void>} resolves once written.
   */
  function writePatterns(overrides = {}) {
    return writer.write({
      newFile,
      legacyFile,
      namespace: 'auto-fix-all',
      key: 'ignored_check_patterns',
      value: ['a', 'b'],
      ...overrides
    });
  }

  describe('#write', () => {
    it('creates the file and its parent directories', async () => {
      await writePatterns();

      expect(await readFile(newFile, 'utf8')).toEqual(
        '{\n  "auto-fix-all": {\n    "ignored_check_patterns": [\n      "a",\n      "b"\n    ]\n  }\n}\n'
      );
    });

    it('writes an empty array as []', async () => {
      await writePatterns({ value: [] });

      expect(await readFile(newFile, 'utf8')).toEqual(
        '{\n  "auto-fix-all": {\n    "ignored_check_patterns": []\n  }\n}\n'
      );
    });

    it('preserves existing keys and their order, appending new ones', async () => {
      await seedFile(newFile, JSON.stringify({
        version: '1.0.0',
        'auto-fix-all': { ignored_check_patterns: ['old'], other: true },
        git: { safe_branch: 'x' }
      }));

      await writePatterns();

      expect(await readFile(newFile, 'utf8')).toEqual(`${JSON.stringify({
        version: '1.0.0',
        'auto-fix-all': { ignored_check_patterns: ['a', 'b'], other: true },
        git: { safe_branch: 'x' }
      }, null, 2)}\n`);
    });

    it('treats an invalid-JSON file as {}', async () => {
      await seedFile(newFile, 'not json');

      await writePatterns();

      expect(JSON.parse(await readFile(newFile, 'utf8'))).toEqual({
        'auto-fix-all': { ignored_check_patterns: ['a', 'b'] }
      });
    });

    it('treats a null namespace as {}', async () => {
      await seedFile(newFile, '{"auto-fix-all":null}');

      await writePatterns();

      expect(JSON.parse(await readFile(newFile, 'utf8'))).toEqual({
        'auto-fix-all': { ignored_check_patterns: ['a', 'b'] }
      });
    });

    it('seeds the namespace from the legacy file when absent', async () => {
      await seedFile(newFile, '{"version":"1.0.0"}');
      await seedFile(legacyFile, '{"legacy_key":1,"ignored_check_patterns":["z"]}');

      await writePatterns();

      expect(await readFile(newFile, 'utf8')).toEqual(`${JSON.stringify({
        version: '1.0.0',
        'auto-fix-all': { legacy_key: 1, ignored_check_patterns: ['a', 'b'] }
      }, null, 2)}\n`);
    });

    it('seeds from an empty legacy file as null', async () => {
      await seedFile(legacyFile, '');

      await writePatterns();

      expect(JSON.parse(await readFile(newFile, 'utf8'))).toEqual({
        'auto-fix-all': { ignored_check_patterns: ['a', 'b'] }
      });
    });

    it('does not reseed when the namespace already exists', async () => {
      await seedFile(newFile, '{"auto-fix-all":{"kept":true}}');
      await seedFile(legacyFile, '{"legacy_key":1}');

      await writePatterns();

      expect(JSON.parse(await readFile(newFile, 'utf8'))).toEqual({
        'auto-fix-all': { kept: true, ignored_check_patterns: ['a', 'b'] }
      });
    });

    it('rejects when the legacy file is not valid JSON', async () => {
      await seedFile(legacyFile, 'nope');

      await expectAsync(writePatterns()).toBeRejected();
      expect(existsSync(`${newFile}.lock`)).toBeFalse();
    });

    it('rejects when the file is valid JSON but not an object', async () => {
      await seedFile(newFile, '[1]');

      await expectAsync(writePatterns()).toBeRejectedWithError(/not a JSON object/);
    });

    it('rejects when the namespace holds a non-object', async () => {
      await seedFile(newFile, '{"auto-fix-all":"x"}');

      await expectAsync(writePatterns()).toBeRejectedWithError(/not a JSON object/);
    });

    it('acquires and releases <newFile>.lock', async () => {
      spyOn(lock, 'acquire').and.callThrough();
      spyOn(lock, 'release').and.callThrough();

      await writePatterns();

      expect(lock.acquire).toHaveBeenCalledWith(`${newFile}.lock`);
      expect(lock.release).toHaveBeenCalledWith(`${newFile}.lock`);
      expect(existsSync(`${newFile}.lock`)).toBeFalse();
      expect(existsSync(`${newFile}.tmp`)).toBeFalse();
    });

    it('releases the lock when the write throws', async () => {
      spyOn(lock, 'release').and.callThrough();
      const failing = new RepoConfigWriter({
        lock,
        fs: { writeFile: () => Promise.reject(new Error('disk full')) }
      });

      await expectAsync(failing.write({
        newFile, legacyFile, namespace: 'n', key: 'k', value: 1
      })).toBeRejectedWithError('disk full');
      expect(lock.release).toHaveBeenCalledWith(`${newFile}.lock`);
    });

    it('writes via <file>.tmp and renames it into place', async () => {
      const renameSpy = jasmine.createSpy('rename').and.callFake(rename);
      const spied = new RepoConfigWriter({ lock, fs: { rename: renameSpy } });

      await spied.write({ newFile, legacyFile, namespace: 'n', key: 'k', value: 1 });

      expect(renameSpy).toHaveBeenCalledWith(`${newFile}.tmp`, newFile);
    });
  });

  describe('#setVersion', () => {
    it('sets top-level .version on a new file', async () => {
      await writer.setVersion({ file: newFile, version: '1.2.3' });

      expect(await readFile(newFile, 'utf8')).toEqual('{\n  "version": "1.2.3"\n}\n');
    });

    it('replaces .version in place, preserving key order', async () => {
      await seedFile(newFile, '{"a":1,"version":"0.1.0","b":2}');

      await writer.setVersion({ file: newFile, version: '1.2.3' });

      expect(await readFile(newFile, 'utf8')).toEqual(
        '{\n  "a": 1,\n  "version": "1.2.3",\n  "b": 2\n}\n'
      );
    });

    it('sets .<namespace>.version when a namespace is given', async () => {
      const file = path.join(dir, '.claude', 'state', 'arcanum-config.json');

      await seedFile(file, '{"git":{"safe_branch":"x"},"migrations":{"other":1}}');

      await writer.setVersion({ file, version: '1.2.3', namespace: 'migrations' });

      expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({
        git: { safe_branch: 'x' },
        migrations: { other: 1, version: '1.2.3' }
      });
    });

    it('treats an invalid-JSON file as {}', async () => {
      await seedFile(newFile, '{');

      await writer.setVersion({ file: newFile, version: '1.2.3' });

      expect(await readFile(newFile, 'utf8')).toEqual('{\n  "version": "1.2.3"\n}\n');
    });

    it('acquires and releases <file>.lock', async () => {
      spyOn(lock, 'acquire').and.callThrough();
      spyOn(lock, 'release').and.callThrough();

      await writer.setVersion({ file: newFile, version: '1.2.3' });

      expect(lock.acquire).toHaveBeenCalledWith(`${newFile}.lock`);
      expect(lock.release).toHaveBeenCalledWith(`${newFile}.lock`);
    });
  });
});
