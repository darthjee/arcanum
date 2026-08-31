import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import AutoFixAllConfig from '../../../../lib/commands/auto-fix-all/AutoFixAllConfig.js';
import DispatchFailure from '../../../../lib/utils/errors/DispatchFailure.js';
import Lock from '../../../../lib/utils/file/Lock.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

describe('AutoFixAllConfig', () => {
  let dir;
  let newFile;
  let stateFile;
  let legacyFile;

  beforeEach(async () => {
    dir = await createTempDir();
    newFile = path.join(dir, '.claude', 'configuration', 'arcanum-repo-config.json');
    stateFile = path.join(dir, '.claude', 'state', 'arcanum-config.json');
    legacyFile = path.join(dir, '.claude', 'configuration', 'auto-fix-all.json');
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  async function writeJson(file, content) {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(content));
  }

  function newConfig({ lock } = {}) {
    return new AutoFixAllConfig({ lock: lock || new Lock({ sleepMs: 5 }) });
  }

  describe('#get', () => {
    it('returns the value present in the new file', async () => {
      await writeJson(newFile, { 'auto-fix-all': { auto_merge: true } });

      const config = newConfig();

      await expectAsync(config.get(dir, 'auto_merge')).toBeResolvedTo('true\n');
    });

    it('falls back to the legacy file when the new file is missing the key', async () => {
      await writeJson(legacyFile, { auto_merge: true });

      const config = newConfig();

      await expectAsync(config.get(dir, 'auto_merge')).toBeResolvedTo('true\n');
    });

    it('falls back to the legacy file when the new file is missing entirely', async () => {
      await writeJson(legacyFile, { auto_merge: false });

      const config = newConfig();

      await expectAsync(config.get(dir, 'auto_merge')).toBeResolvedTo('false\n');
    });

    it('defaults to "false" when absent from both files', async () => {
      const config = newConfig();

      await expectAsync(config.get(dir, 'auto_merge')).toBeResolvedTo('false\n');
    });

    it('never falls back to the legacy file for clear_context/finish_on_empty_queue, even when present there', async () => {
      await writeJson(legacyFile, { clear_context: true });

      const config = newConfig();

      await expectAsync(config.get(dir, 'clear_context')).toBeResolvedTo('false\n');
    });
  });

  describe('#isEnabled', () => {
    it('resolves with no thrown error when the resolved value is "true"', async () => {
      await writeJson(newFile, { 'auto-fix-all': { auto_merge: true } });

      const config = newConfig();

      await expectAsync(config.isEnabled(dir, 'auto_merge')).toBeResolved();
    });

    it('rejects with a DispatchFailure (stdout "", exit code 1) when the resolved value is "false"', async () => {
      await writeJson(newFile, { 'auto-fix-all': { auto_merge: false } });

      const config = newConfig();
      let thrown;

      try {
        await config.isEnabled(dir, 'auto_merge');
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(DispatchFailure);
      expect(thrown.stdout).toEqual('');
      expect(thrown.exitCode).toEqual(1);
    });

    it('rejects with a DispatchFailure when the value is absent everywhere', async () => {
      const config = newConfig();
      let thrown;

      try {
        await config.isEnabled(dir, 'auto_merge');
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(DispatchFailure);
      expect(thrown.stdout).toEqual('');
      expect(thrown.exitCode).toEqual(1);
    });
  });

  describe('#set', () => {
    it('writes a valid "true" value under .auto-fix-all.<key> in the new file', async () => {
      const config = newConfig();

      await config.set(dir, 'auto_merge', 'true');

      const written = JSON.parse(await readFile(newFile, 'utf8'));

      expect(written).toEqual({ 'auto-fix-all': { auto_merge: true } });
    });

    it('writes a valid "false" value, preserving other existing namespaces/keys', async () => {
      await writeJson(newFile, { other: { foo: 'bar' }, 'auto-fix-all': { existing_key: true } });

      const config = newConfig();

      await config.set(dir, 'auto_merge', 'false');

      const written = JSON.parse(await readFile(newFile, 'utf8'));

      expect(written).toEqual({
        other: { foo: 'bar' },
        'auto-fix-all': { existing_key: true, auto_merge: false }
      });
    });

    it('seeds .auto-fix-all from the legacy file when the new file does not have that namespace yet', async () => {
      await writeJson(legacyFile, { sibling_key: true, auto_merge: false });

      const config = newConfig();

      await config.set(dir, 'auto_merge', 'true');

      const written = JSON.parse(await readFile(newFile, 'utf8'));

      expect(written).toEqual({ 'auto-fix-all': { sibling_key: true, auto_merge: true } });
    });

    it('rejects with a plain Error when the key is missing', async () => {
      const config = newConfig();

      await expectAsync(config.set(dir, undefined, 'true')).toBeRejectedWithError(
        'Error: set requires a key and a value (true|false)'
      );
    });

    it('rejects with a plain Error when the value is missing', async () => {
      const config = newConfig();

      await expectAsync(config.set(dir, 'auto_merge', undefined)).toBeRejectedWithError(
        'Error: set requires a key and a value (true|false)'
      );
    });

    it('rejects with a plain Error when the value is not exactly "true"/"false"', async () => {
      const config = newConfig();

      await expectAsync(config.set(dir, 'auto_merge', 'yes')).toBeRejectedWithError(
        'Error: value must be \'true\' or \'false\''
      );
    });

    it('resolves against the state file for clear_context/finish_on_empty_queue', async () => {
      const config = newConfig();

      await config.set(dir, 'clear_context', 'true');

      const written = JSON.parse(await readFile(stateFile, 'utf8'));

      expect(written).toEqual({ 'auto-fix-all': { clear_context: true } });
    });

    it('acquires and releases the lock file around the write', async () => {
      const lock = new Lock({ sleepMs: 5 });

      spyOn(lock, 'acquire').and.callThrough();
      spyOn(lock, 'release').and.callThrough();

      const config = newConfig({ lock });

      await config.set(dir, 'auto_merge', 'true');

      expect(lock.acquire).toHaveBeenCalledWith(`${newFile}.lock`);
      expect(lock.release).toHaveBeenCalledWith(`${newFile}.lock`);
    });
  });

  describe('#toggle', () => {
    it('flips "true" to "false" and updates the new file', async () => {
      await writeJson(newFile, { 'auto-fix-all': { auto_merge: true } });

      const config = newConfig();

      await expectAsync(config.toggle(dir, 'auto_merge')).toBeResolvedTo('false\n');

      const written = JSON.parse(await readFile(newFile, 'utf8'));

      expect(written).toEqual({ 'auto-fix-all': { auto_merge: false } });
    });

    it('flips an absent value (defaulting to "false") to "true"', async () => {
      const config = newConfig();

      await expectAsync(config.toggle(dir, 'auto_merge')).toBeResolvedTo('true\n');

      const written = JSON.parse(await readFile(newFile, 'utf8'));

      expect(written).toEqual({ 'auto-fix-all': { auto_merge: true } });
    });

    it('acquires and releases the lock file around the write', async () => {
      const lock = new Lock({ sleepMs: 5 });

      spyOn(lock, 'acquire').and.callThrough();
      spyOn(lock, 'release').and.callThrough();

      const config = newConfig({ lock });

      await config.toggle(dir, 'auto_merge');

      expect(lock.acquire).toHaveBeenCalledWith(`${newFile}.lock`);
      expect(lock.release).toHaveBeenCalledWith(`${newFile}.lock`);
    });

    it('resolves against the state file for clear_context/finish_on_empty_queue', async () => {
      const config = newConfig();

      await expectAsync(config.toggle(dir, 'finish_on_empty_queue')).toBeResolvedTo('true\n');

      const written = JSON.parse(await readFile(stateFile, 'utf8'));

      expect(written).toEqual({ 'auto-fix-all': { finish_on_empty_queue: true } });
    });
  });
});
