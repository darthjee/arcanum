import NamespacedBooleanKeyConfig from '../../utils/config/NamespacedBooleanKeyConfig.js';

/**
 * Native equivalent of `monitor-issues/scripts/config_<subcommand>_shell.sh`
 * (`get`, `is-enabled`, `set`, `toggle`) — see
 * `NamespacedBooleanKeyConfig` for the shared namespaced layout and
 * `BooleanKeyConfig` for the shared subcommand logic. Values live under
 * `.monitor-issues.<key>` of `.claude/state/arcanum-config.json` (for
 * `clear_context`, personal state, with no legacy fallback) or
 * `.claude/configuration/arcanum-repo-config.json` (every other key,
 * with a read fallback to — and a write-time seed from — the legacy
 * `.claude/configuration/monitor-issues.json`). `repoPath` is the
 * shim's `$PWD` (prepended via `--prepend-repo-path`), since
 * `config.sh` resolves its files relative to the cwd.
 */
class MonitorIssuesConfig extends NamespacedBooleanKeyConfig {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {import('../../utils/file/Lock.js').default} [deps.lock] -
   *   the lock/mutate/release helper used to guard writes.
   */
  constructor({ lock } = {}) {
    super({
      namespace: 'monitor-issues',
      stateKeys: ['clear_context'],
      legacyFileName: 'monitor-issues.json',
      lock
    });
  }
}

export default MonitorIssuesConfig;
