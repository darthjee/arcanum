import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import keys from '../../lib/config/keys.json' with { type: 'json' };
import { SETUP_SECTIONS, validateRegistry } from '../../lib/config/KeyRegistry.js';

const KEYS_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../lib/config/keys.json');
const ALL = ['global', 'repo', 'local'];

describe('keys.json', () => {
  function entry(overrides = {}) {
    return { key: 'a.b', type: 'string', tiers: ALL, description: 'd', ...overrides };
  }

  function problemsFor(...entries) {
    return validateRegistry({ format_version: 1, keys: entries });
  }

  describe('the real registry', () => {
    it('passes the registry validator', () => {
      expect(validateRegistry(keys)).toEqual([]);
    });

    it('has no duplicate key in the raw file', async () => {
      const raw = JSON.parse(await readFile(KEYS_FILE, 'utf8'));
      const names = raw.keys.map((item) => item.key);

      expect(new Set(names).size).toBe(names.length);
    });

    it('carries setup exactly on the wizard keys, in wizard order', () => {
      const setupKeys = keys.keys
        .filter((item) => item.setup)
        .sort((a, b) => (
          SETUP_SECTIONS.indexOf(a.setup.section) - SETUP_SECTIONS.indexOf(b.setup.section) ||
          a.setup.order - b.setup.order
        ))
        .map((item) => item.key);

      expect(setupKeys).toEqual([
        'git.email',
        'git.agents.<agent>',
        'engine.mode',
        'git.safe_branch',
        'git.merge_body_mode',
        'next_step.auto.<skill>',
        'auto-fix-all.ignored_check_patterns'
      ]);
    });

    it('lists the flow wizard instances', () => {
      const flow = keys.keys.find((item) => item.key === 'next_step.auto.<skill>');

      expect(flow.setup.instances).toEqual(['enhance-issue', 'discuss-issue', 'auto-plan-issue']);
    });

    it('takes git.agents.<agent> instances from the repo, not the registry', () => {
      const agents = keys.keys.find((item) => item.key === 'git.agents.<agent>');

      expect(agents.setup.instances).toBeUndefined();
    });
  });

  describe('validateRegistry', () => {
    it('accepts a minimal valid registry', () => {
      expect(problemsFor(entry())).toEqual([]);
    });

    it('rejects a non-object registry', () => {
      expect(validateRegistry([])).toEqual(['registry must be an object']);
    });

    it('rejects an unknown top-level field', () => {
      expect(validateRegistry({ format_version: 1, keys: [], extra: 1 })).toContain('unknown top-level field "extra"');
    });

    it('rejects a format_version higher than 1', () => {
      expect(validateRegistry({ format_version: 2, keys: [] })).toContain('format_version must be an integer between 1 and 1');
    });

    it('rejects a keys field that is not an array', () => {
      expect(validateRegistry({ format_version: 1, keys: {} })).toContain('keys must be an array');
    });

    it('rejects a non-object entry', () => {
      expect(problemsFor('a.b')).toEqual(['keys[0] must be an object']);
    });

    it('rejects an unknown entry field', () => {
      expect(problemsFor(entry({ teirs: ALL }))).toContain('a.b: unknown field "teirs"');
    });

    it('rejects a missing key', () => {
      const keyless = entry();

      delete keyless.key;

      expect(problemsFor(keyless)).toContain('keys[0]: key must be a non-empty string');
    });

    it('rejects a key with a partial wildcard segment', () => {
      expect(problemsFor(entry({ key: 'a.foo_<x>' }))).toContain(
        'a.foo_<x>: key segments must be [A-Za-z0-9_-]+ or a whole-segment <name> wildcard'
      );
    });

    it('rejects a missing description', () => {
      expect(problemsFor(entry({ description: '' }))).toContain('a.b: description must be a non-empty string');
    });

    it('rejects a non-boolean read_only', () => {
      expect(problemsFor(entry({ read_only: 'yes' }))).toContain('a.b: read_only must be a boolean');
    });

    it('rejects a duplicate key', () => {
      expect(problemsFor(entry(), entry())).toContain('a.b: duplicate key');
    });

    it('rejects overlapping wildcard entries', () => {
      expect(problemsFor(entry({ key: 'a.<x>.c' }), entry({ key: 'a.b.<y>' }))).toContain(
        'a.<x>.c: overlaps wildcard entry a.b.<y>'
      );
    });

    it('allows a literal entry overlapping a wildcard entry', () => {
      expect(problemsFor(entry({ key: 'a.<x>' }), entry({ key: 'a.b' }))).toEqual([]);
    });

    it('allows wildcard entries that cannot match the same key', () => {
      expect(problemsFor(entry({ key: 'a.auto.<x>' }), entry({ key: 'a.clear.<x>' }))).toEqual([]);
    });

    it('rejects an entry that is a prefix of another', () => {
      expect(problemsFor(entry({ key: 'git.agents' }), entry({ key: 'git.agents.<agent>' }))).toContain(
        'git.agents: is a prefix of git.agents.<agent>, every key must be a leaf'
      );
    });

    it('rejects a prefix whatever the entry order', () => {
      expect(problemsFor(entry({ key: 'git.agents.<agent>' }), entry({ key: 'git.agents' }))).toContain(
        'git.agents: is a prefix of git.agents.<agent>, every key must be a leaf'
      );
    });

    it('rejects a default that does not match its type', () => {
      expect(problemsFor(entry({ type: 'boolean', default: 'false' }))).toContain(
        'a.b: default does not match its type (type)'
      );
    });

    it('rejects a default outside the number constraints', () => {
      expect(problemsFor(entry({ type: 'number', min: 0, default: -1 }))).toContain(
        'a.b: default does not match its type (min)'
      );
    });

    it('rejects a null default', () => {
      expect(problemsFor(entry({ default: null }))).toContain('a.b: default does not match its type (null)');
    });

    it('rejects an unknown type', () => {
      expect(problemsFor(entry({ type: 'object' }))).toContain(
        'a.b: type must be one of string, boolean, number, enum, array'
      );
    });

    for (const field of ['integer', 'min', 'max']) {
      it(`rejects ${field} on a non-number`, () => {
        expect(problemsFor(entry({ [field]: field === 'integer' ? true : 1 }))).toContain(
          `a.b: ${field} is only allowed on number`
        );
      });
    }

    it('rejects a non-boolean integer', () => {
      expect(problemsFor(entry({ type: 'number', integer: 1 }))).toContain('a.b: integer must be a boolean');
    });

    it('rejects a non-numeric min', () => {
      expect(problemsFor(entry({ type: 'number', min: '0' }))).toContain('a.b: min must be a finite number');
    });

    it('rejects min above max', () => {
      expect(problemsFor(entry({ type: 'number', min: 5, max: 1 }))).toContain('a.b: min must not exceed max');
    });

    it('rejects allow_empty outside string and enum', () => {
      expect(problemsFor(entry({ type: 'boolean', allow_empty: true }))).toContain(
        'a.b: allow_empty is only allowed on string or enum'
      );
    });

    it('rejects a non-boolean allow_empty', () => {
      expect(problemsFor(entry({ allow_empty: 'yes' }))).toContain('a.b: allow_empty must be a boolean');
    });

    it('rejects an unknown format', () => {
      expect(problemsFor(entry({ format: 'email' }))).toContain('a.b: format must be one of regex');
    });

    it('rejects a format on a non-string type', () => {
      expect(problemsFor(entry({ type: 'boolean', format: 'regex' }))).toContain(
        'a.b: format is only allowed on string or array of string'
      );
    });

    it('rejects an enum without values', () => {
      expect(problemsFor(entry({ type: 'enum' }))).toContain('a.b: enum requires values, a non-empty array of strings');
    });

    it('rejects values outside enum', () => {
      expect(problemsFor(entry({ values: ['x'] }))).toContain('a.b: values is only allowed on enum');
    });

    it('rejects an array without a scalar items', () => {
      expect(problemsFor(entry({ type: 'array', items: 'array' }))).toContain(
        'a.b: array requires items, one of string, boolean, number'
      );
    });

    it('rejects items outside array', () => {
      expect(problemsFor(entry({ items: 'string' }))).toContain('a.b: items is only allowed on array');
    });

    it('rejects empty tiers', () => {
      expect(problemsFor(entry({ tiers: [] }))).toContain('a.b: tiers must be a non-empty subset of global, repo, local');
    });

    it('rejects an unknown tier', () => {
      expect(problemsFor(entry({ tiers: ['user'] }))).toContain('a.b: tiers must only contain global, repo, local');
    });

    it('rejects a repeated tier', () => {
      expect(problemsFor(entry({ tiers: ['repo', 'repo'] }))).toContain('a.b: tiers must not repeat a tier');
    });

    describe('setup', () => {
      function setupEntry(setup, overrides = {}) {
        return entry({ setup, ...overrides });
      }

      it('accepts a valid setup', () => {
        expect(problemsFor(setupEntry({ section: 'git', order: 1, prompt: 'p' }))).toEqual([]);
      });

      it('rejects a non-object setup', () => {
        expect(problemsFor(setupEntry('git'))).toContain('a.b: setup must be an object');
      });

      it('rejects a section outside the canonical set', () => {
        expect(problemsFor(setupEntry({ section: 'misc', order: 1, prompt: 'p' }))).toContain(
          'a.b: setup.section must be one of identity, engine, git, flow, ci'
        );
      });

      it('rejects an unknown setup field', () => {
        expect(problemsFor(setupEntry({ section: 'git', order: 1, prompt: 'p', label: 'x' }))).toContain(
          'a.b: unknown setup field "label"'
        );
      });

      it('rejects a non-integer order', () => {
        expect(problemsFor(setupEntry({ section: 'git', order: '1', prompt: 'p' }))).toContain(
          'a.b: setup.order must be an integer'
        );
      });

      it('rejects a missing prompt', () => {
        expect(problemsFor(setupEntry({ section: 'git', order: 1 }))).toContain(
          'a.b: setup.prompt must be a non-empty string'
        );
      });

      it('rejects instances on a literal key', () => {
        expect(problemsFor(setupEntry({ section: 'flow', order: 1, prompt: 'p', instances: ['x'] }))).toContain(
          'a.b: setup.instances is only allowed on a wildcard key'
        );
      });

      it('rejects malformed instances', () => {
        expect(problemsFor(setupEntry(
          { section: 'flow', order: 1, prompt: 'p', instances: ['a.b'] },
          { key: 'a.<x>' }
        ))).toContain('a.<x>: setup.instances must be a non-empty array of [A-Za-z0-9_-]+ names');
      });
    });
  });
});
