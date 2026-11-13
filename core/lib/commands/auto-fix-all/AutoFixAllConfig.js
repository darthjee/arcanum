import NamespacedBooleanKeyConfig from '../../utils/config/NamespacedBooleanKeyConfig.js';

/**
 * Native equivalent of `auto-fix-all/scripts/config.sh` (`get`,
 * `is-enabled`, `set`, `toggle`) — see `NamespacedBooleanKeyConfig` for
 * the shared namespaced layout and `BooleanKeyConfig` for the shared
 * subcommand logic. Values live under `.auto-fix-all.<key>` of the
 * file of the key's default tier in `keys.json` (e.g.
 * `.claude/state/arcanum-config.json` for the local-tier
 * `clear_context`/`finish_on_empty_queue`), or of
 * `.claude/configuration/arcanum-repo-config.json` for a key the
 * registry doesn't know.
 * The legacy `.claude/configuration/auto-fix-all.json` is never read.
 */
class AutoFixAllConfig extends NamespacedBooleanKeyConfig {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {import('../../../../shared/lib/file/Lock.js').default} [deps.lock] -
   *   the lock/mutate/release helper used to guard writes.
   * @param {import('../../../../shared/lib/config/KeyRegistry.js').default} [deps.registry] -
   *   the key registry deciding which keys read through `configChain`
   *   and which tier each key is written to.
   * @param {import('../../../../shared/lib/config/ConfigChain.js').default} [deps.configChain] -
   *   the tier chain registered keys are read through.
   */
  constructor({ lock, registry, configChain } = {}) {
    super({
      namespace: 'auto-fix-all',
      lock,
      registry,
      configChain
    });
  }
}

export default AutoFixAllConfig;
