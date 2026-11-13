import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import MonitorIssuesConfig from '../../../../lib/commands/monitor-issues/MonitorIssuesConfig.js';
import DispatchFailure from '../../../../lib/utils/errors/DispatchFailure.js';
import ConfigChain from '../../../../../shared/lib/config/ConfigChain.js';
import Lock from '../../../../../shared/lib/file/Lock.js';
import { captureRejection } from '../../../support/utils/captureRejection.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

describe('MonitorIssuesConfig', () => {
  let dir;
  let newFile;
  let stateFile;
  let legacyFile;
  let lock;
  let config;

  beforeEach(async () => {
    dir = await createTempDir();
    newFile = path.join(dir, '.claude', 'configuration', 'arcanum-repo-config.json');
    stateFile = path.join(dir, '.claude', 'state', 'arcanum-config.json');
    legacyFile = path.join(dir, '.claude', 'configuration', 'monitor-issues.json');
    lock = new Lock({ sleepMs: 5 });
    // Isolated from the real global config file, which now takes effect
    // for clear_context.
    config = new MonitorIssuesConfig({
      lock,
      configChain: new ConfigChain({ env: { ...process.env, HOME: path.join(dir, 'home'), CLAUDE_CONFIG_DIR: '' } })
    });
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
    it('reads non-state keys from .monitor-issues.<key> of the repo config', async () => {
      await writeJson(newFile, { 'monitor-issues': { auto_rewrite: true } });

      await expectAsync(config.get(dir, 'auto_rewrite')).toBeResolvedTo('true\n');
    });

    it('ignores a legacy monitor-issues.json that is present for non-state keys', async () => {
      await writeJson(legacyFile, { auto_rewrite: true });

      await expectAsync(config.get(dir, 'auto_rewrite')).toBeResolvedTo('false\n');
    });

    it('reads the namespaced value, ignoring a legacy file that is present', async () => {
      await writeJson(newFile, { 'monitor-issues': { auto_rewrite: false } });
      await writeJson(legacyFile, { auto_rewrite: true });

      await expectAsync(config.get(dir, 'auto_rewrite')).toBeResolvedTo('false\n');
    });

    it('reads clear_context from .monitor-issues.clear_context of the local state file', async () => {
      await writeJson(newFile, { 'monitor-issues': { clear_context: false } });
      await writeJson(stateFile, { 'monitor-issues': { clear_context: true } });

      await expectAsync(config.get(dir, 'clear_context')).toBeResolvedTo('true\n');
    });

    it('ignores a legacy file that is present for clear_context', async () => {
      await writeJson(legacyFile, { clear_context: true });
      await writeJson(path.join(dir, '.claude', 'state', 'monitor-issues-config.json'), { clear_context: true });

      await expectAsync(config.get(dir, 'clear_context')).toBeResolvedTo('false\n');
    });

    describe('for clear_context (local/global, read through ConfigChain)', () => {
      let globalFile;

      beforeEach(() => {
        const home = path.join(dir, 'home');

        globalFile = path.join(home, '.claude', 'arcanum-config.json');
        config = new MonitorIssuesConfig({
          lock,
          configChain: new ConfigChain({ env: { ...process.env, HOME: home, CLAUDE_CONFIG_DIR: '' } })
        });
      });

      it('ignores clear_context set only in the repo config', async () => {
        await writeJson(newFile, { 'monitor-issues': { clear_context: true } });

        await expectAsync(config.get(dir, 'clear_context')).toBeResolvedTo('false\n');
      });

      it('reads clear_context set only in the global config', async () => {
        await writeJson(globalFile, { 'monitor-issues': { clear_context: true } });

        await expectAsync(config.get(dir, 'clear_context')).toBeResolvedTo('true\n');
      });

      it('lets an explicit local null fall through to the default', async () => {
        await writeJson(stateFile, { 'monitor-issues': { clear_context: null } });

        await expectAsync(config.get(dir, 'clear_context')).toBeResolvedTo('false\n');
      });

      it('stops at an explicit local false', async () => {
        await writeJson(stateFile, { 'monitor-issues': { clear_context: false } });
        await writeJson(globalFile, { 'monitor-issues': { clear_context: true } });

        await expectAsync(config.get(dir, 'clear_context')).toBeResolvedTo('false\n');
      });
    });

    it('defaults to "false" when absent everywhere', async () => {
      await expectAsync(config.get(dir, 'auto_rewrite')).toBeResolvedTo('false\n');
    });

    it('prints values compact-JSON-encoded (jq -c)', async () => {
      await writeJson(newFile, { 'monitor-issues': { name: 'abc', list: [1] } });

      await expectAsync(config.get(dir, 'name')).toBeResolvedTo('"abc"\n');
      await expectAsync(config.get(dir, 'list')).toBeResolvedTo('[1]\n');
    });

    it('rejects with the usage error when the key is missing', async () => {
      await expectAsync(config.get(dir)).toBeRejectedWithError('Error: get requires a key');
    });
  });

  describe('#isEnabled', () => {
    it('resolves when the value is true', async () => {
      await writeJson(stateFile, { 'monitor-issues': { clear_context: true } });

      await expectAsync(config.isEnabled(dir, 'clear_context')).toBeResolved();
    });

    it('rejects with DispatchFailure("", 1) otherwise', async () => {
      const thrown = await captureRejection(config.isEnabled(dir, 'clear_context'));

      expect(thrown).toBeInstanceOf(DispatchFailure);
      expect(thrown.stdout).toEqual('');
      expect(thrown.exitCode).toEqual(1);
    });

    it('ignores a legacy monitor-issues.json that is present, rejecting with DispatchFailure("", 1)', async () => {
      await writeJson(legacyFile, { auto_rewrite: true });

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
    it('writes clear_context under .monitor-issues of the state file, preserving other keys', async () => {
      await writeJson(stateFile, { next_step: { auto: { x: true } } });

      await config.set(dir, 'clear_context', 'true');

      expect(await readJson(stateFile)).toEqual({
        next_step: { auto: { x: true } },
        'monitor-issues': { clear_context: true }
      });
    });

    it('ignores a legacy monitor-issues.json that is present for non-state keys', async () => {
      await writeJson(legacyFile, { sibling: true });

      await config.set(dir, 'auto_rewrite', 'false');

      expect(await readJson(newFile)).toEqual({ 'monitor-issues': { auto_rewrite: false } });
    });

    it('ignores a legacy file that is present for clear_context', async () => {
      await writeJson(legacyFile, { sibling: true });

      await config.set(dir, 'clear_context', 'false');

      expect(await readJson(stateFile)).toEqual({ 'monitor-issues': { clear_context: false } });
    });

    it('guards the write with <new file>.lock', async () => {
      spyOn(lock, 'acquire').and.callThrough();
      spyOn(lock, 'release').and.callThrough();

      await config.set(dir, 'clear_context', 'true');

      expect(lock.acquire).toHaveBeenCalledWith(`${stateFile}.lock`);
      expect(lock.release).toHaveBeenCalledWith(`${stateFile}.lock`);
    });

    it('rejects invalid input with the shell messages', async () => {
      await expectAsync(config.set(dir, 'clear_context')).toBeRejectedWithError(
        'Error: set requires a key and a value (true|false)'
      );
      await expectAsync(config.set(dir, 'clear_context', 'maybe')).toBeRejectedWithError(
        'Error: value must be \'true\' or \'false\''
      );
    });
  });

  describe('#toggle', () => {
    it('flips the value and prints the new one', async () => {
      await writeJson(stateFile, { 'monitor-issues': { clear_context: true } });

      await expectAsync(config.toggle(dir, 'clear_context')).toBeResolvedTo('false\n');
      expect(await readJson(stateFile)).toEqual({ 'monitor-issues': { clear_context: false } });
    });

    it('flips an absent value to true', async () => {
      await expectAsync(config.toggle(dir, 'clear_context')).toBeResolvedTo('true\n');
      expect(await readJson(stateFile)).toEqual({ 'monitor-issues': { clear_context: true } });
    });

    it('ignores a legacy-only non-state value, flipping the missing value to true in the repo config', async () => {
      await writeJson(legacyFile, { auto_rewrite: true });

      await expectAsync(config.toggle(dir, 'auto_rewrite')).toBeResolvedTo('true\n');
      expect(await readJson(newFile)).toEqual({ 'monitor-issues': { auto_rewrite: true } });
    });

    it('rejects with the usage error when the key is missing', async () => {
      await expectAsync(config.toggle(dir)).toBeRejectedWithError('Error: toggle requires a key');
    });
  });
});
