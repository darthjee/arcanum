import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import RepoContext from '../../context/RepoContext.js';
import GithubIssueService from '../../services/GithubIssueService.js';
import IssueStateService from '../../services/IssueStateService.js';
import GithubToken from '../../utils/github/GithubToken.js';
import IssueStatePaths from '../../utils/file/IssueStatePaths.js';
import Lock from '../../utils/file/Lock.js';
import Origin from '../../utils/git/Origin.js';
import JsonParser from '../../utils/json/JsonParser.js';
import JsonReader from '../../utils/json/JsonReader.js';
import JsonValueFormatter from '../../utils/json/JsonValueFormatter.js';
import Tags from '../../utils/issue/Tags.js';

const DEFAULT_TIMEOUT_MS = 30000;
const ISSUES_DIR = 'docs/agents/issues';

/**
 * Native equivalent of `arcanum/_lib/github_issue.sh`'s `fetch`
 * command: fetches a GitHub issue over the REST API, writes its body to
 * `docs/agents/issues/`, maps its labels to canonical tags, and
 * persists the result to `.claude/state/issue-<id>.json`. Note this
 * hardcodes `docs/agents/issues` for the freshly-fetched file's
 * location, exactly as `cmd_fetch` does — independent of whatever
 * `issues_folder` the caller passed for the existing-file lookup.
 */
class GithubIssue {
  /**
   * @param {import('../context/RepoContext.js').default} [repoContext] -
   *   the target repo's context, supplied only by the
   *   `github-issue-create` / `github-issue-info` CLI entrypoints (whose
   *   leading `repoPath` positional is stripped by
   *   `Dispatcher.commandArgs()`). Absent when `GithubIssue` is used
   *   zero-arg as a plain `RepoContext` collaborator, in which case the
   *   entry methods receive an explicit `repoPath`.
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Origin} [deps.origin] - git-origin resolver.
   * @param {GithubToken} [deps.githubToken] - GitHub token resolver.
   * @param {Function} [deps.fetchFn] - `fetch`-compatible implementation
   *   (global `fetch` by default).
   * @param {number} [deps.timeoutMs] - the REST call's abort timeout,
   *   overridable for tests (defaults to the real 30s protocol value).
   * @param {Lock} [deps.lock] - forwarded to each per-call
   *   `IssueStateService`.
   * @param {JsonParser} [deps.jsonParser] - forwarded to each per-call
   *   `IssueStateService`.
   * @param {JsonValueFormatter} [deps.jsonValueFormatter] - forwarded
   *   to each per-call `IssueStateService`.
   * @param {JsonReader} [deps.jsonReader] - forwarded to each per-call
   *   `IssueStateService`.
   * @param {IssueStatePaths} [deps.issueStatePaths] - forwarded to each
   *   per-call `IssueStateService`.
   * @param {GithubIssueService} [deps.githubIssueService] - the
   *   REST-call-plus-file-write logic shared by `#fetch`/`#create`,
   *   built from the collaborators above by default.
   */
  constructor(repoContext, {
    origin = new Origin(),
    githubToken = new GithubToken(),
    fetchFn = fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    lock = new Lock(),
    jsonParser = new JsonParser(),
    jsonValueFormatter = new JsonValueFormatter(),
    jsonReader = new JsonReader(),
    issueStatePaths = new IssueStatePaths(),
    githubIssueService = new GithubIssueService({ origin, githubToken, fetchFn, timeoutMs })
  } = {}) {
    this._repoContext = repoContext;
    this._origin = origin;
    this._githubToken = githubToken;
    this._fetch = fetchFn;
    this._timeoutMs = timeoutMs;
    this._lock = lock;
    this._jsonParser = jsonParser;
    this._jsonValueFormatter = jsonValueFormatter;
    this._jsonReader = jsonReader;
    this._issueStatePaths = issueStatePaths;
    this._githubIssueService = githubIssueService;
  }

  /**
   * Fetch issue `<id>` from GitHub, write its body to disk, map its
   * labels to canonical tags, persist the per-issue state file, and
   * return the fields `resolve-and-fetch`'s `STATUS=ok` output needs.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} id - the numeric issue id.
   * @returns {Promise<{title: string, file: string, domain: string, repo: string}>} the fetched issue's fields.
   */
  async fetch(repoPath, id) {
    const { domain, repo } = await this._origin.resolve(repoPath);
    const issue = await this._githubIssueService.issueClient(repoPath).getIssue(id);
    const title = this._githubIssueService.rawString(issue.title);
    const body = this._githubIssueService.rawString(issue.body);
    const state = this._githubIssueService.rawString(issue.state);
    const updatedAt = this._githubIssueService.rawString(issue.updated_at);
    const labels = (issue.labels || []).map((label) => label.name);

    const normalized = this._githubIssueService.normalizeTitle(title);
    const filePath = `${ISSUES_DIR}/${id}-${normalized}.md`;

    await mkdir(path.join(repoPath, ISSUES_DIR), { recursive: true });
    await writeFile(path.join(repoPath, filePath), `${body}\n`);

    await this._issueStateService(repoPath).write(id, {
      tags: Tags.extractTags(labels),
      updated_at: updatedAt,
      title,
      state
    });

    return { title, file: filePath, domain, repo };
  }

  /**
   * Native implementation of the `github-issue-info` migrated
   * entrypoint's underlying logic — mirrors `github_issue.sh`'s
   * `cmd_info` exactly: resolves `repoPath`'s git `origin` remote and
   * returns its `DOMAIN=`/`REPO=` fields. Deliberately skips the
   * `RepoContext#validate()` repo-path guard — the `github-issue-info`
   * registry entry sets `validateRepoPath: false` — because the shell
   * version only calls `_load_origin` here, whose own
   * not-a-git-repo/no-origin failure is already reproduced by
   * `Origin#resolve`'s existing error message.
   * @param {string} [repoPath] - the target repo's local checkout path.
   *   On the collaborator path this is passed explicitly. On the CLI
   *   (flag-on) path `Dispatcher.commandArgs()` has already stripped the
   *   leading positional, so `repoPath` is read from `this._repoContext`
   *   instead (and `info` receives no argument).
   * @returns {Promise<string>} the `DOMAIN=<domain>\nREPO=<repo>\n` output.
   */
  async info(repoPath) {
    if (this._repoContext) {
      repoPath = this._repoContext.repoPath;
    }

    const { domain, repo } = await this._origin.resolve(repoPath);

    return `DOMAIN=${domain}\nREPO=${repo}\n`;
  }

  /**
   * Native implementation of the `github-issue-create` migrated
   * entrypoint's underlying logic — mirrors `github_issue.sh`'s
   * `cmd_create` exactly: reads `file`'s
   * contents (trailing newlines stripped, matching `$(cat "$file")`'s
   * command-substitution trimming), creates the issue over the GitHub
   * REST API, writes the same body to `docs/agents/issues/`, and
   * returns the fields `cmd_create`'s stdout needs. Does not persist
   * any per-issue state file (no `IssueState#write` call), matching the
   * shell. `repoPath` validation (`repo_path_enter` parity) is handled
   * upstream — by `Dispatcher` via `RepoContext#validate()` on the CLI
   * path, and by `RepoContext#createIssue` on the collaborator path.
   * @param {string} [repoPath] - the target repo's local checkout path.
   *   On the collaborator path (`RepoContext#createIssue`) this is passed
   *   explicitly. On the CLI (flag-on) path `Dispatcher.commandArgs()`
   *   has already stripped the leading positional, so `repoPath` is read
   *   from `this._repoContext` and the received positionals are shifted
   *   back into `title`/`file`.
   * @param {string} title - the new issue's title.
   * @param {string} file - the local file whose contents become the
   *   issue's body.
   * @returns {Promise<string>} the `ID=...\nTITLE=...\nFILE=...\nDOMAIN=...\nREPO=...\n` output.
   */
  async create(repoPath, title, file) {
    if (this._repoContext) {
      [repoPath, title, file] = [this._repoContext.repoPath, repoPath, title];
    }

    return this._githubIssueService.create(repoPath, title, file);
  }

  /**
   * Build a per-call `IssueStateService`, wrapping `repoPath` into a
   * fresh `RepoContext` — mirroring `IssueState.js`'s
   * `_issueStateService(repoPath)` helper.
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {IssueStateService} the per-call `IssueStateService`.
   */
  _issueStateService(repoPath) {
    const context = new RepoContext({ repoPath });

    return new IssueStateService({
      context,
      lock: this._lock,
      jsonParser: this._jsonParser,
      jsonValueFormatter: this._jsonValueFormatter,
      jsonReader: this._jsonReader,
      issueStatePaths: this._issueStatePaths
    });
  }
}

export default GithubIssue;
