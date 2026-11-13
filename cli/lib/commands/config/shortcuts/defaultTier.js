// The default write tier of a key, for the shortcuts and the `config
// setup` wizard. The decision lives only in `keys.json` (each entry's
// optional `default_tier`, else the shared rule in
// `KeyRegistry#defaultTier`), so changing a key's tiers or default never
// needs a CLI change (see
// docs/agents/architecture/arcanum-cli.md#per-setting-flow).

import KeyRegistry from '../../../../../shared/lib/config/KeyRegistry.js';

const bundledRegistry = new KeyRegistry();

/**
 * @param {string} key - a concrete key (`next_step.auto.enhance-issue`)
 *   or a registry key pattern (`git.agents.<agent>`).
 * @param {object} [registry] - the key registry (default, or when
 *   `null`: the bundled one).
 * @returns {(string|null)} the key's default write tier: its
 *   `default_tier`, else its only tier, else `local` when allowed, else
 *   its first tier; `null` for a key the registry does not know.
 */
export function defaultTier(key, registry) {
  return (registry || bundledRegistry).defaultTier(key);
}
