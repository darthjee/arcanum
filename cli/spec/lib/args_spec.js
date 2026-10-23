import {
  checkArity,
  checkFlags,
  checkKey,
  extractRepoTarget,
  firstPositional,
  isPathToken,
  joinAnd,
  lockTimeoutMs,
  requireTier,
  selectedTier,
  valueOptionNames
} from '../../lib/args.js';
import { UsageError } from '../../lib/exitCodes.js';

describe('args', () => {
  describe('extractRepoTarget', () => {
    it('treats --repo=<path> as the targeting form', () => {
      expect(extractRepoTarget(['config', 'get', 'k', '--repo=foo'])).toEqual({
        args: ['config', 'get', 'k'], repoPath: 'foo'
      });
    });

    it('treats --repo <token> with a / as the targeting form', () => {
      expect(extractRepoTarget(['--repo', 'x/y', 'config', 'list'])).toEqual({
        args: ['config', 'list'], repoPath: 'x/y'
      });
    });

    ['.', '..'].forEach((token) => {
      it(`treats --repo ${token} as the targeting form`, () => {
        expect(extractRepoTarget(['config', 'info', '--repo', token]).repoPath).toBe(token);
      });
    });

    it('treats --repo <key> as the tier flag', () => {
      expect(extractRepoTarget(['config', 'get', '--repo', 'engine.mode'])).toEqual({
        args: ['config', 'get', '--repo', 'engine.mode'], repoPath: undefined
      });
    });

    it('treats a trailing --repo as the tier flag', () => {
      expect(extractRepoTarget(['config', 'get', 'k', '--repo'])).toEqual({
        args: ['config', 'get', 'k', '--repo'], repoPath: undefined
      });
    });

    it('accepts both forms together', () => {
      expect(extractRepoTarget(['config', 'get', 'k', '--repo=/x', '--repo'])).toEqual({
        args: ['config', 'get', 'k', '--repo'], repoPath: '/x'
      });
    });

    it('stops scanning at --', () => {
      expect(extractRepoTarget(['config', 'set', 'k', '--', '--repo=/x'])).toEqual({
        args: ['config', 'set', 'k', '--', '--repo=/x'], repoPath: undefined
      });
    });

    it('refuses two targeting paths', () => {
      expect(() => extractRepoTarget(['--repo=/a', '--repo', '/b'])).toThrowError(UsageError, /more than once/);
    });

    it('refuses an empty --repo=', () => {
      expect(() => extractRepoTarget(['--repo='])).toThrowError(UsageError, /needs a path/);
    });
  });

  describe('isPathToken', () => {
    it('is false for a dotted key', () => {
      expect(isPathToken('next_step.auto.x')).toBeFalse();
    });
  });

  describe('firstPositional', () => {
    it('skips the value of a value option', () => {
      expect(firstPositional(['--claude-config-dir', '/d', 'config'], ['claude-config-dir'])).toBe('config');
    });

    it('does not skip after an inline value', () => {
      expect(firstPositional(['--claude-config-dir=/d', 'config'], ['claude-config-dir'])).toBe('config');
    });

    it('takes the token after --', () => {
      expect(firstPositional(['--json', '--', '-x'], [])).toBe('-x');
    });

    it('is undefined with only flags', () => {
      expect(firstPositional(['--json', '--help'], [])).toBeUndefined();
    });
  });

  describe('valueOptionNames', () => {
    it('lists the string options', () => {
      expect(valueOptionNames({ a: { type: 'string' }, b: { type: 'boolean' } })).toEqual(['a']);
    });
  });

  describe('selectedTier', () => {
    it('is undefined without a tier flag', () => {
      expect(selectedTier({})).toBeUndefined();
    });

    it('returns the single tier', () => {
      expect(selectedTier({ local: true })).toBe('local');
    });

    it('refuses two tier flags', () => {
      expect(() => selectedTier({ global: true, repo: true }))
        .toThrowError(UsageError, '--global cannot be combined with --repo');
    });

    it('refuses --all-tiers with a tier flag', () => {
      expect(() => selectedTier({ repo: true, 'all-tiers': true }))
        .toThrowError(UsageError, '--all-tiers cannot be combined with --repo');
    });
  });

  describe('checkFlags', () => {
    const all = { string: { type: 'boolean', only: ['set'] }, force: { type: 'boolean', only: ['set', 'unset'] } };

    it('accepts the subcommand\'s own flags', () => {
      expect(() => checkFlags('set', { string: true }, { string: {} }, all)).not.toThrow();
    });

    it('refuses a flag of another subcommand', () => {
      expect(() => checkFlags('get', { force: true }, {}, all))
        .toThrowError(UsageError, '--force is only accepted by set and unset, not get');
    });
  });

  describe('checkArity', () => {
    it('accepts the exact count', () => {
      expect(() => checkArity('set', ['k', 'v'], ['key', 'value'])).not.toThrow();
    });

    it('refuses a missing positional', () => {
      expect(() => checkArity('set', ['k'], ['key', 'value'])).toThrowError(UsageError, 'set needs <value>');
    });

    it('refuses an extra positional', () => {
      expect(() => checkArity('list', ['x'], [])).toThrowError(UsageError, 'list: unexpected argument \'x\'');
    });

    it('accepts any number of positionals for a trailing variadic name', () => {
      expect(() => checkArity('setup', [], ['section...'])).not.toThrow();
      expect(() => checkArity('setup', ['a', 'b', 'c'], ['section...'])).not.toThrow();
    });

    it('still requires the names before a variadic one', () => {
      expect(() => checkArity('x', [], ['key', 'rest...'])).toThrowError(UsageError, 'x needs <key>');
    });
  });

  describe('joinAnd', () => {
    it('lists one, two or more words', () => {
      expect(joinAnd(['set'])).toBe('set');
      expect(joinAnd(['set', 'unset'])).toBe('set and unset');
      expect(joinAnd(['set', 'unset', 'setup'])).toBe('set, unset and setup');
    });
  });

  describe('checkKey', () => {
    it('accepts a dotted key', () => {
      expect(checkKey('a.b')).toBe('a.b');
    });

    ['', 'a..b', '.a', 'a.'].forEach((key) => {
      it(`refuses '${key}'`, () => {
        expect(() => checkKey(key)).toThrowError(UsageError, /may not be empty/);
      });
    });
  });

  describe('lockTimeoutMs', () => {
    it('defaults to 10 seconds', () => {
      expect(lockTimeoutMs(undefined)).toBe(10000);
    });

    it('accepts 0 and fractions', () => {
      expect(lockTimeoutMs('0')).toBe(0);
      expect(lockTimeoutMs('1.5')).toBe(1500);
    });

    ['-1', 'abc', '', '1e3'].forEach((raw) => {
      it(`refuses '${raw}'`, () => {
        expect(() => lockTimeoutMs(raw)).toThrowError(UsageError, /non-negative number/);
      });
    });
  });

  describe('requireTier', () => {
    it('returns the tier', () => {
      expect(requireTier('set', 'repo')).toBe('repo');
    });

    it('refuses a missing tier', () => {
      expect(() => requireTier('set', undefined))
        .toThrowError(UsageError, 'set needs a tier: --global, --repo or --local');
    });
  });
});
