import { VersionSkewError } from '../../lib/exitCodes.js';
import {
  checkWriteSkew, compareVersions, pendingText, pointerOf, readWarning, skewStatus, tierSkew
} from '../../lib/skew.js';

describe('skew', () => {
  const migrationVersions = { repo: ['2.0.0', '2.3.0'], local: ['1.0.0', '2.1.0', '2.4.0'], global: [] };
  const options = { cliVersion: '2.4.0', migrationVersions };

  describe('compareVersions', () => {
    it('compares numerically', () => {
      expect(compareVersions('0.9.3', '0.13.0')).toBeLessThan(0);
      expect(compareVersions('2.4.0', '2.4.0')).toBe(0);
      expect(compareVersions('3.0.0', '2.9.9')).toBeGreaterThan(0);
    });
  });

  describe('pointerOf', () => {
    it('reads .version for the repo tier', () => {
      expect(pointerOf('repo', { version: '2.3.0' })).toEqual({ version: '2.3.0', present: true });
    });

    it('reads .migrations.version for the local and global tiers', () => {
      expect(pointerOf('local', { migrations: { version: '2.1.0' } })).toEqual({ version: '2.1.0', present: true });
      expect(pointerOf('global', { version: '9.9.9' })).toEqual({ version: '0.0.0', present: false });
    });

    it('counts a missing pointer as 0.0.0', () => {
      expect(pointerOf('repo', {})).toEqual({ version: '0.0.0', present: false });
      expect(pointerOf('local', { migrations: 'x' })).toEqual({ version: '0.0.0', present: false });
    });
  });

  describe('skewStatus', () => {
    it('is ahead when the pointer is newer than the CLI', () => {
      expect(skewStatus('2.5.0', { scope: 'repo', ...options })).toEqual({ status: 'ahead', pending: 0 });
    });

    it('counts the scope\'s pending migrations when behind', () => {
      expect(skewStatus('0.0.0', { scope: 'local', ...options })).toEqual({ status: 'behind', pending: 3 });
      expect(skewStatus('2.1.0', { scope: 'local', ...options })).toEqual({ status: 'behind', pending: 1 });
    });

    it('is up to date when behind with nothing pending in its scope', () => {
      expect(skewStatus('2.3.0', { scope: 'repo', ...options })).toEqual({ status: 'up_to_date', pending: 0 });
      expect(skewStatus('0.0.0', { scope: 'global', ...options })).toEqual({ status: 'up_to_date', pending: 0 });
    });

    it('is up to date when equal', () => {
      expect(skewStatus('2.4.0', { scope: 'local', ...options })).toEqual({ status: 'up_to_date', pending: 0 });
    });

    it('ignores migrations newer than the CLI', () => {
      expect(skewStatus('2.3.0', { scope: 'repo', cliVersion: '2.3.5', migrationVersions: { repo: ['2.4.0'] } }))
        .toEqual({ status: 'up_to_date', pending: 0 });
    });
  });

  describe('tierSkew', () => {
    it('is null for a malformed file', () => {
      expect(tierSkew('repo', { state: 'invalid_json', data: {} }, options)).toBeNull();
    });

    it('combines the pointer and the status', () => {
      expect(tierSkew('repo', { state: 'ok', data: { version: '2.0.0' } }, options)).toEqual({
        version: '2.0.0', present: true, status: 'behind', pending: 1
      });
    });
  });

  describe('pendingText', () => {
    it('pluralizes', () => {
      expect(pendingText(1)).toBe('1 pending migration');
      expect(pendingText(3)).toBe('3 pending migrations');
    });
  });

  describe('readWarning', () => {
    it('warns on a tier ahead', () => {
      expect(readWarning('repo', { version: '2.5.0', status: 'ahead' }, '2.4.0'))
        .toBe('repo config is at 2.5.0, newer than this CLI (2.4.0); keys may have moved, run npm i -g arcanum-cli@latest');
    });

    it('warns on a tier behind with pending migrations', () => {
      expect(readWarning('local', { version: '0.0.0', status: 'behind', pending: 3 }, '2.4.0'))
        .toBe('local config is at 0.0.0 with 3 pending migrations; run /arcanum-migrate');
    });

    it('is silent when up to date or malformed', () => {
      expect(readWarning('repo', { version: '2.4.0', status: 'up_to_date', pending: 0 }, '2.4.0')).toBeNull();
      expect(readWarning('repo', null, '2.4.0')).toBeNull();
    });
  });

  describe('checkWriteSkew', () => {
    it('refuses a write to a tier ahead with exit 5', () => {
      expect(() => checkWriteSkew('repo', { version: '2.5.0', status: 'ahead' }, { cliVersion: '2.4.0', force: false }))
        .toThrowMatching((error) => error instanceof VersionSkewError &&
          error.message === 'repo config is at 2.5.0, newer than this CLI (2.4.0)' &&
          error.hint === 'npm i -g arcanum-cli@latest, or pass --force');
    });

    it('lets --force bypass it, reporting the bypass', () => {
      expect(checkWriteSkew('repo', { version: '2.5.0', status: 'ahead' }, { cliVersion: '2.4.0', force: true })).toBeTrue();
    });

    it('allows a tier behind or malformed without a bypass', () => {
      expect(checkWriteSkew('repo', { status: 'behind' }, { cliVersion: '2.4.0', force: true })).toBeFalse();
      expect(checkWriteSkew('repo', null, { cliVersion: '2.4.0', force: false })).toBeFalse();
    });
  });
});
