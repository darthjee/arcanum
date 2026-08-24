import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import Lock from '../utils/file/Lock.js';
import RepoPath from '../utils/file/RepoPath.js';

const USAGE_MESSAGE = [
  'Usage: issue_state.sh <repo_path> get <id> <field>',
  '       issue_state.sh <repo_path> set <id> <field> <value>',
  '       issue_state.sh <repo_path> set-json <id> <field> <json_value>',
  '       issue_state.sh <repo_path> append-json <id> <field> <json_value>'
].join('\n');

/**
 * Native equivalent of `arcanum/_lib/issue_state_shell.sh`: safe,
 * lock-protected read/write of `.claude/state/issue-<id>.json`. Kept
 * deliberately unsimplified per the issue's Scope section (a
 * longer-horizon plan may move this state onto a dedicated server).
 */
class IssueState {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Lock} [deps.lock] - the lock/mutate/release helper.
   * @param {RepoPath} [deps.repoPath] - repo-path validation helper.
   */
  constructor({ lock = new Lock(), repoPath = new RepoPath() } = {}) {
    this._lock = lock;
    this._repoPath = repoPath;
  }

  /**
   * Native implementation of the `issue-state` migrated entrypoint —
   * byte-identical stdout/exit-code counterpart to
   * `arcanum/_lib/issue_state_shell.sh`. Validates `repoPath`
   * (`RepoPath#validate`, matching `repo_path_enter`'s messages/exit-1
   * semantics), then dispatches on `subcommand`. Missing required args
   * (`repoPath`/`subcommand`/`id`/`field` — `value` is never required)
   * and an unknown `subcommand` both throw (propagated uncaught, same
   * hard-failure class the other migrated entrypoints use — the caller,
   * `core/bin/arcanum`, prints the message to stderr and exits 1).
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} subcommand - one of `get`, `set`, `set-json`,
   *   `append-json`.
   * @param {string} id - the numeric issue id.
   * @param {string} field - the state field's name.
   * @param {string} [value] - the value to set/merge (required for
   *   `set`/`set-json`/`append-json`, ignored for `get`; defaults to
   *   `''` when omitted, mirroring the shell script's `${5:-}`).
   * @returns {Promise<string>} the command's stdout — the field's value
   *   (plus trailing newline) for `get`, `''` otherwise.
   */
  async run(repoPath, subcommand, id, field, value) {
    if (!repoPath || !subcommand || !id || !field) {
      throw new Error(USAGE_MESSAGE);
    }

    await this._repoPath.validate(repoPath);

    const { stateDir } = this._paths(repoPath, id);

    await mkdir(stateDir, { recursive: true });

    switch (subcommand) {
    case 'get': {
      const result = await this.get(repoPath, id, field);

      return result === '' ? '' : `${result}\n`;
    }

    case 'set':
      await this.set(repoPath, id, field, value ?? '');

      return '';

    case 'set-json':
      await this.setJson(repoPath, id, field, value ?? '');

      return '';

    case 'append-json':
      await this.appendJson(repoPath, id, field, value ?? '');

      return '';

    default:
      throw new Error(`Unknown command: ${subcommand}\n${USAGE_MESSAGE}`);
    }
  }

  /**
   * Reads `<repoPath>/.claude/state/issue-<id>.json` and returns
   * `field`'s value, formatted the way `jq -r '.[$field] // empty'`
   * would print it (empty string for a missing/null/`false` field, the
   * raw string for a string field, 2-space-indented JSON for any other
   * type). Never throws for a missing file/lock-dir/field.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} id - the numeric issue id.
   * @param {string} field - the state field's name.
   * @returns {Promise<string>} the formatted field value, or `''`.
   */
  async get(repoPath, id, field) {
    const { stateFile } = this._paths(repoPath, id);
    const current = await this._read(stateFile);

    return this._formatValue(current[field]);
  }

  /**
   * Merge `{ [field]: value }` (always a string) into
   * `<repoPath>/.claude/state/issue-<id>.json`, holding the lock for
   * the whole read/merge/write.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} id - the numeric issue id.
   * @param {string} field - the state field's name.
   * @param {string} value - the string value to set.
   * @returns {Promise<void>} resolves once the state file is written.
   */
  async set(repoPath, id, field, value) {
    await this.write(repoPath, id, { [field]: value });
  }

  /**
   * Merge `{ [field]: <parsed jsonValue> }` into
   * `<repoPath>/.claude/state/issue-<id>.json`. On invalid JSON,
   * mirrors `issue_state_shell.sh`'s `jq --argjson` failure mode: `jq`
   * errors (no stdout), and the script still overwrites the state file
   * with that (empty) capture, silently discarding all existing state
   * — exit 0, no throw.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} id - the numeric issue id.
   * @param {string} field - the state field's name.
   * @param {string} jsonValue - the raw JSON text to parse and set.
   * @returns {Promise<void>} resolves once the state file is written.
   */
  async setJson(repoPath, id, field, jsonValue) {
    const parsed = this._parseJson(jsonValue);

    if (!parsed.ok) {
      await this._corrupt(repoPath, id);

      return;
    }

    await this.write(repoPath, id, { [field]: parsed.value });
  }

  /**
   * Append `<parsed jsonValue>` onto `field`'s existing array value
   * (treated as `[]` if absent/falsy), under the same lock/read/write
   * protocol as `#write`. Same invalid-JSON degrade as `#setJson`.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} id - the numeric issue id.
   * @param {string} field - the state field's name.
   * @param {string} jsonValue - the raw JSON text to parse and append.
   * @returns {Promise<void>} resolves once the state file is written.
   */
  async appendJson(repoPath, id, field, jsonValue) {
    const parsed = this._parseJson(jsonValue);

    if (!parsed.ok) {
      await this._corrupt(repoPath, id);

      return;
    }

    await this._mutate(repoPath, id, (current) => ({
      ...current,
      [field]: (current[field] || []).concat([parsed.value])
    }));
  }

  /**
   * Merge `<fields>` into `<repoPath>/.claude/state/issue-<id>.json`,
   * holding the lock for the whole read/merge/write.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} id - the numeric issue id.
   * @param {object} fields - the fields to set (e.g. `tags`,
   *   `updated_at`, `title`, `state`).
   * @returns {Promise<void>} resolves once the state file is written.
   */
  async write(repoPath, id, fields) {
    await this._mutate(repoPath, id, (current) => ({ ...current, ...fields }));
  }

  /**
   * Shared lock/read/mutate/write skeleton used by `#write`/
   * `#appendJson`.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} id - the numeric issue id.
   * @param {Function} mutateFn - `(current) => updated`.
   * @returns {Promise<void>} resolves once the state file is written.
   */
  async _mutate(repoPath, id, mutateFn) {
    const { stateDir, stateFile, lockFile } = this._paths(repoPath, id);

    await mkdir(stateDir, { recursive: true });
    await this._lock.acquire(lockFile);

    try {
      const current = await this._read(stateFile);
      const updated = mutateFn(current);

      await this._writeRaw(stateFile, JSON.stringify(updated, null, 2));
    } finally {
      await this._lock.release(lockFile);
    }
  }

  /**
   * Lock-protected overwrite of the state file with empty content
   * (a single trailing newline, byte-identical to
   * `issue_state_shell.sh`'s `_write_state ""` degrade path).
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} id - the numeric issue id.
   * @returns {Promise<void>} resolves once the state file is written.
   */
  async _corrupt(repoPath, id) {
    const { stateDir, stateFile, lockFile } = this._paths(repoPath, id);

    await mkdir(stateDir, { recursive: true });
    await this._lock.acquire(lockFile);

    try {
      await this._writeRaw(stateFile, '');
    } finally {
      await this._lock.release(lockFile);
    }
  }

  /**
   * Atomic write of `${content}\n` (matching `_write_state`'s `echo
   * "$json" > tmp; mv tmp state`, which always adds a trailing newline)
   * to `stateFile`.
   * @param {string} stateFile - the state file's path.
   * @param {string} content - the content to write (without its
   *   trailing newline).
   * @returns {Promise<void>} resolves once the write completes.
   */
  async _writeRaw(stateFile, content) {
    const tmpFile = `${stateFile}.tmp`;

    await writeFile(tmpFile, `${content}\n`);
    await rename(tmpFile, stateFile);
  }

  /**
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} id - the numeric issue id.
   * @returns {{stateDir: string, stateFile: string, lockFile: string}}
   *   the state dir/file/lock paths for `id`.
   */
  _paths(repoPath, id) {
    const stateDir = path.join(repoPath, '.claude', 'state');
    const stateFile = path.join(stateDir, `issue-${id}.json`);
    const lockFile = path.join(stateDir, `issue-${id}.lock`);

    return { stateDir, stateFile, lockFile };
  }

  /**
   * @param {string} jsonValue - the raw JSON text to parse.
   * @returns {{ok: boolean, value: *}} `{ ok: true, value }` on success,
   *   `{ ok: false }` on invalid JSON.
   */
  _parseJson(jsonValue) {
    try {
      return { ok: true, value: JSON.parse(jsonValue) };
    } catch {
      return { ok: false };
    }
  }

  /**
   * Format a state value the way `jq -r '.[$field] // empty'` would:
   * `null`/`undefined`/`false` print nothing, strings print raw,
   * anything else prints as 2-space-indented JSON.
   * @param {*} value - the raw state value.
   * @returns {string} the formatted value.
   */
  _formatValue(value) {
    if (value === undefined || value === null || value === false) {
      return '';
    }

    if (typeof value === 'string') {
      return value;
    }

    return JSON.stringify(value, null, 2);
  }

  /**
   * @param {string} stateFile - the state file's path.
   * @returns {Promise<object>} the parsed state, or `{}` if
   *   absent/empty/invalid.
   */
  async _read(stateFile) {
    let raw;

    try {
      raw = await readFile(stateFile, 'utf8');
    } catch {
      return {};
    }

    if (!raw.trim()) {
      return {};
    }

    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
}

export default IssueState;
