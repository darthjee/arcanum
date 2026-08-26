import { mkdir, rename, writeFile } from 'node:fs/promises';
import IssueStatePaths from '../utils/file/IssueStatePaths.js';
import Lock from '../utils/file/Lock.js';
import JsonParser from '../utils/json/JsonParser.js';
import JsonReader from '../utils/json/JsonReader.js';
import JsonValueFormatter from '../utils/json/JsonValueFormatter.js';

/**
 * Context-bound service for safe, lock-protected read/write of
 * `<context.repoPath>/.claude/state/issue-<id>.json`. Native equivalent
 * of `arcanum/_lib/issue_state_shell.sh`'s CRUD logic, bound to a
 * `RepoContext` fixed at construction — mirroring `PrOperations`'
 * context-bound convention. Kept deliberately unsimplified per the
 * issue's Scope section (a longer-horizon plan may move this state onto
 * a dedicated server).
 */
class IssueStateService {
  /**
   * @param {object} deps - the service's target context and injectable
   *   collaborators, for testing.
   * @param {object} deps.context - a `RepoContext`, providing
   *   `context.repoPath`.
   * @param {Lock} [deps.lock] - the lock/mutate/release helper.
   * @param {JsonParser} [deps.jsonParser] - JSON-text parser.
   * @param {JsonValueFormatter} [deps.jsonValueFormatter] - `jq`-style
   *   value formatter.
   * @param {JsonReader} [deps.jsonReader] - JSON-file reader.
   * @param {IssueStatePaths} [deps.issueStatePaths] - state/lock path
   *   resolver.
   */
  constructor({
    context,
    lock = new Lock(),
    jsonParser = new JsonParser(),
    jsonValueFormatter = new JsonValueFormatter(),
    jsonReader = new JsonReader(),
    issueStatePaths = new IssueStatePaths()
  } = {}) {
    this._context = context;
    this._lock = lock;
    this._jsonParser = jsonParser;
    this._jsonValueFormatter = jsonValueFormatter;
    this._jsonReader = jsonReader;
    this._issueStatePaths = issueStatePaths;
  }

  /**
   * Reads `<context.repoPath>/.claude/state/issue-<id>.json` and
   * returns `field`'s value, formatted the way `jq -r '.[$field] //
   * empty'` would print it (empty string for a missing/null/`false`
   * field, the raw string for a string field, 2-space-indented JSON for
   * any other type). Never throws for a missing file/lock-dir/field.
   * @param {string} id - the numeric issue id.
   * @param {string} field - the state field's name.
   * @returns {Promise<string>} the formatted field value, or `''`.
   */
  async get(id, field) {
    const { stateFile } = this._issueStatePaths.paths(this._context.repoPath, id);
    const current = await this._jsonReader.read(stateFile);

    return this._jsonValueFormatter.format(current[field]);
  }

  /**
   * Merge `{ [field]: value }` (always a string) into
   * `<context.repoPath>/.claude/state/issue-<id>.json`, holding the
   * lock for the whole read/merge/write.
   * @param {string} id - the numeric issue id.
   * @param {string} field - the state field's name.
   * @param {string} value - the string value to set.
   * @returns {Promise<void>} resolves once the state file is written.
   */
  async set(id, field, value) {
    await this.write(id, { [field]: value });
  }

  /**
   * Merge `{ [field]: <parsed jsonValue> }` into
   * `<context.repoPath>/.claude/state/issue-<id>.json`. On invalid
   * JSON, mirrors `issue_state_shell.sh`'s `jq --argjson` failure mode:
   * `jq` errors (no stdout), and the script still overwrites the state
   * file with that (empty) capture, silently discarding all existing
   * state — exit 0, no throw.
   * @param {string} id - the numeric issue id.
   * @param {string} field - the state field's name.
   * @param {string} jsonValue - the raw JSON text to parse and set.
   * @returns {Promise<void>} resolves once the state file is written.
   */
  async setJson(id, field, jsonValue) {
    const parsed = this._jsonParser.parse(jsonValue);

    if (!parsed.ok) {
      await this._corrupt(id);

      return;
    }

    await this.write(id, { [field]: parsed.value });
  }

  /**
   * Append `<parsed jsonValue>` onto `field`'s existing array value
   * (treated as `[]` if absent/falsy), under the same lock/read/write
   * protocol as `#write`. Same invalid-JSON degrade as `#setJson`.
   * @param {string} id - the numeric issue id.
   * @param {string} field - the state field's name.
   * @param {string} jsonValue - the raw JSON text to parse and append.
   * @returns {Promise<void>} resolves once the state file is written.
   */
  async appendJson(id, field, jsonValue) {
    const parsed = this._jsonParser.parse(jsonValue);

    if (!parsed.ok) {
      await this._corrupt(id);

      return;
    }

    await this._mutate(id, (current) => ({
      ...current,
      [field]: (current[field] || []).concat([parsed.value])
    }));
  }

  /**
   * Merge `<fields>` into
   * `<context.repoPath>/.claude/state/issue-<id>.json`, holding the
   * lock for the whole read/merge/write.
   * @param {string} id - the numeric issue id.
   * @param {object} fields - the fields to set (e.g. `tags`,
   *   `updated_at`, `title`, `state`).
   * @returns {Promise<void>} resolves once the state file is written.
   */
  async write(id, fields) {
    await this._mutate(id, (current) => ({ ...current, ...fields }));
  }

  /**
   * Shared lock/read/mutate/write skeleton used by `#write`/
   * `#appendJson`.
   * @param {string} id - the numeric issue id.
   * @param {Function} mutateFn - `(current) => updated`.
   * @returns {Promise<void>} resolves once the state file is written.
   */
  async _mutate(id, mutateFn) {
    const { stateDir, stateFile, lockFile } = this._issueStatePaths.paths(this._context.repoPath, id);

    await mkdir(stateDir, { recursive: true });
    await this._lock.acquire(lockFile);

    try {
      const current = await this._jsonReader.read(stateFile);
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
   * @param {string} id - the numeric issue id.
   * @returns {Promise<void>} resolves once the state file is written.
   */
  async _corrupt(id) {
    const { stateDir, stateFile, lockFile } = this._issueStatePaths.paths(this._context.repoPath, id);

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
}

export default IssueStateService;
