import registryData from './keys.json' with { type: 'json' };

/** The highest registry `format_version` this module understands. */
export const FORMAT_VERSION = 1;

/** The config tiers an entry's `tiers` may list. */
export const TIERS = ['global', 'repo', 'local'];

/** The `config setup` wizard's sections, in canonical order. */
export const SETUP_SECTIONS = ['identity', 'engine', 'git', 'flow', 'ci'];

const TYPES = ['string', 'boolean', 'number', 'enum', 'array'];
const SCALAR_TYPES = ['string', 'boolean', 'number'];
const FORMATS = ['regex'];
const OPS = ['set', 'unset'];

const ENTRY_FIELDS = [
  'key', 'type', 'values', 'items', 'format', 'read_only', 'default',
  'integer', 'min', 'max', 'allow_empty', 'tiers', 'description', 'setup'
];
const SETUP_FIELDS = ['section', 'order', 'prompt', 'instances'];

const SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/;
const WILDCARD_PATTERN = /^<[A-Za-z0-9_-]+>$/;

const NULL_HINT = 'use \'config unset\' to remove it';

/**
 * Loader, matcher and validator for arcanum's config key registry,
 * `keys.json` (see docs/agents/specs/arcanum-cli/key-registry.md).
 * The registry is imported statically so `esbuild` inlines it into the
 * bundled CLI; nothing here reads the filesystem. Validation never
 * throws: `check` returns a structured result and `validateRegistry`
 * returns a list of problems, so the CLI and arcanum's own code can map
 * them to their own messages.
 */
class KeyRegistry {
  /**
   * @param {object} [data] - the parsed registry (defaults to the
   *   bundled `keys.json`), injectable for testing.
   * @throws {Error} when `data.format_version` is higher than
   *   `FORMAT_VERSION` or `data.keys` is not an array.
   */
  constructor(data = registryData) {
    if (!data || typeof data !== 'object' || !Number.isInteger(data.format_version)) {
      throw new Error('arcanum: config key registry has no valid format_version');
    }

    if (data.format_version > FORMAT_VERSION) {
      throw new Error(
        `arcanum: config key registry format_version ${data.format_version} is newer than the supported ${FORMAT_VERSION}`
      );
    }

    if (!Array.isArray(data.keys)) {
      throw new Error('arcanum: config key registry has no keys array');
    }

    this._entries = data.keys;
  }

  /**
   * @returns {object[]} every registry entry, in registry order.
   */
  entries() {
    return [...this._entries];
  }

  /**
   * Finds the registry entry matching a concrete dotted key. A fully
   * literal entry beats a wildcard one; a `<name>` segment matches
   * exactly one concrete segment, and the segment count must match.
   * @param {string} key - the concrete dotted key, e.g. `git.agents.node`.
   * @returns {object|null} the matching entry, or `null` when the key is
   *   malformed or matches no entry.
   */
  lookup(key) {
    if (typeof key !== 'string') {
      return null;
    }

    const segments = key.split('.');

    if (!segments.every((segment) => SEGMENT_PATTERN.test(segment))) {
      return null;
    }

    const literal = this._entries.find((entry) => entry.key === key);

    if (literal) {
      return literal;
    }

    return this._entries.find((entry) => matchesPattern(entry.key, segments)) || null;
  }

  /**
   * Like `lookup`, but for a key pattern that may itself contain
   * `<name>` wildcard segments (as the shell static scan builds them).
   * A wildcard segment in `pattern` only matches a wildcard segment of
   * the entry, whatever its label.
   * @param {string} pattern - the dotted key pattern, e.g.
   *   `next_step.auto.<skill>`.
   * @returns {object|null} the matching entry, or `null`.
   */
  lookupPattern(pattern) {
    if (typeof pattern !== 'string') {
      return null;
    }

    const segments = pattern.split('.');

    if (!segments.every(isValidKeySegment)) {
      return null;
    }

    if (!segments.some(isWildcard)) {
      return this.lookup(pattern);
    }

    return this._entries.find((entry) => {
      const entrySegments = entry.key.split('.');

      return entrySegments.length === segments.length && entrySegments.every((segment, index) => (
        isWildcard(segments[index]) ? isWildcard(segment) : isWildcard(segment) || segment === segments[index]
      ));
    }) || null;
  }

  /**
   * Validates a config write or removal against the registry. Checks
   * run in a fixed order and the first failure wins: `unknown`,
   * `read_only`, `tier` (where `unset` stops), then the value checks
   * `null`, `type`, `enum`, `empty`, `integer`/`min`/`max` and `format`.
   * @param {string} op - `set` or `unset`.
   * @param {string} key - the concrete dotted key.
   * @param {string} tier - `global`, `repo` or `local`.
   * @param {unknown} [value] - the parsed value (ignored for `unset`).
   * @returns {{ok: boolean, reason?: string}} `{ok: true}`, or
   *   `{ok: false, reason, ...details}`.
   * @throws {TypeError} when `op` is neither `set` nor `unset`.
   */
  check(op, key, tier, value) {
    if (!OPS.includes(op)) {
      throw new TypeError(`KeyRegistry#check: unknown op ${JSON.stringify(op)}`);
    }

    const entry = this.lookup(key);

    if (!entry) {
      return { ok: false, reason: 'unknown', key };
    }

    if (entry.read_only === true) {
      return { ok: false, reason: 'read_only', key };
    }

    if (!entry.tiers.includes(tier)) {
      return { ok: false, reason: 'tier', key, tier, allowed: [...entry.tiers] };
    }

    if (op === 'unset') {
      return { ok: true };
    }

    const failure = valueFailure(entry, value);

    return failure ? { ok: false, key, ...failure } : { ok: true };
  }
}

/**
 * Validates a parsed registry's shape and cross-entry rules: unknown
 * fields, required fields, the closed type/format vocabularies,
 * field-scope rules, defaults matching their type, `setup` sections,
 * duplicate keys, overlapping wildcards and leaf integrity.
 * @param {object} data - the parsed registry.
 * @returns {string[]} one human-readable problem per violation; empty
 *   when the registry is valid.
 */
export function validateRegistry(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return ['registry must be an object'];
  }

  const problems = [];

  for (const field of Object.keys(data)) {
    if (field !== 'format_version' && field !== 'keys') {
      problems.push(`unknown top-level field "${field}"`);
    }
  }

  if (!Number.isInteger(data.format_version) || data.format_version < 1 || data.format_version > FORMAT_VERSION) {
    problems.push(`format_version must be an integer between 1 and ${FORMAT_VERSION}`);
  }

  if (!Array.isArray(data.keys)) {
    problems.push('keys must be an array');

    return problems;
  }

  data.keys.forEach((entry, index) => {
    problems.push(...entryProblems(entry, index));
  });

  problems.push(...crossEntryProblems(data.keys));

  return problems;
}

/**
 * @param {unknown} entry - one registry entry.
 * @param {number} index - its position in `keys`.
 * @returns {string[]} the entry's own problems.
 */
function entryProblems(entry, index) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return [`keys[${index}] must be an object`];
  }

  const label = typeof entry.key === 'string' ? entry.key : `keys[${index}]`;
  const problems = [];
  const add = (message) => problems.push(`${label}: ${message}`);

  for (const field of Object.keys(entry)) {
    if (!ENTRY_FIELDS.includes(field)) {
      add(`unknown field "${field}"`);
    }
  }

  keyProblems(entry, add);
  typeProblems(entry, add);
  scopeProblems(entry, add);
  tierProblems(entry, add);

  if (typeof entry.description !== 'string' || entry.description.length === 0) {
    add('description must be a non-empty string');
  }

  if ('read_only' in entry && typeof entry.read_only !== 'boolean') {
    add('read_only must be a boolean');
  }

  if ('default' in entry && TYPES.includes(entry.type)) {
    const failure = valueFailure(entry, entry.default);

    if (failure) {
      add(`default does not match its type (${failure.reason})`);
    }
  }

  if ('setup' in entry) {
    setupProblems(entry, add);
  }

  return problems;
}

/**
 * @param {object} entry - one registry entry.
 * @param {(message: string) => void} add - records a problem.
 */
function keyProblems(entry, add) {
  if (typeof entry.key !== 'string' || entry.key.length === 0) {
    add('key must be a non-empty string');

    return;
  }

  if (!entry.key.split('.').every(isValidKeySegment)) {
    add('key segments must be [A-Za-z0-9_-]+ or a whole-segment <name> wildcard');
  }
}

/**
 * @param {object} entry - one registry entry.
 * @param {(message: string) => void} add - records a problem.
 */
function typeProblems(entry, add) {
  if (!TYPES.includes(entry.type)) {
    add(`type must be one of ${TYPES.join(', ')}`);
  }

  if (entry.type === 'enum') {
    const { values } = entry;

    if (!Array.isArray(values) || values.length === 0 || !values.every((v) => typeof v === 'string')) {
      add('enum requires values, a non-empty array of strings');
    }
  } else if ('values' in entry) {
    add('values is only allowed on enum');
  }

  if (entry.type === 'array') {
    if (!SCALAR_TYPES.includes(entry.items)) {
      add(`array requires items, one of ${SCALAR_TYPES.join(', ')}`);
    }
  } else if ('items' in entry) {
    add('items is only allowed on array');
  }

  if ('format' in entry) {
    if (!FORMATS.includes(entry.format)) {
      add(`format must be one of ${FORMATS.join(', ')}`);
    }

    if (entry.type !== 'string' && !(entry.type === 'array' && entry.items === 'string')) {
      add('format is only allowed on string or array of string');
    }
  }
}

/**
 * Field-scope rules: number constraints only on `number`, `allow_empty`
 * only on `string`/`enum`.
 * @param {object} entry - one registry entry.
 * @param {(message: string) => void} add - records a problem.
 */
function scopeProblems(entry, add) {
  for (const field of ['integer', 'min', 'max']) {
    if (field in entry && entry.type !== 'number') {
      add(`${field} is only allowed on number`);
    }
  }

  if ('integer' in entry && typeof entry.integer !== 'boolean') {
    add('integer must be a boolean');
  }

  for (const field of ['min', 'max']) {
    if (field in entry && !Number.isFinite(entry[field])) {
      add(`${field} must be a finite number`);
    }
  }

  if (Number.isFinite(entry.min) && Number.isFinite(entry.max) && entry.min > entry.max) {
    add('min must not exceed max');
  }

  if ('allow_empty' in entry) {
    if (entry.type !== 'string' && entry.type !== 'enum') {
      add('allow_empty is only allowed on string or enum');
    }

    if (typeof entry.allow_empty !== 'boolean') {
      add('allow_empty must be a boolean');
    }
  }
}

/**
 * @param {object} entry - one registry entry.
 * @param {(message: string) => void} add - records a problem.
 */
function tierProblems(entry, add) {
  const { tiers } = entry;

  if (!Array.isArray(tiers) || tiers.length === 0) {
    add(`tiers must be a non-empty subset of ${TIERS.join(', ')}`);

    return;
  }

  if (!tiers.every((tier) => TIERS.includes(tier))) {
    add(`tiers must only contain ${TIERS.join(', ')}`);
  }

  if (new Set(tiers).size !== tiers.length) {
    add('tiers must not repeat a tier');
  }
}

/**
 * @param {object} entry - one registry entry carrying `setup`.
 * @param {(message: string) => void} add - records a problem.
 */
function setupProblems(entry, add) {
  const { setup } = entry;

  if (!setup || typeof setup !== 'object' || Array.isArray(setup)) {
    add('setup must be an object');

    return;
  }

  for (const field of Object.keys(setup)) {
    if (!SETUP_FIELDS.includes(field)) {
      add(`unknown setup field "${field}"`);
    }
  }

  if (!SETUP_SECTIONS.includes(setup.section)) {
    add(`setup.section must be one of ${SETUP_SECTIONS.join(', ')}`);
  }

  if (!Number.isInteger(setup.order)) {
    add('setup.order must be an integer');
  }

  if (typeof setup.prompt !== 'string' || setup.prompt.length === 0) {
    add('setup.prompt must be a non-empty string');
  }

  if ('instances' in setup) {
    const { instances } = setup;
    const isWildcardKey = typeof entry.key === 'string' && entry.key.split('.').some(isWildcard);

    if (!isWildcardKey) {
      add('setup.instances is only allowed on a wildcard key');
    }

    if (!Array.isArray(instances) || instances.length === 0 ||
      !instances.every((name) => typeof name === 'string' && SEGMENT_PATTERN.test(name))) {
      add('setup.instances must be a non-empty array of [A-Za-z0-9_-]+ names');
    }
  }
}

/**
 * Cross-entry rules: duplicate keys, overlapping wildcard entries and
 * leaf integrity (no entry key is a prefix of another's).
 * @param {Array} entries - the registry's `keys`.
 * @returns {string[]} the problems found.
 */
function crossEntryProblems(entries) {
  const keys = entries
    .filter((entry) => entry && typeof entry.key === 'string' && entry.key.length > 0)
    .map((entry) => entry.key);
  const problems = [];
  const seen = new Set();

  for (const key of keys) {
    if (seen.has(key)) {
      problems.push(`${key}: duplicate key`);
    }

    seen.add(key);
  }

  const unique = [...seen].map((key) => ({ key, segments: key.split('.') }));

  unique.forEach((a, i) => {
    unique.slice(i + 1).forEach((b) => {
      const bothWildcard = a.segments.some(isWildcard) && b.segments.some(isWildcard);

      if (bothWildcard && a.segments.length === b.segments.length && segmentsCompatible(a.segments, b.segments)) {
        problems.push(`${a.key}: overlaps wildcard entry ${b.key}`);
      }

      const [shorter, longer] = a.segments.length <= b.segments.length ? [a, b] : [b, a];

      if (shorter.segments.length < longer.segments.length &&
        segmentsCompatible(shorter.segments, longer.segments.slice(0, shorter.segments.length))) {
        problems.push(`${shorter.key}: is a prefix of ${longer.key}, every key must be a leaf`);
      }
    });
  });

  return problems;
}

/**
 * Runs the value checks of `check` (everything after the tier check)
 * against one value; also used to validate an entry's `default`.
 * @param {object} entry - the registry entry.
 * @param {unknown} value - the value to check.
 * @returns {object|null} the failure details (with `reason`), or `null`.
 */
function valueFailure(entry, value) {
  const expected = expectedLabel(entry);

  if (value === null) {
    return { reason: 'null', expected, got: 'null', hint: NULL_HINT };
  }

  const typeFailure = typeMismatch(entry, value, expected);

  if (typeFailure) {
    return typeFailure;
  }

  if (entry.type === 'enum' && !entry.values.includes(value)) {
    return { reason: 'enum', values: [...entry.values], got: value };
  }

  if ((entry.type === 'string' || entry.type === 'enum') && value === '' && entry.allow_empty !== true) {
    return { reason: 'empty' };
  }

  if (entry.type === 'number') {
    const rangeFailure = numberFailure(entry, value);

    if (rangeFailure) {
      return rangeFailure;
    }
  }

  return entry.format === 'regex' ? regexFailure(value) : null;
}

/**
 * @param {object} entry - the registry entry.
 * @param {unknown} value - a non-null value.
 * @param {string} expected - the entry's expected-type label.
 * @returns {object|null} a `type` failure, or `null`.
 */
function typeMismatch(entry, value, expected) {
  if (entry.type === 'array') {
    if (!Array.isArray(value)) {
      return { reason: 'type', expected, got: typeLabel(value) };
    }

    const index = value.findIndex((element) => !isScalarOfType(element, entry.items));

    return index === -1 ? null : { reason: 'type', expected, got: typeLabel(value[index]), index };
  }

  const scalarType = entry.type === 'enum' ? 'string' : entry.type;

  return isScalarOfType(value, scalarType) ? null : { reason: 'type', expected, got: typeLabel(value) };
}

/**
 * @param {object} entry - a `number` registry entry.
 * @param {number} value - a finite number.
 * @returns {object|null} an `integer`/`min`/`max` failure, or `null`.
 */
function numberFailure(entry, value) {
  if (entry.integer === true && !Number.isInteger(value)) {
    return { reason: 'integer', got: value };
  }

  if (Number.isFinite(entry.min) && value < entry.min) {
    return { reason: 'min', min: entry.min, got: value };
  }

  if (Number.isFinite(entry.max) && value > entry.max) {
    return { reason: 'max', max: entry.max, got: value };
  }

  return null;
}

/**
 * Compiles each pattern with `new RegExp(p, 'i')`, only to validate it.
 * @param {string|string[]} value - one pattern or an array of patterns.
 * @returns {object|null} a `format` failure naming the element index
 *   (for an array) and the compile error, or `null`.
 */
function regexFailure(value) {
  const patterns = Array.isArray(value) ? value : [value];

  for (const [index, pattern] of patterns.entries()) {
    try {
      new RegExp(pattern, 'i');
    } catch (error) {
      const failure = { reason: 'format', format: 'regex', error: compileMessage(error) };

      return Array.isArray(value) ? { ...failure, index } : failure;
    }
  }

  return null;
}

/**
 * @param {Error} error - a `RegExp` compile error.
 * @returns {string} its reason, without V8's `Invalid regular expression: /.../i: ` prefix.
 */
function compileMessage(error) {
  const match = /: \/.*\/[a-z]*: (.*)$/s.exec(error.message);

  return match ? match[1] : error.message;
}

/**
 * @param {unknown} value - the value.
 * @param {string} type - `string`, `boolean` or `number`.
 * @returns {boolean} whether `value` is a scalar of `type` (numbers must be finite).
 */
function isScalarOfType(value, type) {
  if (type === 'number') {
    return typeof value === 'number' && Number.isFinite(value);
  }

  return typeof value === type;
}

/**
 * @param {object} entry - the registry entry.
 * @returns {string} its expected type, e.g. `string`, `array of string`.
 */
function expectedLabel(entry) {
  if (entry.type === 'array') {
    return `array of ${entry.items}`;
  }

  return entry.type;
}

/**
 * @param {unknown} value - any parsed JSON value.
 * @returns {string} its JSON type name.
 */
function typeLabel(value) {
  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return 'array';
  }

  return typeof value;
}

/**
 * @param {string} segment - a key segment.
 * @returns {boolean} whether it is a `<name>` wildcard.
 */
function isWildcard(segment) {
  return WILDCARD_PATTERN.test(segment);
}

/**
 * @param {string} segment - a registry key segment.
 * @returns {boolean} whether it is a concrete segment or a wildcard.
 */
function isValidKeySegment(segment) {
  return SEGMENT_PATTERN.test(segment) || isWildcard(segment);
}

/**
 * @param {string} pattern - a registry entry key.
 * @param {string[]} segments - a concrete key's segments.
 * @returns {boolean} whether the entry key matches them.
 */
function matchesPattern(pattern, segments) {
  const patternSegments = pattern.split('.');

  return patternSegments.length === segments.length &&
    patternSegments.every((segment, index) => isWildcard(segment) || segment === segments[index]);
}

/**
 * @param {string[]} a - one key's segments.
 * @param {string[]} b - another key's segments, of the same length.
 * @returns {boolean} whether some concrete key could match both.
 */
function segmentsCompatible(a, b) {
  return a.every((segment, index) => isWildcard(segment) || isWildcard(b[index]) || segment === b[index]);
}

export default KeyRegistry;
