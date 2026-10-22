import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import RepoConfigWriter from '../../lib/config/RepoConfigWriter.js';
import Lock from '../../lib/file/Lock.js';
import LockTimeoutError from '../../lib/file/LockTimeoutError.js';
import ConfigError from '../../lib/config/ConfigError.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

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

    it('skips seeding when no legacy file is given', async () => {
      spyOn(writer._fs, 'readFile').and.callThrough();

      await writePatterns({ legacyFile: '' });

      expect(writer._fs.readFile).not.toHaveBeenCalledWith('', 'utf8');
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

    it('rejects an invalid legacy file with an INVALID_JSON ConfigError', async () => {
      await seedFile(legacyFile, 'nope');
      let expected;

      try {
        JSON.parse('nope');
      } catch (error) {
        expected = error.message;
      }

      const error = await writePatterns().catch((e) => e);

      expect(error).toBeInstanceOf(ConfigError);
      expect(error.code).toEqual('INVALID_JSON');
      expect(error.message).toEqual(expected);
      expect(error.file).toEqual(legacyFile);
    });

    it('propagates a native fs error on the legacy file unwrapped', async () => {
      const fsError = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
      const failing = new RepoConfigWriter({
        lock,
        fs: {
          readFile: (file, encoding) => (file === legacyFile
            ? Promise.reject(fsError)
            : readFile(file, encoding))
        }
      });

      const error = await failing.write({
        newFile, legacyFile, namespace: 'n', key: 'k', value: 1
      }).catch((e) => e);

      expect(error).toBe(fsError);
      expect(error).not.toBeInstanceOf(ConfigError);
    });

    it('rejects when the file is valid JSON but not an object', async () => {
      await seedFile(newFile, '[1]');

      await expectAsync(writePatterns()).toBeRejectedWithError(/not a JSON object/);
    });

    it('rejects a non-object file with a NOT_AN_OBJECT ConfigError', async () => {
      await seedFile(newFile, '[1]');

      const error = await writePatterns().catch((e) => e);

      expect(error).toBeInstanceOf(ConfigError);
      expect(error.code).toEqual('NOT_AN_OBJECT');
      expect(error.message).toEqual(`Cannot index ${newFile}: not a JSON object`);
      expect(error.file).toEqual(newFile);
    });

    it('rejects when the namespace holds a non-object', async () => {
      await seedFile(newFile, '{"auto-fix-all":"x"}');

      await expectAsync(writePatterns()).toBeRejectedWithError(/not a JSON object/);
    });

    it('rejects a non-object namespace with a NOT_AN_OBJECT ConfigError', async () => {
      await seedFile(newFile, '{"auto-fix-all":"x"}');

      const error = await writePatterns().catch((e) => e);

      expect(error).toBeInstanceOf(ConfigError);
      expect(error.code).toEqual('NOT_AN_OBJECT');
      expect(error.message).toEqual('Cannot index .auto-fix-all: not a JSON object');
      expect(error.file).toEqual(newFile);
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

    describe('with a dotted key', () => {
      /**
       * @param {string} key - the dotted key under `next_step`.
       * @param {unknown} value - the value to write.
       * @returns {Promise<void>} resolves once written.
       */
      function writeNextStep(key, value) {
        return writer.write({ newFile, legacyFile, namespace: 'next_step', key, value });
      }

      it('creates the missing intermediate objects', async () => {
        await writeNextStep('auto.enhance-issue', true);

        expect(await readFile(newFile, 'utf8')).toEqual(
          '{\n  "next_step": {\n    "auto": {\n      "enhance-issue": true\n    }\n  }\n}\n'
        );
      });

      it('keeps sibling keys at every level', async () => {
        await seedFile(newFile, JSON.stringify({
          version: '1.0.0',
          next_step: { other: 1, auto: { 'discuss-issue': false } }
        }));

        await writeNextStep('auto.enhance-issue', true);

        expect(await readFile(newFile, 'utf8')).toEqual(`${JSON.stringify({
          version: '1.0.0',
          next_step: { other: 1, auto: { 'discuss-issue': false, 'enhance-issue': true } }
        }, null, 2)}\n`);
      });

      it('replaces an existing leaf in place', async () => {
        await seedFile(newFile, '{"next_step":{"auto":{"enhance-issue":true,"discuss-issue":true}}}');

        await writeNextStep('auto.enhance-issue', false);

        expect(JSON.parse(await readFile(newFile, 'utf8'))).toEqual({
          next_step: { auto: { 'enhance-issue': false, 'discuss-issue': true } }
        });
      });

      it('treats a null intermediate as {}', async () => {
        await seedFile(newFile, '{"next_step":{"auto":null}}');

        await writeNextStep('auto.enhance-issue', true);

        expect(JSON.parse(await readFile(newFile, 'utf8'))).toEqual({
          next_step: { auto: { 'enhance-issue': true } }
        });
      });

      it('creates several levels of nesting', async () => {
        await writeNextStep('a.b.c', 1);

        expect(JSON.parse(await readFile(newFile, 'utf8'))).toEqual({ next_step: { a: { b: { c: 1 } } } });
      });

      ['"x"', '[1]', '3', 'false'].forEach((raw) => {
        it(`rejects when an intermediate holds ${raw}, releasing the lock`, async () => {
          await seedFile(newFile, `{"next_step":{"auto":${raw}}}`);

          await expectAsync(writeNextStep('auto.enhance-issue', true))
            .toBeRejectedWithError('Cannot index .next_step.auto: not a JSON object');
          expect(existsSync(`${newFile}.lock`)).toBeFalse();
        });
      });

      it('rejects a non-object intermediate with a NOT_AN_OBJECT ConfigError', async () => {
        await seedFile(newFile, '{"next_step":{"auto":"x"}}');

        const error = await writeNextStep('auto.enhance-issue', true).catch((e) => e);

        expect(error).toBeInstanceOf(ConfigError);
        expect(error.code).toEqual('NOT_AN_OBJECT');
        expect(error.file).toEqual(newFile);
      });

      it('leaves a flat key as a plain key under the namespace', async () => {
        await seedFile(newFile, '{"next_step":{"auto":{"enhance-issue":true}}}');

        await writeNextStep('flat', 'v');

        expect(JSON.parse(await readFile(newFile, 'utf8'))).toEqual({
          next_step: { auto: { 'enhance-issue': true }, flat: 'v' }
        });
      });
    });

    describe('without a namespace (top-level write)', () => {
      /**
       * @param {string} key - the top-level key or dotted path.
       * @param {unknown} value - the value to write.
       * @returns {Promise<void>} resolves once written.
       */
      function writeTopLevel(key, value) {
        return writer.write({ newFile, legacyFile, key, value });
      }

      it('writes a flat key on a new file', async () => {
        await writeTopLevel('flat', 'v');

        expect(await readFile(newFile, 'utf8')).toEqual('{\n  "flat": "v"\n}\n');
      });

      it('creates the intermediates of a dotted path', async () => {
        await writeTopLevel('a.b.c', 1);

        expect(await readFile(newFile, 'utf8')).toEqual(
          '{\n  "a": {\n    "b": {\n      "c": 1\n    }\n  }\n}\n'
        );
      });

      it('keeps siblings and their order, appending new keys', async () => {
        await seedFile(newFile, '{"version":"1.0.0","a":{"x":1},"z":true}');

        await writeTopLevel('a.y', 2);
        await writeTopLevel('new', 'n');

        expect(await readFile(newFile, 'utf8')).toEqual(`${JSON.stringify({
          version: '1.0.0',
          a: { x: 1, y: 2 },
          z: true,
          new: 'n'
        }, null, 2)}\n`);
      });

      it('replaces an existing leaf in place', async () => {
        await seedFile(newFile, '{"a":1,"b":2,"c":3}');

        await writeTopLevel('b', 'two');

        expect(await readFile(newFile, 'utf8')).toEqual(
          '{\n  "a": 1,\n  "b": "two",\n  "c": 3\n}\n'
        );
      });

      it('treats a null intermediate as {}', async () => {
        await seedFile(newFile, '{"a":null}');

        await writeTopLevel('a.b', 1);

        expect(JSON.parse(await readFile(newFile, 'utf8'))).toEqual({ a: { b: 1 } });
      });

      it('ignores legacyFile', async () => {
        await seedFile(legacyFile, '{"legacy_key":1}');
        spyOn(writer._fs, 'readFile').and.callThrough();

        await writeTopLevel('flat', 'v');

        expect(writer._fs.readFile).not.toHaveBeenCalledWith(legacyFile, 'utf8');
        expect(JSON.parse(await readFile(newFile, 'utf8'))).toEqual({ flat: 'v' });
      });

      it('rejects a non-object intermediate with NOT_AN_OBJECT, releasing the lock', async () => {
        await seedFile(newFile, '{"a":{"b":"x"}}');

        const error = await writeTopLevel('a.b.c', 1).catch((e) => e);

        expect(error).toBeInstanceOf(ConfigError);
        expect(error.code).toEqual('NOT_AN_OBJECT');
        expect(error.message).toEqual('Cannot index .a.b: not a JSON object');
        expect(error.file).toEqual(newFile);
        expect(existsSync(`${newFile}.lock`)).toBeFalse();
      });

      it('acquires and releases <newFile>.lock', async () => {
        spyOn(lock, 'acquire').and.callThrough();
        spyOn(lock, 'release').and.callThrough();

        await writeTopLevel('flat', 'v');

        expect(lock.acquire).toHaveBeenCalledWith(`${newFile}.lock`);
        expect(lock.release).toHaveBeenCalledWith(`${newFile}.lock`);
      });
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

  describe('#unset', () => {
    /**
     * @param {object} [overrides] - `unset` argument overrides.
     * @returns {Promise<void>} resolves once done.
     */
    function unsetKey(overrides = {}) {
      return writer.unset({ newFile, legacyFile, namespace: 'next_step', key: 'auto.enhance-issue', ...overrides });
    }

    it('removes a flat key, keeping siblings and their order', async () => {
      await seedFile(newFile, '{"version":"1.0.0","next_step":{"a":1,"flat":"v","b":2},"z":true}');

      await unsetKey({ key: 'flat' });

      expect(await readFile(newFile, 'utf8')).toEqual(`${JSON.stringify({
        version: '1.0.0',
        next_step: { a: 1, b: 2 },
        z: true
      }, null, 2)}\n`);
    });

    it('removes a dotted leaf, keeping siblings', async () => {
      await seedFile(newFile, '{"next_step":{"auto":{"discuss-issue":false,"enhance-issue":true},"other":1}}');

      await unsetKey();

      expect(await readFile(newFile, 'utf8')).toEqual(`${JSON.stringify({
        next_step: { auto: { 'discuss-issue': false }, other: 1 }
      }, null, 2)}\n`);
    });

    it('keeps the now-empty parent objects', async () => {
      await seedFile(newFile, '{"next_step":{"auto":{"enhance-issue":true}}}');

      await unsetKey();

      expect(await readFile(newFile, 'utf8')).toEqual(
        '{\n  "next_step": {\n    "auto": {}\n  }\n}\n'
      );
    });

    it('removes a key holding null', async () => {
      await seedFile(newFile, '{"next_step":{"auto":{"enhance-issue":null,"x":1}}}');

      await unsetKey();

      expect(JSON.parse(await readFile(newFile, 'utf8'))).toEqual({ next_step: { auto: { x: 1 } } });
    });

    [
      ['a missing leaf', '{"next_step":{"auto":{"other":1}}}'],
      ['a missing intermediate', '{"next_step":{"other":1}}'],
      ['a null intermediate', '{"next_step":{"auto":null}}'],
      ['a missing namespace', '{"version":"1.0.0"}'],
      ['a null namespace', '{"next_step":null}']
    ].forEach(([label, contents]) => {
      it(`is a no-op on ${label}, leaving the bytes untouched`, async () => {
        await seedFile(newFile, contents);
        const writeSpy = spyOn(writer._fs, 'writeFile').and.callThrough();

        await unsetKey();

        expect(await readFile(newFile, 'utf8')).toEqual(contents);
        expect(writeSpy).not.toHaveBeenCalled();
        expect(existsSync(`${newFile}.lock`)).toBeFalse();
      });
    });

    it('does not create a missing file', async () => {
      await unsetKey();

      expect(existsSync(newFile)).toBeFalse();
      expect(existsSync(`${newFile}.tmp`)).toBeFalse();
      expect(existsSync(`${newFile}.lock`)).toBeFalse();
    });

    it('seeds the namespace from the legacy file, then deletes', async () => {
      await seedFile(newFile, '{"version":"1.0.0"}');
      await seedFile(legacyFile, '{"legacy_key":1,"ignored_check_patterns":["z"]}');

      await unsetKey({ namespace: 'auto-fix-all', key: 'ignored_check_patterns' });

      expect(await readFile(newFile, 'utf8')).toEqual(`${JSON.stringify({
        version: '1.0.0',
        'auto-fix-all': { legacy_key: 1 }
      }, null, 2)}\n`);
    });

    it('does not write the legacy seed alone when the key is missing', async () => {
      await seedFile(newFile, '{"version":"1.0.0"}');
      await seedFile(legacyFile, '{"legacy_key":1}');

      await unsetKey({ namespace: 'auto-fix-all', key: 'ignored_check_patterns' });

      expect(await readFile(newFile, 'utf8')).toEqual('{"version":"1.0.0"}');
    });

    it('does not reseed when the namespace already exists', async () => {
      await seedFile(newFile, '{"auto-fix-all":{"kept":true,"gone":1}}');
      await seedFile(legacyFile, '{"legacy_key":1}');

      await unsetKey({ namespace: 'auto-fix-all', key: 'gone' });

      expect(JSON.parse(await readFile(newFile, 'utf8'))).toEqual({ 'auto-fix-all': { kept: true } });
    });

    describe('without a namespace (top-level unset)', () => {
      it('removes a flat top-level key, ignoring legacyFile', async () => {
        await seedFile(newFile, '{"a":1,"b":2,"c":3}');
        await seedFile(legacyFile, '{"b":"legacy"}');

        await writer.unset({ newFile, legacyFile, key: 'b' });

        expect(await readFile(newFile, 'utf8')).toEqual('{\n  "a": 1,\n  "c": 3\n}\n');
      });

      it('removes a dotted top-level path, keeping empty parents', async () => {
        await seedFile(newFile, '{"a":{"b":{"c":1}},"z":0}');

        await writer.unset({ newFile, key: 'a.b.c' });

        expect(JSON.parse(await readFile(newFile, 'utf8'))).toEqual({ a: { b: {} }, z: 0 });
      });

      it('is a no-op on a missing top-level key', async () => {
        await seedFile(newFile, '{"a":1}');

        await writer.unset({ newFile, key: 'missing.deep' });

        expect(await readFile(newFile, 'utf8')).toEqual('{"a":1}');
      });

      it('rejects a non-object intermediate with NOT_AN_OBJECT', async () => {
        await seedFile(newFile, '{"a":{"b":3}}');

        const error = await writer.unset({ newFile, key: 'a.b.c' }).catch((e) => e);

        expect(error).toBeInstanceOf(ConfigError);
        expect(error.code).toEqual('NOT_AN_OBJECT');
        expect(error.message).toEqual('Cannot index .a.b: not a JSON object');
        expect(existsSync(`${newFile}.lock`)).toBeFalse();
      });
    });

    ['"x"', '[1]', '3', 'false'].forEach((raw) => {
      it(`rejects when an intermediate holds ${raw}, releasing the lock`, async () => {
        await seedFile(newFile, `{"next_step":{"auto":${raw}}}`);

        const error = await unsetKey().catch((e) => e);

        expect(error).toBeInstanceOf(ConfigError);
        expect(error.code).toEqual('NOT_AN_OBJECT');
        expect(error.message).toEqual('Cannot index .next_step.auto: not a JSON object');
        expect(error.file).toEqual(newFile);
        expect(existsSync(`${newFile}.lock`)).toBeFalse();
      });
    });

    it('rejects a non-object namespace with NOT_AN_OBJECT, releasing the lock', async () => {
      await seedFile(newFile, '{"next_step":"x"}');

      const error = await unsetKey().catch((e) => e);

      expect(error).toBeInstanceOf(ConfigError);
      expect(error.code).toEqual('NOT_AN_OBJECT');
      expect(error.message).toEqual('Cannot index .next_step: not a JSON object');
      expect(existsSync(`${newFile}.lock`)).toBeFalse();
    });

    it('rejects a non-object file with NOT_AN_OBJECT', async () => {
      await seedFile(newFile, '[1]');

      const error = await unsetKey().catch((e) => e);

      expect(error).toBeInstanceOf(ConfigError);
      expect(error.code).toEqual('NOT_AN_OBJECT');
      expect(existsSync(`${newFile}.lock`)).toBeFalse();
    });

    it('acquires and releases <newFile>.lock', async () => {
      await seedFile(newFile, '{"next_step":{"auto":{"enhance-issue":true}}}');
      spyOn(lock, 'acquire').and.callThrough();
      spyOn(lock, 'release').and.callThrough();

      await unsetKey();

      expect(lock.acquire).toHaveBeenCalledWith(`${newFile}.lock`);
      expect(lock.release).toHaveBeenCalledWith(`${newFile}.lock`);
      expect(existsSync(`${newFile}.lock`)).toBeFalse();
    });

    it('releases the lock on a no-op', async () => {
      spyOn(lock, 'release').and.callThrough();

      await unsetKey();

      expect(lock.release).toHaveBeenCalledWith(`${newFile}.lock`);
    });

    it('writes via <file>.tmp and renames it into place', async () => {
      await seedFile(newFile, '{"next_step":{"auto":{"enhance-issue":true}}}');
      const renameSpy = jasmine.createSpy('rename').and.callFake(rename);
      const spied = new RepoConfigWriter({ lock, fs: { rename: renameSpy } });

      await spied.unset({ newFile, legacyFile, namespace: 'next_step', key: 'auto.enhance-issue' });

      expect(renameSpy).toHaveBeenCalledWith(`${newFile}.tmp`, newFile);
      expect(existsSync(`${newFile}.tmp`)).toBeFalse();
    });
  });

  describe('timeoutMs', () => {
    const calls = {
      write: () => ({
        file: newFile,
        run: (opts) => writer.write({ newFile, legacyFile, namespace: 'n', key: 'k', value: 1, ...opts })
      }),
      setVersion: () => ({
        file: newFile,
        run: (opts) => writer.setVersion({ file: newFile, version: '1.2.3', ...opts })
      }),
      unset: () => ({
        file: newFile,
        run: (opts) => writer.unset({ newFile, legacyFile, namespace: 'n', key: 'k', ...opts })
      })
    };

    Object.entries(calls).forEach(([name, build]) => {
      describe(`on #${name}`, () => {
        it('forwards timeoutMs to acquire', async () => {
          spyOn(lock, 'acquire').and.callThrough();
          const { file, run } = build();

          await run({ timeoutMs: 250 });

          expect(lock.acquire).toHaveBeenCalledWith(`${file}.lock`, { timeoutMs: 250 });
        });

        it('passes no lock options when timeoutMs is omitted', async () => {
          spyOn(lock, 'acquire').and.callThrough();
          const { file, run } = build();

          await run({});

          expect(lock.acquire).toHaveBeenCalledOnceWith(`${file}.lock`);
        });

        it('propagates a LockTimeoutError with no write and no release', async () => {
          const timeout = new LockTimeoutError(`${newFile}.lock`);
          const fakeLock = {
            acquire: jasmine.createSpy('acquire').and.rejectWith(timeout),
            release: jasmine.createSpy('release')
          };
          const fsSpies = {
            writeFile: jasmine.createSpy('writeFile'),
            rename: jasmine.createSpy('rename')
          };

          writer = new RepoConfigWriter({ lock: fakeLock, fs: fsSpies });
          const { run } = build();
          const error = await run({ timeoutMs: 0 }).catch((e) => e);

          expect(error).toBe(timeout);
          expect(error.code).toEqual('LOCK_TIMEOUT');
          expect(fsSpies.writeFile).not.toHaveBeenCalled();
          expect(fsSpies.rename).not.toHaveBeenCalled();
          expect(fakeLock.release).not.toHaveBeenCalled();
        });
      });
    });

    it('times out on a pre-held real lock with timeoutMs: 0, leaving the file untouched', async () => {
      await seedFile(newFile, '{"a":1}');
      await lock.acquire(`${newFile}.lock`);

      try {
        const error = await writer.write({
          newFile, legacyFile, namespace: 'n', key: 'k', value: 1, timeoutMs: 0
        }).catch((e) => e);

        expect(error).toBeInstanceOf(LockTimeoutError);
        expect(error.code).toEqual('LOCK_TIMEOUT');
        expect(await readFile(newFile, 'utf8')).toEqual('{"a":1}');
        expect(existsSync(`${newFile}.tmp`)).toBeFalse();
      } finally {
        await lock.release(`${newFile}.lock`);
      }
    });
  });
});
