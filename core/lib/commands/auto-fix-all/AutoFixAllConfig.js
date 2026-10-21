import NamespacedBooleanKeyConfig from '../../utils/config/NamespacedBooleanKeyConfig.js';

/**
 * Native equivalent of `auto-fix-all/scripts/config.sh` (`get`,
 * `is-enabled`, `set`, `toggle`) — see `NamespacedBooleanKeyConfig` for
 * the shared namespaced layout and `BooleanKeyConfig` for the shared
 * subcommand logic. Values live under `.auto-fix-all.<key>` of
 * `.claude/state/arcanum-config.json` (for
 * `clear_context`/`finish_on_empty_queue`) or
 * `.claude/configuration/arcanum-repo-config.json` (every other key,
 * with a read fallback to — and a write-time seed from — the legacy
 * `.claude/configuration/auto-fix-all.json`).
 */
class AutoFixAllConfig extends NamespacedBooleanKeyConfig {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {import('../../utils/file/Lock.js').default} [deps.lock] -
   *   the lock/mutate/release helper used to guard writes.
   */
  constructor({ lock } = {}) {
    super({
      namespace: 'auto-fix-all',
      stateKeys: ['clear_context', 'finish_on_empty_queue'],
      legacyFileName: 'auto-fix-all.json',
      lock
    });
  }
}

export default AutoFixAllConfig;
