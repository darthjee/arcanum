import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import BooleanKeyConfig from '../../../../lib/utils/config/BooleanKeyConfig.js';
import NamespacedBooleanKeyConfig from '../../../../lib/utils/config/NamespacedBooleanKeyConfig.js';
import ConfigChain from '../../../../../shared/lib/config/ConfigChain.js';
import KeyRegistry from '../../../../../shared/lib/config/KeyRegistry.js';
import Lock from '../../../../../shared/lib/file/Lock.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

describe('NamespacedBooleanKeyConfig', () => {
  let dir;
  let repoFile;
  let stateFile;
  let legacyFile;
  let lock;
  let config;

  beforeEach(async () => {
    dir = await createTempDir();
    repoFile = path.join(dir, '.claude', 'configuration', 'arcanum-repo-config.json');
    stateFile = path.join(dir, '.claude', 'state', 'arcanum-config.json');
    legacyFile = path.join(dir, '.claude', 'configuration', 'legacy.json');
    lock = new Lock({ sleepMs: 5 });
    config = new NamespacedBooleanKeyConfig({
      namespace: 'ns', stateKeys: ['personal'], legacyFileName: 'legacy.json', lock
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

  it('is a BooleanKeyConfig', () => {
    expect(config).toBeInstanceOf(BooleanKeyConfig);
  });

  describe('file routing', () => {
    it('routes state keys to the local state file, with no legacy file', () => {
      expect(config._newFileForKey(dir, 'personal')).toEqual(stateFile);
      expect(config._legacyFileForKey(dir, 'personal')).toBeNull();
      expect(config._lockFile(dir, 'personal')).toEqual(`${stateFile}.lock`);
    });

    it('routes other keys to the repo config, with the named legacy file', () => {
      expect(config._newFileForKey(dir, 'shared')).toEqual(repoFile);
      expect(config._legacyFileForKey(dir, 'shared')).toEqual(legacyFile);
      expect(config._lockFile(dir, 'shared')).toEqual(`${repoFile}.lock`);
    });
  });

  describe('#get', () => {
    it('reads .<namespace>.<key>, ignoring other namespaces', async () => {
      await writeJson(repoFile, { other: { shared: true }, ns: { shared: false } });

      await expectAsync(config.get(dir, 'shared')).toBeResolvedTo('false\n');
    });

    it('falls back to the legacy file when the namespace lacks the key', async () => {
      await writeJson(repoFile, { ns: { unrelated: false } });
      await writeJson(legacyFile, { shared: true });

      await expectAsync(config.get(dir, 'shared')).toBeResolvedTo('true\n');
    });

    it('never falls back for state keys', async () => {
      await writeJson(legacyFile, { personal: true });

      await expectAsync(config.get(dir, 'personal')).toBeResolvedTo('false\n');
    });

    it('treats a malformed legacy file as empty', async () => {
      await mkdir(path.dirname(legacyFile), { recursive: true });
      await writeFile(legacyFile, 'not json');

      await expectAsync(config.get(dir, 'shared')).toBeResolvedTo('false\n');
    });
  });

  describe('#get for keys registered in keys.json', () => {
    let globalFile;
    let registered;

    beforeEach(() => {
      const home = path.join(dir, 'home');
      const registry = new KeyRegistry({
        format_version: 1,
        keys: [
          { key: 'ns.personal', type: 'boolean', tiers: ['local'] },
          { key: 'ns.shared', type: 'boolean', tiers: ['repo'] },
          { key: 'ns.chained', type: 'boolean', tiers: ['local', 'repo', 'global'] }
        ]
      });

      globalFile = path.join(home, '.claude', 'arcanum-config.json');
      registered = new NamespacedBooleanKeyConfig({
        namespace: 'ns',
        stateKeys: ['personal'],
        legacyFileName: 'legacy.json',
        lock,
        registry,
        configChain: new ConfigChain({ env: { HOME: home }, registry })
      });
    });

    it('ignores a local-only key set only in the repo or global config', async () => {
      await writeJson(repoFile, { ns: { personal: true } });
      await writeJson(globalFile, { ns: { personal: true } });

      await expectAsync(registered.get(dir, 'personal')).toBeResolvedTo('false\n');
    });

    it('reads a local-only key set locally', async () => {
      await writeJson(stateFile, { ns: { personal: true } });

      await expectAsync(registered.get(dir, 'personal')).toBeResolvedTo('true\n');
    });

    it('lets an explicit null fall through to the default', async () => {
      await writeJson(stateFile, { ns: { personal: null } });

      await expectAsync(registered.get(dir, 'personal')).toBeResolvedTo('false\n');
    });

    it('lets an explicit null fall through to the legacy file', async () => {
      await writeJson(repoFile, { ns: { shared: null } });
      await writeJson(legacyFile, { shared: true });

      await expectAsync(registered.get(dir, 'shared')).toBeResolvedTo('true\n');
    });

    it('stops the chain at an explicit false', async () => {
      await writeJson(stateFile, { ns: { chained: false } });
      await writeJson(repoFile, { ns: { chained: true } });
      await writeJson(globalFile, { ns: { chained: true } });

      await expectAsync(registered.get(dir, 'chained')).toBeResolvedTo('false\n');
    });

    it('reads a multi-tier key from a lower tier when the higher ones lack it', async () => {
      await writeJson(globalFile, { ns: { chained: true } });

      await expectAsync(registered.get(dir, 'chained')).toBeResolvedTo('true\n');
    });

    it('still falls back to the legacy file for a repo-tier key', async () => {
      await writeJson(legacyFile, { shared: true });

      await expectAsync(registered.get(dir, 'shared')).toBeResolvedTo('true\n');
    });

    it('ignores a repo-tier key set only locally, falling back to the legacy file', async () => {
      await writeJson(stateFile, { ns: { shared: true } });
      await writeJson(legacyFile, { shared: false });

      await expectAsync(registered.get(dir, 'shared')).toBeResolvedTo('false\n');
    });
  });

  describe('#get for keys missing from keys.json', () => {
    it('reads the new file only, keeping an explicit null', async () => {
      await writeJson(stateFile, { ns: { shared: true } });
      await writeJson(repoFile, { ns: { shared: null } });
      await writeJson(legacyFile, { shared: true });

      await expectAsync(config.get(dir, 'shared')).toBeResolvedTo('null\n');
    });
  });

  describe('#set', () => {
    it('preserves other top-level keys and namespace siblings', async () => {
      await writeJson(stateFile, { other: 1, ns: { sibling: true } });

      await config.set(dir, 'personal', 'true');

      expect(await readJson(stateFile)).toEqual({ other: 1, ns: { sibling: true, personal: true } });
    });

    it('does not seed from the legacy file once the namespace exists', async () => {
      await writeJson(repoFile, { ns: {} });
      await writeJson(legacyFile, { sibling: true });

      await config.set(dir, 'shared', 'true');

      expect(await readJson(repoFile)).toEqual({ ns: { shared: true } });
    });

    it('writes just the key when neither the namespace nor the legacy file exist', async () => {
      await config.set(dir, 'shared', 'false');

      expect(await readJson(repoFile)).toEqual({ ns: { shared: false } });
    });
  });
});
