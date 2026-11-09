import ConfigChain from '../../../../shared/lib/config/ConfigChain.js';

const USAGE = 'Usage: /arcanum-check-config <namespace.key[.sub...]>';
const IGNORED = 'tier not allowed';

/**
 * Native-only implementation of `/arcanum-check-config`: reports what
 * each arcanum config tier (local state, repo config, global config)
 * holds for a dotted key, plus the final resolved value and the tier
 * it came from. A tier the key's `keys.json` entry does not allow is
 * still reported, but marked `allowed: false` /
 * `ignored: 'tier not allowed'` and never chosen as the final value.
 * There is no shell counterpart: this command is reached
 * through `engine_dispatch --native-only` (see
 * `docs/agents/architecture/script-engine.md`).
 */
class ArcanumCheckConfig {
  /**
   * @param {import('../../context/RepoContext.js').default} repoContext -
   *   the target repo's context (provides `repoPath`).
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {ConfigChain} [deps.configChain] - the config chain to read
   *   tiers from (defaults to one bound to `repoContext`, resolving the
   *   global tier from `process.env`).
   */
  constructor(repoContext, { configChain = new ConfigChain({ repoContext }) } = {}) {
    this._repoContext = repoContext;
    this._configChain = configChain;
  }

  /**
   * Resolves `key` across every config tier and renders the result as
   * pretty-printed JSON (`key`, `local`, `repo`, `global`, `final`, in
   * that order). Every tier is reported, including shadowed ones and
   * ones the key's `keys.json` entry does not allow — those gain
   * `allowed: false` and `ignored: 'tier not allowed'` (allowed tiers
   * and unregistered keys get no extra fields). `final` comes from the
   * first allowed tier holding a present, non-null value, or is
   * `{ value: null, source: null }` when no tier does.
   * @param {string} key - dotted path `namespace.key[.sub...]` (at least
   *   two non-empty segments).
   * @returns {Promise<string>} the JSON report, newline-terminated.
   * @throws {Error} when `key` is missing/empty or malformed.
   */
  async run(key) {
    const { namespace, nestedKey } = this._parseKey(key);
    const tiers = await this._configChain.readTiers(this._repoContext.repoPath, namespace, nestedKey);
    const result = { key };

    for (const { tier, file, set, value, allowed } of tiers) {
      const entry = set ? { file, set, value } : { file, set };

      result[tier] = allowed === false ? { ...entry, allowed, ignored: IGNORED } : entry;
    }

    const winner = tiers.find((tier) => tier.set && tier.allowed !== false);

    result.final = winner ? { value: winner.value, source: winner.tier } : { value: null, source: null };

    return `${JSON.stringify(result, null, 2)}\n`;
  }

  /**
   * @param {string} key - the raw key argument.
   * @returns {{namespace: string, nestedKey: string}} the first segment
   *   and the remaining segments joined back with `.`.
   * @throws {Error} when `key` is missing/empty or malformed.
   */
  _parseKey(key) {
    if (!key) {
      throw new Error(USAGE);
    }

    const segments = key.split('.');

    if (segments.length < 2 || segments.some((segment) => segment === '')) {
      throw new Error(`invalid key '${key}': expected <namespace.key[.sub...]>`);
    }

    const [namespace, ...rest] = segments;

    return { namespace, nestedKey: rest.join('.') };
  }
}

export default ArcanumCheckConfig;
