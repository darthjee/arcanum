import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ConfigChain from '../../../shared/lib/config/ConfigChain.js';
import { FileError } from '../../lib/exitCodes.js';
import {
  isMalformed, lookupKey, malformedReason, readTier, readTierForWrite, readTierTolerant, tierFile
} from '../../lib/tierFiles.js';
import { removeDir, tmpDir } from '../support/fixtures.js';

describe('tierFiles', () => {
  let tmp;
  let file;

  beforeEach(async () => {
    tmp = await tmpDir();
    file = path.join(tmp, 'arcanum-config.json');
  });

  afterEach(async () => {
    await removeDir(tmp);
  });

  describe('tierFile', () => {
    it('matches ConfigChain\'s tier paths', () => {
      const targets = { account: { dir: '/acct' }, repo: { root: '/repo' } };
      const chain = new ConfigChain({ env: { CLAUDE_CONFIG_DIR: '/acct' } });

      expect(['local', 'repo', 'global'].map((tier) => tierFile(tier, targets))).toEqual(chain._tierFiles('/repo'));
    });

    it('is null without a target', () => {
      const targets = { account: { dir: null }, repo: { root: null } };

      expect(tierFile('global', targets)).toBeNull();
      expect(tierFile('repo', targets)).toBeNull();
      expect(tierFile('local', targets)).toBeNull();
    });
  });

  describe('readTier', () => {
    it('reads an object', async () => {
      await writeFile(file, '{"a":{"b":1}}');

      expect(await readTier(file)).toEqual({ state: 'ok', data: { a: { b: 1 } }, error: null });
    });

    it('treats a missing file as an empty tier', async () => {
      expect(await readTier(file)).toEqual({ state: 'missing', data: {}, error: null });
    });

    it('treats no target as an empty tier', async () => {
      expect((await readTier(null)).state).toBe('missing');
    });

    ['', '  \n'].forEach((content) => {
      it(`treats ${JSON.stringify(content)} as an empty tier`, async () => {
        await writeFile(file, content);

        expect(await readTier(file)).toEqual({ state: 'empty', data: {}, error: null });
      });
    });

    it('strips a UTF-8 BOM', async () => {
      await writeFile(file, '﻿{"a":1}');

      expect(await readTier(file)).toEqual({ state: 'ok', data: { a: 1 }, error: null });
    });

    it('reports invalid JSON with its line', async () => {
      await writeFile(file, '{\n"a": 1,\n}');

      expect(await readTier(file)).toEqual({ state: 'invalid_json', data: {}, error: 'line 3' });
    });

    [['null', 'null'], ['[1]', 'array'], ['"s"', '"s"'], ['42', '42'], ['true', 'true']].forEach(([content, got]) => {
      it(`reports a ${content} top level as not an object`, async () => {
        await writeFile(file, content);

        expect(await readTier(file)).toEqual({ state: 'not_object', data: {}, error: got });
      });
    });

    it('reports a directory as unreadable', async () => {
      await mkdir(file);

      expect((await readTier(file)).state).toBe('unreadable');
    });

    if (process.getuid && process.getuid() !== 0) {
      it('reports a file without read permission as unreadable', async () => {
        await writeFile(file, '{}');
        await chmod(file, 0o000);

        expect(await readTier(file)).toEqual({ state: 'unreadable', data: {}, error: 'EACCES' });
      });
    }

    it('reports a non-UTF-8 file', async () => {
      await writeFile(file, Buffer.from([0x7b, 0xff, 0x7d]));

      expect((await readTier(file)).state).toBe('not_utf8');
    });
  });

  describe('isMalformed', () => {
    it('is true only for the malformed states', () => {
      expect(['ok', 'missing', 'empty', 'invalid_json', 'not_object', 'unreadable', 'not_utf8'].map(isMalformed))
        .toEqual([false, false, false, true, true, true, true]);
    });
  });

  describe('malformedReason', () => {
    it('names the file and the problem', () => {
      expect(malformedReason('/f', { state: 'invalid_json', error: 'line 3' })).toBe('/f is not valid JSON (line 3)');
      expect(malformedReason('/f', { state: 'not_object', error: 'array' })).toBe('/f is not a JSON object (got array)');
      expect(malformedReason('/f', { state: 'not_utf8', error: null })).toBe('/f is not UTF-8');
      expect(malformedReason('/f', { state: 'unreadable', error: 'EISDIR' })).toBe('/f is unreadable (EISDIR)');
    });
  });

  describe('readTierTolerant', () => {
    it('warns on a malformed file and reads it as empty', async () => {
      const warnings = [];

      await writeFile(file, '[1]');

      expect((await readTierTolerant(file, (message) => warnings.push(message))).data).toEqual({});
      expect(warnings).toEqual([`${file} is not a JSON object (got array); ignoring it`]);
    });

    it('is silent on a missing file', async () => {
      const warnings = [];

      await readTierTolerant(file, (message) => warnings.push(message));

      expect(warnings).toEqual([]);
    });
  });

  describe('readTierForWrite', () => {
    it('refuses a malformed file, leaving its bytes unchanged', async () => {
      await writeFile(file, '{oops');

      await expectAsync(readTierForWrite(file)).toBeRejectedWithError(FileError, /refusing to overwrite it/);
      expect(await readFile(file, 'utf8')).toBe('{oops');
    });

    it('accepts an empty file', async () => {
      await writeFile(file, '');

      expect((await readTierForWrite(file)).state).toBe('empty');
    });
  });

  describe('lookupKey', () => {
    const data = { a: { b: 1, n: null, s: 'x' }, arr: [1] };

    it('resolves a dotted key', () => {
      expect(lookupKey(data, 'a.b')).toEqual({ set: true, value: 1 });
    });

    it('treats null and missing as unset', () => {
      expect(lookupKey(data, 'a.n')).toEqual({ set: false, value: null });
      expect(lookupKey(data, 'a.z')).toEqual({ set: false, value: null });
      expect(lookupKey(data, 'a.s.x')).toEqual({ set: false, value: null });
      expect(lookupKey(data, 'arr.0')).toEqual({ set: false, value: null });
    });
  });
});
