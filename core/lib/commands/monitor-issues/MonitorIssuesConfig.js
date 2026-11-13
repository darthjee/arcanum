import NamespacedBooleanKeyConfig from '../../utils/config/NamespacedBooleanKeyConfig.js';

/**
 * Native equivalent of `monitor-issues/scripts/config_<subcommand>_shell.sh`
 * (`get`, `is-enabled`, `set`, `toggle`) — see
 * `NamespacedBooleanKeyConfig` for the shared namespaced layout and
 * `BooleanKeyConfig` for the shared subcommand logic. Values live under
 * `.monitor-issues.<key>` of the file of the key's default tier in
 * `keys.json` (e.g. `.claude/state/arcanum-config.json` for the
 * local-tier `clear_context`), or of
 * `.claude/configuration/arcanum-repo-config.json` for a key the
 * registry doesn't know.
 * The legacy `.claude/configuration/monitor-issues.json` is never read.
 * `repoPath` is the shim's `$PWD` (prepended via `--prepend-repo-path`), since
 * `config.sh` resolves its files relative to the cwd.
 */
class MonitorIssuesConfig extends NamespacedBooleanKeyConfig {
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
      namespace: 'monitor-issues',
      lock,
      registry,
      configChain
    });
  }
}

export default MonitorIssuesConfig;
