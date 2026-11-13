import KeyRegistry from '../../../shared/lib/config/KeyRegistry.js';

/**
 * A key registry identical to the bundled one, except for the given
 * entries' fields, so a spec can check that the CLI follows `keys.json`
 * (e.g. a changed `tiers` or `default_tier`) with no CLI change.
 * @param {object} overrides - registry key (pattern) → the fields to
 *   replace in its entry (a field set to `undefined` is removed).
 * @returns {KeyRegistry} the stub registry.
 */
export function registryWith(overrides) {
  const keys = new KeyRegistry().entries().map((entry) => {
    if (!Object.hasOwn(overrides, entry.key)) {
      return entry;
    }

    const merged = { ...entry, ...overrides[entry.key] };

    return Object.fromEntries(Object.entries(merged).filter(([, value]) => value !== undefined));
  });

  return new KeyRegistry({ format_version: 1, keys });
}
