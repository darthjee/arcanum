import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import BooleanKeyConfig from '../../../../lib/utils/config/BooleanKeyConfig.js';
import DispatchFailure from '../../../../lib/utils/errors/DispatchFailure.js';
import Lock from '../../../../lib/utils/file/Lock.js';
import FlatBooleanKeyConfig from '../../../support/dummies/FlatBooleanKeyConfig.js';
import { captureRejection } from '../../../support/utils/captureRejection.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

describe('BooleanKeyConfig', () => {
  let dir;
  let file;
  let lock;
  let config;

  beforeEach(async () => {
    dir = await createTempDir();
    file = path.join(dir, 'config.json');
    lock = new Lock({ sleepMs: 5 });
    config = new FlatBooleanKeyConfig({ lock });
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  async function readConfig() {
    return JSON.parse(await readFile(file, 'utf8'));
  }

  describe('#get', () => {
    it('returns the stored value followed by a newline', async () => {
      await writeFile(file, JSON.stringify({ a: true }));

      await expectAsync(config.get(dir, 'a')).toBeResolvedTo('true\n');
    });

    it('defaults to "false" when the key is absent', async () => {
      await expectAsync(config.get(dir, 'a')).toBeResolvedTo('false\n');
    });

    it('rejects when the key is missing', async () => {
      await expectAsync(config.get(dir)).toBeRejectedWithError('Error: get requires a key');
    });
  });

  describe('#isEnabled', () => {
    it('resolves when the value is "true"', async () => {
      await writeFile(file, JSON.stringify({ a: true }));

      await expectAsync(config.isEnabled(dir, 'a')).toBeResolved();
    });

    it('rejects with a DispatchFailure (stdout "", exit 1) otherwise', async () => {
      const thrown = await captureRejection(config.isEnabled(dir, 'a'));

      expect(thrown).toBeInstanceOf(DispatchFailure);
      expect(thrown.stdout).toEqual('');
      expect(thrown.exitCode).toEqual(1);
    });

    it('rejects when the key is missing', async () => {
      await expectAsync(config.isEnabled(dir)).toBeRejectedWithError('Error: is-enabled requires a key');
    });
  });

  describe('#set', () => {
    it('writes a JSON boolean, pretty-printed with a trailing newline', async () => {
      await config.set(dir, 'a', 'true');

      expect(await readFile(file, 'utf8')).toEqual('{\n  "a": true\n}\n');
    });

    it('preserves other keys', async () => {
      await writeFile(file, JSON.stringify({ b: 'x' }));

      await config.set(dir, 'a', 'false');

      expect(await readConfig()).toEqual({ b: 'x', a: false });
    });

    it('rejects when the key or value is missing', async () => {
      await expectAsync(config.set(dir, 'a')).toBeRejectedWithError(
        'Error: set requires a key and a value (true|false)'
      );
      await expectAsync(config.set(dir)).toBeRejectedWithError(
        'Error: set requires a key and a value (true|false)'
      );
    });

    it('rejects a value other than "true"/"false"', async () => {
      await expectAsync(config.set(dir, 'a', 'yes')).toBeRejectedWithError(
        'Error: value must be \'true\' or \'false\''
      );
    });

    it('acquires and releases the subclass-supplied lock file', async () => {
      spyOn(lock, 'acquire').and.callThrough();
      spyOn(lock, 'release').and.callThrough();

      await config.set(dir, 'a', 'true');

      expect(lock.acquire).toHaveBeenCalledWith(path.join(dir, 'config.lock'));
      expect(lock.release).toHaveBeenCalledWith(path.join(dir, 'config.lock'));
    });

    it('releases the lock even when the write fails', async () => {
      spyOn(lock, 'release').and.callThrough();
      spyOn(config, '_buildUpdate').and.rejectWith(new Error('boom'));

      await expectAsync(config.set(dir, 'a', 'true')).toBeRejectedWithError('boom');
      expect(lock.release).toHaveBeenCalled();
    });
  });

  describe('#toggle', () => {
    it('flips "true" to "false"', async () => {
      await writeFile(file, JSON.stringify({ a: true }));

      await expectAsync(config.toggle(dir, 'a')).toBeResolvedTo('false\n');
      expect(await readConfig()).toEqual({ a: false });
    });

    it('flips an absent value to "true"', async () => {
      await expectAsync(config.toggle(dir, 'a')).toBeResolvedTo('true\n');
      expect(await readConfig()).toEqual({ a: true });
    });

    it('rejects when the key is missing', async () => {
      await expectAsync(config.toggle(dir)).toBeRejectedWithError('Error: toggle requires a key');
    });
  });

  describe('#_readJson', () => {
    it('reads absent, empty, malformed and non-object files as {}', async () => {
      await expectAsync(config._readJson(file)).toBeResolvedTo({});

      await writeFile(file, '');
      await expectAsync(config._readJson(file)).toBeResolvedTo({});

      await writeFile(file, 'not json');
      await expectAsync(config._readJson(file)).toBeResolvedTo({});

      await writeFile(file, '42');
      await expectAsync(config._readJson(file)).toBeResolvedTo({});
    });

    it('returns undefined for absent/malformed files with requireExists', async () => {
      await expectAsync(config._readJson(file, { requireExists: true })).toBeResolvedTo(undefined);

      await writeFile(file, 'not json');
      await expectAsync(config._readJson(file, { requireExists: true })).toBeResolvedTo(undefined);
    });

    it('parses a JSON object file', async () => {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, JSON.stringify({ a: 1 }));

      await expectAsync(config._readJson(file)).toBeResolvedTo({ a: 1 });
    });
  });

  describe('unimplemented hooks', () => {
    it('throws from the base class hooks', async () => {
      const base = new BooleanKeyConfig({ lock });

      expect(() => base._lockFile(dir, 'a')).toThrowError(/must be implemented/);
      await expectAsync(base._readValue(dir, 'a')).toBeRejectedWithError(/must be implemented/);
      await expectAsync(base._buildUpdate(dir, 'a', true)).toBeRejectedWithError(/must be implemented/);
    });
  });
});
