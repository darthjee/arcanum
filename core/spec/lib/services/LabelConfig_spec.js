import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import LabelConfig, { DEFAULT_LABEL_CONFIG_PATH, DEFAULT_LABEL_PAIRS } from '../../../lib/services/LabelConfig.js';
import { createTempDir, removeTempDir } from '../../support/utils/tempDir.js';

describe('LabelConfig', () => {
  let dir;
  let configPath;
  let labelConfig;

  beforeEach(async () => {
    dir = await createTempDir();
    configPath = path.join(dir, 'nested', 'config.json');
    labelConfig = new LabelConfig();
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  /**
   * @param {string} content - raw file content.
   * @returns {Promise<void>} resolves once written.
   */
  async function seed(content) {
    await mkdir(path.dirname(configPath), { recursive: true });
    await writeFile(configPath, content);
  }

  /**
   * @returns {Promise<string>} the config file's raw content.
   */
  function raw() {
    return readFile(configPath, 'utf8');
  }

  describe('constants', () => {
    it('exposes the default config path', () => {
      expect(DEFAULT_LABEL_CONFIG_PATH).toEqual('.claude/state/init-claude-config.json');
    });

    it('exposes the 22 frozen default pairs, in the shell order', () => {
      expect(DEFAULT_LABEL_PAIRS.length).toEqual(22);
      expect(DEFAULT_LABEL_PAIRS[0]).toEqual('Bug:b60205');
      expect(DEFAULT_LABEL_PAIRS[6]).toEqual('Ready for Work:ffaa04');
      expect(DEFAULT_LABEL_PAIRS[21]).toEqual('Spawned:6a737d');
      expect(Object.isFrozen(DEFAULT_LABEL_PAIRS)).toBeTrue();
    });
  });

  describe('#validatePair', () => {
    it('accepts a valid pair', () => {
      expect(labelConfig.validatePair('Bug:b60205')).toBeNull();
      expect(labelConfig.validatePair('Ready for Work:FFAA04')).toBeNull();
    });

    it('rejects a pair with no colon', () => {
      expect(labelConfig.validatePair('Bug')).toEqual(
        'Error: invalid pair \'Bug\' — expected <label name>:<hex color>'
      );
    });

    it('rejects an empty name', () => {
      expect(labelConfig.validatePair(':b60205')).toEqual('Error: invalid pair \':b60205\' — label name is empty');
    });

    it('rejects a non-6-hex color, splitting on the first colon', () => {
      expect(labelConfig.validatePair('a:b:c')).toEqual(
        'Error: invalid color \'b:c\' for label \'a\' — expected exactly 6 hex digits'
      );
      expect(labelConfig.validatePair('Bug:#b60205')).toEqual(
        'Error: invalid color \'#b60205\' for label \'Bug\' — expected exactly 6 hex digits'
      );
    });
  });

  describe('#readPairs', () => {
    it('returns [] for a missing file', async () => {
      expect(await labelConfig.readPairs(configPath)).toEqual([]);
    });

    it('returns [] for an empty file', async () => {
      await seed('');

      expect(await labelConfig.readPairs(configPath)).toEqual([]);
    });

    it('returns [] for malformed JSON', async () => {
      await seed('{not json');

      expect(await labelConfig.readPairs(configPath)).toEqual([]);
    });

    it('returns [] for a missing, null or empty labels array', async () => {
      for (const content of ['{}', '{"labels":null}', '{"labels":[]}', '[]']) {
        await seed(content);

        expect(await labelConfig.readPairs(configPath)).toEqual([]);
      }
    });

    it('returns the labels in order', async () => {
      await seed('{"labels":[{"name":"A","color":"000000"},{"name":"B","color":"ffffff"}]}');

      expect(await labelConfig.readPairs(configPath)).toEqual([
        { name: 'A', color: '000000' },
        { name: 'B', color: 'ffffff' }
      ]);
    });

    it('re-splits name + ":" + color on the first colon, like the shell round-trip', async () => {
      await seed('{"labels":[{"name":"a:b","color":"000000"},{"color":"111111"}]}');

      expect(await labelConfig.readPairs(configPath)).toEqual([
        { name: 'a', color: 'b:000000' },
        { name: '', color: '111111' }
      ]);
    });
  });

  describe('#write', () => {
    it('creates parent dirs and writes jq-style pretty JSON, leaving no tmp file', async () => {
      await labelConfig.write(configPath, [{ name: 'A', color: '000000' }]);

      expect(await raw()).toEqual('{\n  "labels": [\n    {\n      "name": "A",\n      "color": "000000"\n    }\n  ]\n}\n');
      expect(existsSync(`${configPath}.tmp`)).toBeFalse();
    });

    it('renders an empty array as "labels": []', async () => {
      await labelConfig.write(configPath, []);

      expect(await raw()).toEqual('{\n  "labels": []\n}\n');
    });
  });

  describe('#replace', () => {
    it('overwrites the whole array', async () => {
      await seed('{"labels":[{"name":"Old","color":"000000"}]}');

      expect(await labelConfig.replace(configPath, ['A:111111', 'B:222222'])).toBeNull();
      expect(await labelConfig.readPairs(configPath)).toEqual([
        { name: 'A', color: '111111' },
        { name: 'B', color: '222222' }
      ]);
    });

    it('returns the first error and writes nothing', async () => {
      const error = await labelConfig.replace(configPath, ['A:111111', 'bad', ':x']);

      expect(error).toEqual('Error: invalid pair \'bad\' — expected <label name>:<hex color>');
      expect(existsSync(configPath)).toBeFalse();
    });
  });

  describe('#ensureDefaults', () => {
    it('writes the defaults for a missing file', async () => {
      await labelConfig.ensureDefaults(configPath);

      const pairs = await labelConfig.readPairs(configPath);

      expect(pairs.map(({ name, color }) => `${name}:${color}`)).toEqual([...DEFAULT_LABEL_PAIRS]);
    });

    it('writes the defaults for malformed JSON or an empty array', async () => {
      for (const content of ['nope', '{"labels":[]}']) {
        await seed(content);
        await labelConfig.ensureDefaults(configPath);

        expect((await labelConfig.readPairs(configPath)).length).toEqual(22);
      }
    });

    it('leaves a non-empty config untouched', async () => {
      const content = '{"labels":[{"name":"A","color":"000000"}]}';

      await seed(content);
      await labelConfig.ensureDefaults(configPath);

      expect(await raw()).toEqual(content);
    });
  });

  describe('#remove', () => {
    it('removes exact-name matches, ignoring unknown names', async () => {
      await seed('{"labels":[{"name":"A","color":"000000"},{"name":"B","color":"111111"},{"name":"a","color":"222222"}]}');

      expect(await labelConfig.remove(configPath, ['A', 'Nope'])).toBeNull();
      expect(await labelConfig.readPairs(configPath)).toEqual([
        { name: 'B', color: '111111' },
        { name: 'a', color: '222222' }
      ]);
    });

    it('writes an empty array for a missing config', async () => {
      expect(await labelConfig.remove(configPath, ['A'])).toBeNull();
      expect(await raw()).toEqual('{\n  "labels": []\n}\n');
    });

    it('rejects a name containing a colon without writing', async () => {
      const error = await labelConfig.remove(configPath, ['A', 'B:111111']);

      expect(error).toEqual(
        'Error: invalid label name \'B:111111\' — remove takes bare names, not <name>:<color> pairs'
      );
      expect(existsSync(configPath)).toBeFalse();
    });
  });

  describe('#add', () => {
    it('replaces in place and appends new names', async () => {
      await seed('{"labels":[{"name":"A","color":"000000"},{"name":"B","color":"111111"}]}');

      expect(await labelConfig.add(configPath, ['C:333333', 'A:aaaaaa'])).toBeNull();
      expect(await labelConfig.readPairs(configPath)).toEqual([
        { name: 'A', color: 'aaaaaa' },
        { name: 'B', color: '111111' },
        { name: 'C', color: '333333' }
      ]);
    });

    it('starts from an empty list for a missing config', async () => {
      expect(await labelConfig.add(configPath, ['A:000000'])).toBeNull();
      expect(await labelConfig.readPairs(configPath)).toEqual([{ name: 'A', color: '000000' }]);
    });

    it('returns the first error and writes nothing', async () => {
      const error = await labelConfig.add(configPath, ['A:zzzzzz']);

      expect(error).toEqual('Error: invalid color \'zzzzzz\' for label \'A\' — expected exactly 6 hex digits');
      expect(existsSync(configPath)).toBeFalse();
    });
  });
});
