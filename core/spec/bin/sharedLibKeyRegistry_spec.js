import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import KeyRegistry from '../../../shared/lib/config/KeyRegistry.js';
import { REPO_ROOT } from '../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Unit and registry-parity specs for arcanum/_lib/key_registry.sh
// (issues #903, #905), the shell mirror of KeyRegistry#lookup /
// #allowsTier / #defaultTier.
// Lookups are batched into one bash invocation per case to keep the
// spec fast.

const execFileAsync = promisify(execFile);
const KEY_REGISTRY_LIB = path.join(REPO_ROOT, 'arcanum', '_lib', 'key_registry.sh');
const TIERS = ['local', 'repo', 'global'];

const ALLOWS_TIER_SCRIPT = [
  'source "$1"; shift',
  'while [ "$#" -gt 0 ]; do key_registry_allows_tier "$1" "$2"; echo "rc=$?"; shift 2; done'
].join('\n');

const DEFAULT_TIER_SCRIPT = [
  'source "$1"; shift',
  'for key in "$@"; do tier="$(key_registry_default_tier "$key")"; rc=$?; printf "%s|rc=%s\\n" "$tier" "$rc"; done'
].join('\n');

const HAS_KEY_SCRIPT = [
  'source "$1"; shift',
  'while [ "$#" -gt 0 ]; do key_registry_has_key "$1"; echo "$?"; shift; done'
].join('\n');

/**
 * @param {string|undefined} registryFile - the `KEY_REGISTRY_FILE` to
 *   use, or `undefined` to read the installed `keys.json`.
 * @returns {object} the env for the shell run.
 */
function shellEnv(registryFile) {
  const env = { ...process.env };

  delete env.KEY_REGISTRY_FILE;

  if (registryFile !== undefined) {
    env.KEY_REGISTRY_FILE = registryFile;
  }

  return env;
}

/**
 * Runs `key_registry_allows_tier` once per `[key, tier]` pair in a
 * single bash invocation.
 * @param {string|undefined} registryFile - see `shellEnv`.
 * @param {Array<[string, string]>} pairs - the lookups.
 * @returns {Promise<{results: string[], codes: string[], stderr: string}>}
 *   one printed result and one exit status per pair, plus stderr.
 */
async function allowsTier(registryFile, pairs) {
  const { stdout, stderr } = await execFileAsync('bash', [
    '-c', ALLOWS_TIER_SCRIPT, 'key-registry-spec', KEY_REGISTRY_LIB, ...pairs.flat()
  ], { env: shellEnv(registryFile) });
  const lines = stdout.split('\n').filter((line) => line !== '');

  return {
    results: lines.filter((line) => !line.startsWith('rc=')),
    codes: lines.filter((line) => line.startsWith('rc=')).map((line) => line.slice(3)),
    stderr
  };
}

/**
 * Runs `key_registry_has_key` once per key in a single bash invocation.
 * @param {string|undefined} registryFile - see `shellEnv`.
 * @param {string[]} keys - the keys to check.
 * @returns {Promise<{codes: string[], stderr: string}>} one exit status
 *   per key, plus stderr.
 */
async function hasKey(registryFile, keys) {
  const { stdout, stderr } = await execFileAsync('bash', [
    '-c', HAS_KEY_SCRIPT, 'key-registry-spec', KEY_REGISTRY_LIB, ...keys
  ], { env: shellEnv(registryFile) });

  return { codes: stdout.split('\n').filter((line) => line !== ''), stderr };
}

/**
 * Runs `key_registry_default_tier` once per key in a single bash
 * invocation.
 * @param {string|undefined} registryFile - see `shellEnv`.
 * @param {string[]} keys - the keys to look up.
 * @returns {Promise<{results: string[], codes: string[], stderr: string}>}
 *   one printed tier (`''` when nothing was printed) and one exit status
 *   per key, plus stderr.
 */
async function defaultTier(registryFile, keys) {
  const { stdout, stderr } = await execFileAsync('bash', [
    '-c', DEFAULT_TIER_SCRIPT, 'key-registry-spec', KEY_REGISTRY_LIB, ...keys
  ], { env: shellEnv(registryFile) });
  const lines = stdout.split('\n').filter((line) => line !== '');

  return {
    results: lines.map((line) => line.replace(/\|rc=\d+$/, '')),
    codes: lines.map((line) => line.replace(/^.*\|rc=/, '')),
    stderr
  };
}

/**
 * Asserts each key printed its expected default tier, exited 0 and
 * wrote nothing to stderr.
 * @param {string|undefined} registryFile - see `shellEnv`.
 * @param {Array<[string, string]>} cases - `[key, expected]`.
 * @returns {Promise<void>} resolves once asserted.
 */
async function expectDefaultTier(registryFile, cases) {
  const { results, codes, stderr } = await defaultTier(registryFile, cases.map(([key]) => key));

  expect(results).toEqual(cases.map(([, expected]) => expected));
  expect(codes).toEqual(cases.map(() => '0'));
  expect(stderr).toEqual('');
}

/**
 * Asserts each pair printed its expected result, exited 0 and wrote
 * nothing to stderr.
 * @param {string|undefined} registryFile - see `shellEnv`.
 * @param {Array<[string, string, string]>} cases - `[key, tier, expected]`.
 * @returns {Promise<void>} resolves once asserted.
 */
async function expectAllowsTier(registryFile, cases) {
  const { results, codes, stderr } = await allowsTier(
    registryFile, cases.map(([key, tier]) => [key, tier])
  );

  expect(results).toEqual(cases.map(([, , expected]) => expected));
  expect(codes).toEqual(cases.map(() => '0'));
  expect(stderr).toEqual('');
}

describe('arcanum/_lib/key_registry.sh', () => {
  let tempDir;
  let registryFile;

  /**
   * @param {string} content - the raw registry file content.
   * @returns {Promise<void>} resolves once written.
   */
  const writeRegistry = (content) => writeFile(registryFile, content);

  /**
   * @param {Array<{key: string, tiers: string[]}>} keys - the entries.
   * @returns {Promise<void>} resolves once written.
   */
  const writeKeys = (keys) => writeRegistry(JSON.stringify({ format_version: 1, keys }));

  beforeEach(async () => {
    tempDir = await createTempDir('arcanum-core-key-registry-');
    registryFile = path.join(tempDir, 'keys.json');
  });

  afterEach(async () => {
    await removeTempDir(tempDir);
  });

  describe('key_registry_allows_tier', () => {
    describe('with an exact entry', () => {
      beforeEach(async () => {
        await writeKeys([{ key: 'a.b', tiers: ['local', 'repo'] }]);
      });

      it('prints true for a listed tier and false for an unlisted one', async () => {
        await expectAllowsTier(registryFile, [
          ['a.b', 'local', 'true'],
          ['a.b', 'repo', 'true'],
          ['a.b', 'global', 'false']
        ]);
      });
    });

    describe('with a wildcard entry', () => {
      beforeEach(async () => {
        await writeKeys([{ key: 'a.<x>.c', tiers: ['repo'] }]);
      });

      it('matches a concrete key with the same segment count', async () => {
        await expectAllowsTier(registryFile, [
          ['a.anything.c', 'repo', 'true'],
          ['a.anything.c', 'local', 'false']
        ]);
      });

      it('prints null for a key with a different segment count', async () => {
        await expectAllowsTier(registryFile, [
          ['a.c', 'repo', 'null'],
          ['a.x.y.c', 'repo', 'null'],
          ['a.x.d', 'repo', 'null']
        ]);
      });
    });

    describe('with both an exact and a wildcard entry matching', () => {
      beforeEach(async () => {
        await writeKeys([
          { key: 'a.<x>', tiers: ['global'] },
          { key: 'a.b', tiers: ['local'] }
        ]);
      });

      it('uses the exact entry', async () => {
        await expectAllowsTier(registryFile, [
          ['a.b', 'local', 'true'],
          ['a.b', 'global', 'false'],
          ['a.other', 'global', 'true'],
          ['a.other', 'local', 'false']
        ]);
      });
    });

    describe('with two wildcard entries matching', () => {
      it('uses the first one in registry order', async () => {
        await writeKeys([
          { key: 'a.<x>.c', tiers: ['local'] },
          { key: 'a.b.<y>', tiers: ['global'] }
        ]);

        await expectAllowsTier(registryFile, [
          ['a.b.c', 'local', 'true'],
          ['a.b.c', 'global', 'false']
        ]);
      });

      it('follows the registry order when it is reversed', async () => {
        await writeKeys([
          { key: 'a.b.<y>', tiers: ['global'] },
          { key: 'a.<x>.c', tiers: ['local'] }
        ]);

        await expectAllowsTier(registryFile, [
          ['a.b.c', 'local', 'false'],
          ['a.b.c', 'global', 'true']
        ]);
      });
    });

    describe('with unknown, non-leaf or malformed keys', () => {
      beforeEach(async () => {
        await writeKeys([{ key: 'a.b.c', tiers: ['local', 'repo', 'global'] }]);
      });

      it('prints null', async () => {
        await expectAllowsTier(registryFile, [
          ['no.such.key', 'local', 'null'],
          ['a.b', 'local', 'null'],
          ['a..b', 'local', 'null'],
          ['a.b c', 'local', 'null'],
          ['', 'local', 'null']
        ]);
      });
    });

    describe('with an invalid tier name', () => {
      beforeEach(async () => {
        await writeKeys([{ key: 'a.b', tiers: ['local'] }]);
      });

      it('prints null', async () => {
        await expectAllowsTier(registryFile, [
          ['a.b', 'local2', 'null'],
          ['a.b', '', 'null']
        ]);
      });
    });

    describe('with registry problems', () => {
      const cases = [
        ['a.b', 'local', 'null'],
        ['a.<x>', 'repo', 'null']
      ];

      it('prints null when the registry file is missing', async () => {
        await expectAllowsTier(path.join(tempDir, 'missing.json'), cases);
      });

      it('prints null when the registry is not valid JSON', async () => {
        await writeRegistry('{ not json');

        await expectAllowsTier(registryFile, cases);
      });

      it('prints null when the registry has no keys', async () => {
        await writeRegistry('{"format_version":1}');

        await expectAllowsTier(registryFile, cases);
      });
    });
  });

  describe('key_registry_default_tier', () => {
    describe('with the default-tier rule', () => {
      beforeEach(async () => {
        await writeKeys([
          { key: 'a.explicit', tiers: ['local', 'repo', 'global'], default_tier: 'global' },
          { key: 'a.only', tiers: ['repo'] },
          { key: 'a.with_local', tiers: ['global', 'repo', 'local'] },
          { key: 'a.first', tiers: ['global', 'repo'] },
          { key: 'a.none', tiers: [] },
          { key: 'a.<x>.c', tiers: ['repo', 'global'] }
        ]);
      });

      it('prints default_tier, else the only tier, else local, else the first tier', async () => {
        await expectDefaultTier(registryFile, [
          ['a.explicit', 'global'],
          ['a.only', 'repo'],
          ['a.with_local', 'local'],
          ['a.first', 'global'],
          ['a.anything.c', 'repo']
        ]);
      });

      it('prints nothing for an entry without tiers', async () => {
        await expectDefaultTier(registryFile, [['a.none', '']]);
      });
    });

    describe('with both an exact and a wildcard entry matching', () => {
      beforeEach(async () => {
        await writeKeys([
          { key: 'a.<x>', tiers: ['global'] },
          { key: 'a.b', tiers: ['repo'] }
        ]);
      });

      it('uses the exact entry', async () => {
        await expectDefaultTier(registryFile, [
          ['a.b', 'repo'],
          ['a.other', 'global']
        ]);
      });
    });

    describe('with unknown or malformed keys', () => {
      beforeEach(async () => {
        await writeKeys([{ key: 'a.b.c', tiers: ['local'] }]);
      });

      it('prints nothing', async () => {
        await expectDefaultTier(registryFile, [
          ['no.such.key', ''],
          ['a.b', ''],
          ['a..b', ''],
          ['a.b c', ''],
          ['', '']
        ]);
      });
    });

    describe('with registry problems', () => {
      const cases = [['a.b', ''], ['a.<x>', '']];

      it('prints nothing when the registry file is missing', async () => {
        await expectDefaultTier(path.join(tempDir, 'missing.json'), cases);
      });

      it('prints nothing when the registry is not valid JSON', async () => {
        await writeRegistry('{ not json');

        await expectDefaultTier(registryFile, cases);
      });

      it('prints nothing when the registry has no keys', async () => {
        await writeRegistry('{"format_version":1}');

        await expectDefaultTier(registryFile, cases);
      });
    });
  });

  describe('key_registry_has_key', () => {
    beforeEach(async () => {
      await writeKeys([
        { key: 'a.b', tiers: ['local'] },
        { key: 'c.<x>', tiers: ['repo'] }
      ]);
    });

    it('exits 0 for exact and wildcard matches', async () => {
      const { codes, stderr } = await hasKey(registryFile, ['a.b', 'c.anything']);

      expect(codes).toEqual(['0', '0']);
      expect(stderr).toEqual('');
    });

    it('exits 1 for unknown or malformed keys', async () => {
      const { codes, stderr } = await hasKey(registryFile, ['no.such.key', 'a', 'a..b', 'a.b c', '']);

      expect(codes).toEqual(['1', '1', '1', '1', '1']);
      expect(stderr).toEqual('');
    });

    it('exits 1 for a missing registry', async () => {
      const { codes, stderr } = await hasKey(path.join(tempDir, 'missing.json'), ['a.b', 'c.anything']);

      expect(codes).toEqual(['1', '1']);
      expect(stderr).toEqual('');
    });
  });

  describe('parity with KeyRegistry#allowsTier on the installed keys.json', () => {
    const registry = new KeyRegistry();
    const concreteKeys = registry.entries().map(
      ({ key }) => key.split('.').map((segment) => (/^<.+>$/.test(segment) ? 'sample' : segment)).join('.')
    );
    const keys = [...concreteKeys, 'git.agents', 'no.such.key', 'git.bad key'];
    const pairs = keys.flatMap((key) => TIERS.map((tier) => [key, tier]));

    it('prints what the JS registry returns for every entry and tier', async () => {
      const { results, codes, stderr } = await allowsTier(undefined, pairs);
      const expected = pairs.map(([key, tier]) => String(registry.allowsTier(key, tier)));

      expect(results.map((result, index) => `${pairs[index].join(' ')} => ${result}`))
        .toEqual(expected.map((result, index) => `${pairs[index].join(' ')} => ${result}`));
      expect(codes).toEqual(pairs.map(() => '0'));
      expect(stderr).toEqual('');
    });
  });

  describe('parity with KeyRegistry#defaultTier on the installed keys.json', () => {
    const registry = new KeyRegistry();
    const concreteKeys = registry.entries().map(
      ({ key }) => key.split('.').map((segment) => (/^<.+>$/.test(segment) ? 'sample' : segment)).join('.')
    );
    const keys = [...concreteKeys, 'git.agents', 'no.such.key', 'git.bad key'];

    it('prints what the JS registry returns for every entry', async () => {
      const { results, codes, stderr } = await defaultTier(undefined, keys);
      const expected = keys.map((key) => registry.defaultTier(key) ?? '');

      expect(results.map((result, index) => `${keys[index]} => ${result}`))
        .toEqual(expected.map((result, index) => `${keys[index]} => ${result}`));
      expect(codes).toEqual(keys.map(() => '0'));
      expect(stderr).toEqual('');
    });
  });
});
