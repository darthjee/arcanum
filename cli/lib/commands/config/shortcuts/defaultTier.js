// The default write tier of each key a shortcut covers, in one place, so
// the shortcuts and the `config setup` wizard cannot drift apart (see
// docs/agents/architecture/arcanum-cli.md#per-setting-flow).

import KeyRegistry from '../../../../../shared/lib/config/KeyRegistry.js';
import { AGENTS_PATTERN, DEFAULT_TIER as AGENTS_EMAIL_TIER, EMAIL_KEY } from './agentsEmail.js';
import { KEY as IGNORE_CHECKS_KEY, TIER as IGNORE_CHECKS_TIER } from './ignoreChecks.js';
import { DEFAULT_TIER as NEXT_STEP_TIER, PREFIX as NEXT_STEP_PREFIX } from './nextStep.js';
import { SINGLE_VALUE } from './singleValue.js';

/** Registry key (pattern) → the default write tier of its shortcut. */
export const DEFAULT_TIERS = {
  ...Object.fromEntries(Object.values(SINGLE_VALUE).map(({ key, tier }) => [key, tier])),
  [EMAIL_KEY]: AGENTS_EMAIL_TIER,
  [AGENTS_PATTERN]: AGENTS_EMAIL_TIER,
  [`${NEXT_STEP_PREFIX}.<skill>`]: NEXT_STEP_TIER,
  [IGNORE_CHECKS_KEY]: IGNORE_CHECKS_TIER
};

const defaultRegistry = new KeyRegistry();

/**
 * @param {string} key - a concrete key (`next_step.auto.enhance-issue`)
 *   or a registry key pattern (`git.agents.<agent>`).
 * @param {object} [registry] - the key registry.
 * @returns {(string|null)} the key's default write tier: its only tier,
 *   else its shortcut's, else `local` when allowed, else its first tier;
 *   `null` for a key the registry does not know.
 */
export function defaultTier(key, registry = defaultRegistry) {
  const entry = registry.lookupPattern(key);

  if (entry === null) {
    return null;
  }

  if (entry.tiers.length === 1) {
    return entry.tiers[0];
  }

  if (Object.hasOwn(DEFAULT_TIERS, entry.key) && entry.tiers.includes(DEFAULT_TIERS[entry.key])) {
    return DEFAULT_TIERS[entry.key];
  }

  return entry.tiers.includes('local') ? 'local' : entry.tiers[0];
}
