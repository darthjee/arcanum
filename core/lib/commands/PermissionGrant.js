import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import Lock from '../utils/file/Lock.js';

const USAGE_MESSAGE = 'Usage: permission_grant.sh add <file> <pattern>';

/**
 * Native equivalent of `arcanum/_lib/permission_grant_shell.sh`'s CLI
 * dispatcher (`permission_grant.sh add <file> <pattern>`): appends a
 * Bash-permission allowlist pattern into a Claude Code native settings
 * file's top-level `.permissions.allow` array. Only the CLI path is in
 * scope here — the sourced `permission_grant_add` function used
 * in-process by scripts under `arcanum/migrations/repos` stays pure shell (see
 * docs/agents/plans/236-migrate-permission-grant-entrypoint-to-native-node-js/plan.md).
 *
 * The CLI path is a `context: 'claude'` command: `Dispatcher` strips the
 * leading `<anchor>` argument, builds a `ClaudeContext` from it and injects
 * it here, so a repo-relative `<file>` resolves against the anchor rather
 * than the ambient `process.cwd()`.
 */
class PermissionGrant {
  /**
   * @param {import('../context/ClaudeContext.js').default} claudeContext -
   *   the context anchoring `<file>` resolution, injected by `Dispatcher`
   *   from the leading `<anchor>` CLI argument.
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Lock} [deps.lock] - the lock/mutate/release helper.
   */
  constructor(claudeContext, { lock = new Lock() } = {}) {
    this._claudeContext = claudeContext;
    this._lock = lock;
  }

  /**
   * Native implementation of the `permission-grant` migrated
   * entrypoint. `action !== 'add'` (including a missing action) throws
   * the shell dispatcher's usage message, mirroring its exit-1 case —
   * the caller (`core/bin/arcanum`) prints it to stderr and exits 1.
   * @param {string} action - the requested action (only `add` is
   *   supported).
   * @param {string} file - the target settings file's path.
   * @param {string} pattern - the Bash-permission pattern to allow.
   * @returns {Promise<void>} resolves once the pattern has been
   *   written (or the parent-directory-creation failure has been
   *   silently degraded, per `#add`).
   */
  async run(action, file, pattern) {
    if (action !== 'add') {
      throw new Error(USAGE_MESSAGE);
    }

    await this.add(file, pattern);
  }

  /**
   * Appends `pattern` to `file`'s top-level `.permissions.allow`
   * array, creating the file (starting from `{}`) and/or the array as
   * needed, deduping against whatever is already there, without
   * disturbing any other content already in `file` (e.g.
   * `.permissions.deny`, hooks, or any other top-level key).
   * Lock-protected (`core/lib/utils/file/Lock.js`), atomic write (`.tmp` file +
   * rename).
   *
   * Degrades silently (stderr warning, no-op, still resolves/exits 0)
   * if the target's parent directory can't be created — same failure
   * posture as the shell version.
   * @param {string} file - the target settings file's path; absolute
   *   paths pass through unchanged, repo-relative ones resolve against
   *   the injected `ClaudeContext`'s anchor.
   * @param {string} pattern - the Bash-permission pattern to allow.
   * @returns {Promise<void>} resolves once the write (or the silent
   *   degrade) has completed.
   */
  async add(file, pattern) {
    const target = this._claudeContext.resolve(file);

    try {
      await mkdir(path.dirname(target), { recursive: true });
    } catch {
      process.stderr.write(
        `Warning: could not create the parent directory for ${target} — permission pattern '${pattern}' was not written.\n`
      );

      return;
    }

    const lockFile = `${target}.lock`;

    await this._lock.acquire(lockFile);

    try {
      await this._merge(target, pattern);
    } finally {
      await this._lock.release(lockFile);
    }
  }

  /**
   * Read-merge-write step, run while the lock is held.
   * @param {string} file - the target settings file's path.
   * @param {string} pattern - the Bash-permission pattern to allow.
   * @returns {Promise<void>} resolves once the merged content has been
   *   written atomically.
   */
  async _merge(file, pattern) {
    const base = await this._read(file);
    const existingAllow = Array.isArray(base?.permissions?.allow) ? base.permissions.allow : [];
    const allow = [...new Set([...existingAllow, pattern])].sort();

    const updated = {
      ...base,
      permissions: {
        ...base?.permissions,
        allow
      }
    };

    const tmpFile = `${file}.tmp`;

    await writeFile(tmpFile, `${JSON.stringify(updated, null, 2)}\n`);
    await rename(tmpFile, file);
  }

  /**
   * @param {string} file - the settings file's path.
   * @returns {Promise<object>} the parsed JSON content, or `{}` if
   *   missing/empty/invalid — matching the shell version's `jq -e .`
   *   validity check.
   */
  async _read(file) {
    let raw;

    try {
      raw = await readFile(file, 'utf8');
    } catch {
      return {};
    }

    if (!raw.trim()) {
      return {};
    }

    try {
      const parsed = JSON.parse(raw);

      return parsed === null || parsed === false ? {} : parsed;
    } catch {
      return {};
    }
  }
}

export default PermissionGrant;
