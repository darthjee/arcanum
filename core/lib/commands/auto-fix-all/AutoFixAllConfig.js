import NamespacedBooleanKeyConfig from '../../utils/config/NamespacedBooleanKeyConfig.js';

/**
 * Native equivalent of `auto-fix-all/scripts/config.sh` (`get`,
 * `is-enabled`, `set`, `toggle`) — see `NamespacedBooleanKeyConfig` for
 * the shared namespaced layout and `BooleanKeyConfig` for the shared
 * subcommand logic. Values live under `.auto-fix-all.<key>` of
 * `.claude/state/arcanum-config.json` (for
 * `clear_context`/`finish_on_empty_queue`) or
 * `.claude/configuration/arcanum-repo-config.json` (every other key).
 * The legacy `.claude/configuration/auto-fix-all.json` is never read.
 */
class AutoFixAllConfig extends NamespacedBooleanKeyConfig {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {import('../../../../shared/lib/file/Lock.js').default} [deps.lock] -
   *   the lock/mutate/release helper used to guard writes.
   * @param {import('../../../../shared/lib/config/KeyRegistry.js').default} [deps.registry] -
   *   the key registry deciding which keys read through `configChain`.
   * @param {import('../../../../shared/lib/config/ConfigChain.js').default} [deps.configChain] -
   *   the tier chain registered keys are read through.
   */
  constructor({ lock, registry, configChain } = {}) {
    super({
      namespace: 'auto-fix-all',
      stateKeys: ['clear_context', 'finish_on_empty_queue'],
      lock,
      registry,
      configChain
    });
  }
}

export default AutoFixAllConfig;
