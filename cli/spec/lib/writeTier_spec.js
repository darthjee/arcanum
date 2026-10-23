import KeyRegistry from '../../../shared/lib/config/KeyRegistry.js';
import { CliError, TargetUnavailableError, ValidationError } from '../../lib/exitCodes.js';
import { parseValue } from '../../lib/values.js';
import path from 'node:path';
import { removeDir, tmpDir } from '../support/fixtures.js';
import { checkWriteTarget, validateSet, validateUnset, validationError, wasText, writeKey } from '../../lib/writeTier.js';

describe('writeTier', () => {
  const registry = new KeyRegistry();

  describe('checkWriteTarget', () => {
    const repo = { root: '/r', configured: true, path: '/r' };
    const account = { dir: '/a', state: 'ok' };

    it('accepts usable targets', () => {
      expect(() => checkWriteTarget('global', { account, repo })).not.toThrow();
      expect(() => checkWriteTarget('local', { account, repo })).not.toThrow();
    });

    [
      ['global', { account: { dir: null, state: 'unresolved' }, repo }, /no claude config dir resolved/],
      ['global', { account: { dir: '/a', state: 'missing' }, repo }, /does not exist/],
      ['global', { account: { dir: '/a', state: 'not_directory' }, repo }, /is not a directory/],
      ['repo', { account, repo: { root: null, path: '/x' } }, /no repo at \/x/],
      ['local', { account, repo: { root: '/r', configured: false } }, /is not arcanum-configured/]
    ].forEach(([tier, targets, message]) => {
      it(`refuses ${tier} with ${message}`, () => {
        expect(() => checkWriteTarget(tier, targets)).toThrowError(TargetUnavailableError, message);
      });
    });
  });

  describe('validateSet', () => {
    const check = (key, raw, { tier = 'global', force = false, string = false } = {}) => validateSet({
      registry, key, tier, parsed: parseValue(raw, { string }), raw, force, string
    });

    it('accepts a valid known key', () => {
      expect(check('engine.mode', 'native')).toEqual({ known: true, forced: false });
    });

    it('forces an unknown key', () => {
      expect(check('x.y', '1', { force: true })).toEqual({ known: false, forced: true });
    });

    it('refuses an empty string', () => {
      expect(() => check('git.email', '')).toThrowError(ValidationError, 'git.email may not be empty');
    });

    it('refuses an array element of the wrong type', () => {
      expect(() => check('git.remove_coauthors', '["a",1]'))
        .toThrowError(ValidationError, 'git.remove_coauthors[1] must be a string, got number 1');
    });

    it('stores a broken JSON as a string for a non-array key', () => {
      expect(check('git.email', '{a:1}')).toEqual({ known: true, forced: false });
    });
  });

  describe('validateUnset', () => {
    it('accepts a known key', () => {
      expect(validateUnset({ registry, key: 'git.email', tier: 'local', force: false })).toEqual({ known: true, forced: false });
    });

    it('refuses an unknown key without --force', () => {
      expect(() => validateUnset({ registry, key: 'x.y', tier: 'local', force: false })).toThrowError(ValidationError);
    });
  });

  describe('validationError', () => {
    it('words the number refusals', () => {
      expect(validationError('k', 'repo', { reason: 'integer', got: 1.5 }).message).toBe('k must be an integer, got 1.5');
      expect(validationError('k', 'repo', { reason: 'min', min: 1, got: 0 }).message).toBe('k must be at least 1, got 0');
      expect(validationError('k', 'repo', { reason: 'max', max: 1, got: 2 }).message).toBe('k must be at most 1, got 2');
    });

    it('lists the allowed tiers of a multi-tier key', () => {
      expect(validationError('k', 'global', { reason: 'tier', allowed: ['repo', 'local'] }).message)
        .toBe('k cannot be written to the global tier (allowed: repo, local)');
    });

    it('does not echo a long value', () => {
      expect(validationError('k', 'repo', { reason: 'enum', values: ['a'] }, 'x'.repeat(100)).message)
        .toBe('k must be one of a, got a 102-character value');
    });

    it('has a fallback', () => {
      expect(validationError('k', 'repo', { reason: 'other' }).message).toBe('k is not a valid value');
    });
  });

  describe('wasText', () => {
    it('formats the previous value', () => {
      expect(wasText({ set: false })).toBe('unset');
      expect(wasText({ set: true, value: [1] })).toBe('[1]');
    });
  });

  describe('writeKey', () => {
    const signals = { on: () => {}, off: () => {}, exit: () => {} };
    let tmp;

    beforeEach(async () => {
      tmp = await tmpDir();
    });

    afterEach(async () => {
      await removeDir(tmp);
    });

    it('maps an errno error to a file error', async () => {
      const lock = { acquire: () => Promise.reject(Object.assign(new Error('EACCES: denied'), { errno: -13, code: 'EACCES' })), release: () => Promise.resolve() };

      await expectAsync(writeKey({
        op: 'set', file: path.join(tmp, 'f.json'), key: 'a', value: 1, known: false,
        timeoutMs: 0, timeoutLabel: '0', deps: { lock, signals }
      })).toBeRejectedWithError(CliError, /cannot write .*f\.json: EACCES: denied/);
    });

    it('rethrows an unknown error as is', async () => {
      const boom = new Error('boom');
      const lock = { acquire: () => Promise.reject(boom), release: () => Promise.resolve() };

      await expectAsync(writeKey({
        op: 'unset', file: path.join(tmp, 'f.json'), key: 'a', known: false,
        timeoutMs: 0, timeoutLabel: '0', deps: { lock, signals }
      })).toBeRejectedWith(boom);
    });
  });
});
