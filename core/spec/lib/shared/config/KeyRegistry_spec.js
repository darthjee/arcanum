import KeyRegistry, { assertRegisteredConfigKey } from '../../../../lib/shared/config/KeyRegistry.js';

describe('KeyRegistry', () => {
  const ALL = ['global', 'repo', 'local'];

  function registryOf(...keys) {
    return new KeyRegistry({ format_version: 1, keys });
  }

  describe('constructor', () => {
    it('loads the bundled keys.json by default', () => {
      expect(new KeyRegistry().lookup('engine.mode').key).toBe('engine.mode');
    });

    it('refuses a format_version higher than 1', () => {
      expect(() => new KeyRegistry({ format_version: 2, keys: [] })).toThrowError(/format_version 2 is newer/);
    });

    it('refuses a registry with no integer format_version', () => {
      expect(() => new KeyRegistry({ keys: [] })).toThrowError(/no valid format_version/);
    });

    it('refuses a registry with no keys array', () => {
      expect(() => new KeyRegistry({ format_version: 1, keys: {} })).toThrowError(/no keys array/);
    });
  });

  describe('#entries', () => {
    it('returns a copy of the registry entries', () => {
      const registry = registryOf({ key: 'a.b', type: 'string', tiers: ALL, description: 'd' });
      const entries = registry.entries();

      entries.pop();

      expect(registry.entries().length).toBe(1);
    });
  });

  describe('#lookup', () => {
    let registry;

    beforeEach(() => {
      registry = registryOf(
        { key: 'next_step.auto.<skill>', type: 'boolean', tiers: ALL, description: 'wildcard' },
        { key: 'next_step.auto.arcanum-update', type: 'string', tiers: ALL, description: 'literal' },
        { key: 'git.agents.<agent>', type: 'string', tiers: ALL, description: 'agent' },
        { key: 'version', type: 'string', tiers: ['repo'], description: 'top level' }
      );
    });

    it('prefers an exact entry over a matching wildcard entry', () => {
      expect(registry.lookup('next_step.auto.arcanum-update').description).toBe('literal');
    });

    it('matches a wildcard entry for any other well-formed segment', () => {
      expect(registry.lookup('next_step.auto.enhance-issue').description).toBe('wildcard');
    });

    it('accepts dashes, underscores and digits in a concrete segment', () => {
      expect(registry.lookup('git.agents.node_2-x').key).toBe('git.agents.<agent>');
    });

    it('returns null when the segment count does not match', () => {
      expect(registry.lookup('git.agents.foo.bar')).toBeNull();
    });

    it('returns null for a namespace-only key', () => {
      expect(registry.lookup('git')).toBeNull();
    });

    it('returns null for a segment outside the charset', () => {
      expect(registry.lookup('git.agents.foo bar')).toBeNull();
    });

    it('returns null for an empty segment', () => {
      expect(registry.lookup('git..agents')).toBeNull();
    });

    it('does not treat a literal <name> segment as a wildcard', () => {
      expect(registry.lookup('git.agents.<agent>')).toBeNull();
    });

    it('matches a single-segment key', () => {
      expect(registry.lookup('version').key).toBe('version');
    });

    it('returns null for a non-string key', () => {
      expect(registry.lookup(undefined)).toBeNull();
    });

    it('returns null for an unregistered key', () => {
      expect(registry.lookup('git.nope')).toBeNull();
    });
  });

  describe('#lookupPattern', () => {
    let registry;

    beforeEach(() => {
      registry = registryOf(
        { key: 'next_step.auto.<skill>', type: 'boolean', tiers: ALL, description: 'wildcard' },
        { key: 'git.email', type: 'string', tiers: ALL, description: 'email' }
      );
    });

    it('matches a wildcard pattern whatever its label', () => {
      expect(registry.lookupPattern('next_step.auto.<x>').key).toBe('next_step.auto.<skill>');
    });

    it('matches a concrete pattern like lookup', () => {
      expect(registry.lookupPattern('next_step.auto.foo').key).toBe('next_step.auto.<skill>');
    });

    it('does not let a wildcard pattern segment match a literal entry segment', () => {
      expect(registry.lookupPattern('git.<field>')).toBeNull();
    });

    it('returns null when the segment count does not match', () => {
      expect(registry.lookupPattern('next_step.<a>.<b>.<c>')).toBeNull();
    });

    it('returns null for a malformed pattern', () => {
      expect(registry.lookupPattern('next_step.auto.foo_<x>')).toBeNull();
    });

    it('returns null for a non-string pattern', () => {
      expect(registry.lookupPattern(null)).toBeNull();
    });
  });

  describe('#check', () => {
    let registry;

    beforeEach(() => {
      registry = registryOf(
        { key: 'a.str', type: 'string', tiers: ALL, description: 'd' },
        { key: 'a.loose', type: 'string', allow_empty: true, tiers: ALL, description: 'd' },
        { key: 'a.enum', type: 'enum', values: ['x', 'y'], tiers: ALL, description: 'd' },
        { key: 'a.bool', type: 'boolean', tiers: ['local'], description: 'd' },
        { key: 'a.num', type: 'number', integer: true, min: 0, max: 10, tiers: ALL, description: 'd' },
        { key: 'a.float', type: 'number', tiers: ALL, description: 'd' },
        { key: 'a.list', type: 'array', items: 'string', format: 'regex', tiers: ALL, description: 'd' },
        { key: 'a.pattern', type: 'string', format: 'regex', tiers: ALL, description: 'd' },
        { key: 'a.ro', type: 'string', read_only: true, tiers: ['repo'], description: 'd' }
      );
    });

    it('accepts a valid write', () => {
      expect(registry.check('set', 'a.str', 'repo', 'v')).toEqual({ ok: true });
    });

    it('fails with unknown on an unregistered key', () => {
      expect(registry.check('set', 'a.nope', 'repo', 'v')).toEqual({ ok: false, reason: 'unknown', key: 'a.nope' });
    });

    it('fails with read_only on a read-only key', () => {
      expect(registry.check('set', 'a.ro', 'repo', 'v')).toEqual({ ok: false, reason: 'read_only', key: 'a.ro' });
    });

    it('checks read_only before the tier', () => {
      expect(registry.check('set', 'a.ro', 'global', 'v').reason).toBe('read_only');
    });

    it('fails with tier on a tier the entry does not allow', () => {
      expect(registry.check('set', 'a.bool', 'repo', true)).toEqual({
        ok: false, reason: 'tier', key: 'a.bool', tier: 'repo', allowed: ['local']
      });
    });

    it('checks the tier before the value', () => {
      expect(registry.check('set', 'a.bool', 'repo', 'not a boolean').reason).toBe('tier');
    });

    describe('with unset', () => {
      it('stops after the tier check, ignoring the value', () => {
        expect(registry.check('unset', 'a.bool', 'local')).toEqual({ ok: true });
      });

      it('still fails on the tier', () => {
        expect(registry.check('unset', 'a.bool', 'global').reason).toBe('tier');
      });

      it('still fails on an unknown key', () => {
        expect(registry.check('unset', 'a.nope', 'local').reason).toBe('unknown');
      });

      it('still fails on a read-only key', () => {
        expect(registry.check('unset', 'a.ro', 'repo').reason).toBe('read_only');
      });
    });

    it('throws on an unknown op', () => {
      expect(() => registry.check('get', 'a.str', 'repo')).toThrowError(TypeError, /unknown op/);
    });

    it('fails with null and the unset hint on a null value', () => {
      expect(registry.check('set', 'a.str', 'repo', null)).toEqual({
        ok: false, key: 'a.str', reason: 'null', expected: 'string', got: 'null',
        hint: 'use \'config unset\' to remove it'
      });
    });

    it('fails with type on a scalar type mismatch', () => {
      expect(registry.check('set', 'a.bool', 'local', 'true')).toEqual({
        ok: false, key: 'a.bool', reason: 'type', expected: 'boolean', got: 'string'
      });
    });

    it('fails with type when an array is given for a scalar', () => {
      expect(registry.check('set', 'a.str', 'repo', ['v']).got).toBe('array');
    });

    it('fails with type on a non-array for an array key', () => {
      expect(registry.check('set', 'a.list', 'repo', 'x')).toEqual({
        ok: false, key: 'a.list', reason: 'type', expected: 'array of string', got: 'string'
      });
    });

    it('fails with type and the element index on a wrong array element', () => {
      expect(registry.check('set', 'a.list', 'repo', ['x', 2])).toEqual({
        ok: false, key: 'a.list', reason: 'type', expected: 'array of string', got: 'number', index: 1
      });
    });

    it('fails with type on a non-string enum value', () => {
      expect(registry.check('set', 'a.enum', 'repo', 1).reason).toBe('type');
    });

    it('fails with type on a non-finite number', () => {
      expect(registry.check('set', 'a.float', 'repo', Infinity).reason).toBe('type');
    });

    it('fails with enum on a value outside the allowed values', () => {
      expect(registry.check('set', 'a.enum', 'repo', 'z')).toEqual({
        ok: false, key: 'a.enum', reason: 'enum', values: ['x', 'y'], got: 'z'
      });
    });

    it('accepts an allowed enum value', () => {
      expect(registry.check('set', 'a.enum', 'repo', 'y').ok).toBeTrue();
    });

    it('fails with empty on an empty string', () => {
      expect(registry.check('set', 'a.str', 'repo', '')).toEqual({ ok: false, key: 'a.str', reason: 'empty' });
    });

    it('accepts an empty string when allow_empty is set', () => {
      expect(registry.check('set', 'a.loose', 'repo', '').ok).toBeTrue();
    });

    it('accepts an empty array', () => {
      expect(registry.check('set', 'a.list', 'repo', []).ok).toBeTrue();
    });

    it('fails with integer on a fractional number', () => {
      expect(registry.check('set', 'a.num', 'repo', 1.5)).toEqual({ ok: false, key: 'a.num', reason: 'integer', got: 1.5 });
    });

    it('fails with min below the minimum', () => {
      expect(registry.check('set', 'a.num', 'repo', -1)).toEqual({ ok: false, key: 'a.num', reason: 'min', min: 0, got: -1 });
    });

    it('fails with max above the maximum', () => {
      expect(registry.check('set', 'a.num', 'repo', 11)).toEqual({ ok: false, key: 'a.num', reason: 'max', max: 10, got: 11 });
    });

    it('accepts any finite number when no constraint is set', () => {
      expect(registry.check('set', 'a.float', 'repo', -2.5).ok).toBeTrue();
    });

    it('fails with format, the element index and the compile error on an invalid regex', () => {
      expect(registry.check('set', 'a.list', 'repo', ['ok', 'fine', '(bad'])).toEqual({
        ok: false, key: 'a.list', reason: 'format', format: 'regex', error: 'Unterminated group', index: 2
      });
    });

    it('fails with format and no index on an invalid regex string', () => {
      expect(registry.check('set', 'a.pattern', 'repo', '[')).toEqual({
        ok: false, key: 'a.pattern', reason: 'format', format: 'regex', error: 'Unterminated character class'
      });
    });

    it('accepts valid regexes', () => {
      expect(registry.check('set', 'a.list', 'repo', ['^ci/', 'lint$']).ok).toBeTrue();
    });
  });

  describe('with the real registry', () => {
    let registry;

    beforeEach(() => {
      registry = new KeyRegistry();
    });

    it('refuses git.agents.foo.bar as unknown', () => {
      expect(registry.check('set', 'git.agents.foo.bar', 'repo', 'a@b').reason).toBe('unknown');
    });

    it('refuses a whole namespace as unknown', () => {
      expect(registry.check('set', 'git', 'repo', {}).reason).toBe('unknown');
    });

    it('accepts a per-agent email', () => {
      expect(registry.check('set', 'git.agents.node', 'local', 'node@x.y').ok).toBeTrue();
    });

    it('limits git.safe_branch to the local tier', () => {
      expect(registry.check('set', 'git.safe_branch', 'repo', 'origin/main').reason).toBe('tier');
    });

    it('treats version as read-only', () => {
      expect(registry.check('set', 'version', 'repo', '1.0.0').reason).toBe('read_only');
    });
  });

  describe('assertRegisteredConfigKey', () => {
    const STRICT = { ARCANUM_STRICT_CONFIG_KEYS: '1' };

    it('throws on an unregistered key when the guard is on', () => {
      expect(() => assertRegisteredConfigKey('foo.bar', STRICT)).toThrowError(
        'arcanum: config key "foo.bar" is not in core/lib/shared/config/keys.json (ARCANUM_STRICT_CONFIG_KEYS=1)'
      );
    });

    it('accepts an exactly registered key', () => {
      expect(() => assertRegisteredConfigKey('git.merge_body_mode', STRICT)).not.toThrow();
    });

    it('accepts a key matching a wildcard entry', () => {
      expect(() => assertRegisteredConfigKey('next_step.auto.enhance-issue', STRICT)).not.toThrow();
    });

    it('never throws when the guard is off', () => {
      expect(() => assertRegisteredConfigKey('foo.bar', {})).not.toThrow();
    });

    it('defaults to process.env, which the spec runner sets', () => {
      expect(process.env.ARCANUM_STRICT_CONFIG_KEYS).toBe('1');
      expect(() => assertRegisteredConfigKey('foo.bar')).toThrowError(/foo\.bar/);
    });
  });
});
