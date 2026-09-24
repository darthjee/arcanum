import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import MonitorIssuesConfig from '../../../../lib/commands/monitor-issues/MonitorIssuesConfig.js';
import DispatchFailure from '../../../../lib/utils/errors/DispatchFailure.js';
import Lock from '../../../../lib/utils/file/Lock.js';
import { captureRejection } from '../../../support/utils/captureRejection.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

describe('MonitorIssuesConfig', () => {
  let dir;
  let configFile;
  let stateFile;
  let lockFile;
  let lock;
  let config;

  beforeEach(async () => {
    dir = await createTempDir();
    configFile = path.join(dir, '.claude', 'configuration', 'monitor-issues.json');
    stateFile = path.join(dir, '.claude', 'state', 'monitor-issues-config.json');
    lockFile = path.join(dir, '.claude', 'state', 'monitor-issues-config.lock');
    lock = new Lock({ sleepMs: 5 });
    config = new MonitorIssuesConfig({ lock });
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  async function writeJson(file, content) {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(content));
  }

  async function readJson(file) {
    return JSON.parse(await readFile(file, 'utf8'));
  }

  describe('#get', () => {
    it('reads non-state keys from .claude/configuration/monitor-issues.json', async () => {
      await writeJson(configFile, { auto_rewrite: true });

      await expectAsync(config.get(dir, 'auto_rewrite')).toBeResolvedTo('true\n');
    });

    it('reads clear_context from .claude/state/monitor-issues-config.json', async () => {
      await writeJson(configFile, { clear_context: true });
      await writeJson(stateFile, { clear_context: false });

      await expectAsync(config.get(dir, 'clear_context')).toBeResolvedTo('false\n');
    });

    it('defaults to "false" when the file is absent or empty', async () => {
      await expectAsync(config.get(dir, 'auto_rewrite')).toBeResolvedTo('false\n');

      await mkdir(path.dirname(configFile), { recursive: true });
      await writeFile(configFile, '');

      await expectAsync(config.get(dir, 'auto_rewrite')).toBeResolvedTo('false\n');
    });

    it('treats a null value as "false" (jq // false)', async () => {
      await writeJson(configFile, { auto_rewrite: null });

      await expectAsync(config.get(dir, 'auto_rewrite')).toBeResolvedTo('false\n');
    });

    it('prints string values raw and other values as JSON (jq -r)', async () => {
      await writeJson(configFile, { name: 'abc', count: 3, list: [1] });

      await expectAsync(config.get(dir, 'name')).toBeResolvedTo('abc\n');
      await expectAsync(config.get(dir, 'count')).toBeResolvedTo('3\n');
      await expectAsync(config.get(dir, 'list')).toBeResolvedTo('[\n  1\n]\n');
    });

    it('rejects with the usage error when the key is missing', async () => {
      await expectAsync(config.get(dir)).toBeRejectedWithError('Error: get requires a key');
    });
  });

  describe('#isEnabled', () => {
    it('resolves when the value is true', async () => {
      await writeJson(configFile, { auto_rewrite: true });

      await expectAsync(config.isEnabled(dir, 'auto_rewrite')).toBeResolved();
    });

    it('rejects with DispatchFailure("", 1) otherwise', async () => {
      const thrown = await captureRejection(config.isEnabled(dir, 'auto_rewrite'));

      expect(thrown).toBeInstanceOf(DispatchFailure);
      expect(thrown.stdout).toEqual('');
      expect(thrown.exitCode).toEqual(1);
    });

    it('rejects with the usage error when the key is missing', async () => {
      await expectAsync(config.isEnabled(dir)).toBeRejectedWithError('Error: is-enabled requires a key');
    });
  });

  describe('#set', () => {
    it('writes a JSON boolean at the top level, preserving other keys', async () => {
      await writeJson(configFile, { other: 'x' });

      await config.set(dir, 'auto_rewrite', 'true');

      expect(await readJson(configFile)).toEqual({ other: 'x', auto_rewrite: true });
    });

    it('writes clear_context to the state file', async () => {
      await config.set(dir, 'clear_context', 'false');

      expect(await readJson(stateFile)).toEqual({ clear_context: false });
    });

    it('guards the write with the monitor-issues config lock', async () => {
      spyOn(lock, 'acquire').and.callThrough();
      spyOn(lock, 'release').and.callThrough();

      await config.set(dir, 'auto_rewrite', 'true');

      expect(lock.acquire).toHaveBeenCalledWith(lockFile);
      expect(lock.release).toHaveBeenCalledWith(lockFile);
    });

    it('rejects invalid input with the shell messages', async () => {
      await expectAsync(config.set(dir, 'auto_rewrite')).toBeRejectedWithError(
        'Error: set requires a key and a value (true|false)'
      );
      await expectAsync(config.set(dir, 'auto_rewrite', 'maybe')).toBeRejectedWithError(
        'Error: value must be \'true\' or \'false\''
      );
    });
  });

  describe('#toggle', () => {
    it('flips the value and prints the new one', async () => {
      await writeJson(configFile, { auto_rewrite: true });

      await expectAsync(config.toggle(dir, 'auto_rewrite')).toBeResolvedTo('false\n');
      expect(await readJson(configFile)).toEqual({ auto_rewrite: false });
    });

    it('flips an absent value to true', async () => {
      await expectAsync(config.toggle(dir, 'clear_context')).toBeResolvedTo('true\n');
      expect(await readJson(stateFile)).toEqual({ clear_context: true });
    });

    it('rejects with the usage error when the key is missing', async () => {
      await expectAsync(config.toggle(dir)).toBeRejectedWithError('Error: toggle requires a key');
    });
  });
});
