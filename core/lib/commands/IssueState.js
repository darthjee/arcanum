import { mkdir } from 'node:fs/promises';
import IssueStateService from '../services/IssueStateService.js';
import IssueStatePaths from '../utils/file/IssueStatePaths.js';
import Lock from '../utils/file/Lock.js';
import RepoPath from '../utils/file/RepoPath.js';
import JsonParser from '../utils/json/JsonParser.js';
import JsonReader from '../utils/json/JsonReader.js';
import JsonValueFormatter from '../utils/json/JsonValueFormatter.js';

const USAGE_MESSAGE = [
  'Usage: issue_state.sh <repo_path> get <id> <field>',
  '       issue_state.sh <repo_path> set <id> <field> <value>',
  '       issue_state.sh <repo_path> set-json <id> <field> <json_value>',
  '       issue_state.sh <repo_path> append-json <id> <field> <json_value>'
].join('\n');

/**
 * Native equivalent of `arcanum/_lib/issue_state_shell.sh`: dispatches
 * to a per-call, context-bound `IssueStateService` for the actual safe,
 * lock-protected read/write of `.claude/state/issue-<id>.json`. Kept
 * deliberately unsimplified per the issue's Scope section (a
 * longer-horizon plan may move this state onto a dedicated server).
 */
class IssueState {
  /**
   * @param {import('../context/RepoContext.js').default} repoContext -
   *   the target repo's context (provides `repoPath` and is forwarded to
   *   each per-call `IssueStateService`).
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {RepoPath} [deps.repoPath] - repo-path validation helper.
   * @param {Lock} [deps.lock] - the lock/mutate/release helper, forwarded
   *   to each per-call `IssueStateService`.
   * @param {JsonParser} [deps.jsonParser] - JSON-text parser, forwarded
   *   to each per-call `IssueStateService`.
   * @param {JsonValueFormatter} [deps.jsonValueFormatter] - `jq`-style
   *   value formatter, forwarded to each per-call `IssueStateService`.
   * @param {JsonReader} [deps.jsonReader] - JSON-file reader, forwarded
   *   to each per-call `IssueStateService`.
   * @param {IssueStatePaths} [deps.issueStatePaths] - state/lock path
   *   resolver, forwarded to each per-call `IssueStateService`.
   */
  constructor(repoContext, {
    repoPath = new RepoPath(),
    lock = new Lock(),
    jsonParser = new JsonParser(),
    jsonValueFormatter = new JsonValueFormatter(),
    jsonReader = new JsonReader(),
    issueStatePaths = new IssueStatePaths()
  } = {}) {
    this._repoContext = repoContext;
    this._repoPath = repoPath;
    this._lock = lock;
    this._jsonParser = jsonParser;
    this._jsonValueFormatter = jsonValueFormatter;
    this._jsonReader = jsonReader;
    this._issueStatePaths = issueStatePaths;
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
  async run(subcommand, id, field, value) {
    const { repoPath } = this._repoContext;

    if (!repoPath || !subcommand || !id || !field) {
      throw new Error(USAGE_MESSAGE);
    }

    await this._repoPath.validate(repoPath);

    const { stateDir } = this._issueStatePaths.paths(repoPath, id);

    await mkdir(stateDir, { recursive: true });

    const issueStateService = this._issueStateService();

    switch (subcommand) {
    case 'get': {
      const result = await issueStateService.get(id, field);

      return result === '' ? '' : `${result}\n`;
    }

    case 'set':
      await issueStateService.set(id, field, value ?? '');

      return '';

    case 'set-json':
      await issueStateService.setJson(id, field, value ?? '');

      return '';

    case 'append-json':
      await issueStateService.appendJson(id, field, value ?? '');

      return '';

    default:
      throw new Error(`Unknown command: ${subcommand}\n${USAGE_MESSAGE}`);
    }
  }

  /**
   * Build a per-call `IssueStateService` bound to the injected
   * `RepoContext` — `RepoContext` exposes no `set`/`setJson`
   * passthrough, so `IssueState` keeps constructing its own service.
   * @returns {IssueStateService} the per-call `IssueStateService`.
   */
  _issueStateService() {
    return new IssueStateService({
      context: this._repoContext,
      lock: this._lock,
      jsonParser: this._jsonParser,
      jsonValueFormatter: this._jsonValueFormatter,
      jsonReader: this._jsonReader,
      issueStatePaths: this._issueStatePaths
    });
  }
}

export default IssueState;
