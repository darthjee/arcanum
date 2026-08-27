import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import RepoContext from '../context/RepoContext.js';
import IssueClient from '../utils/github/IssueClient.js';
import IssueStateService from '../services/IssueStateService.js';
import GithubToken from '../utils/github/GithubToken.js';
import IssueStatePaths from '../utils/file/IssueStatePaths.js';
import Lock from '../utils/file/Lock.js';
import Origin from '../utils/git/Origin.js';
import RepoPath from '../utils/file/RepoPath.js';
import JsonParser from '../utils/json/JsonParser.js';
import JsonReader from '../utils/json/JsonReader.js';
import JsonValueFormatter from '../utils/json/JsonValueFormatter.js';
import Tags from '../utils/issue/Tags.js';

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
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Origin} [deps.origin] - git-origin resolver.
   * @param {GithubToken} [deps.githubToken] - GitHub token resolver.
   * @param {RepoPath} [deps.repoPath] - repo-path validation helper.
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
   */
  constructor({
    origin = new Origin(),
    githubToken = new GithubToken(),
    repoPath = new RepoPath(),
    fetchFn = fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    lock = new Lock(),
    jsonParser = new JsonParser(),
    jsonValueFormatter = new JsonValueFormatter(),
    jsonReader = new JsonReader(),
    issueStatePaths = new IssueStatePaths()
  } = {}) {
    this._origin = origin;
    this._githubToken = githubToken;
    this._repoPath = repoPath;
    this._fetch = fetchFn;
    this._timeoutMs = timeoutMs;
    this._lock = lock;
    this._jsonParser = jsonParser;
    this._jsonValueFormatter = jsonValueFormatter;
    this._jsonReader = jsonReader;
    this._issueStatePaths = issueStatePaths;
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
    const issue = await this._issueClient(repoPath).getIssue(id);
    const title = this._rawString(issue.title);
    const body = this._rawString(issue.body);
    const state = this._rawString(issue.state);
    const updatedAt = this._rawString(issue.updated_at);
    const labels = (issue.labels || []).map((label) => label.name);

    const normalized = this._normalizeTitle(title);
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
   * returns its `DOMAIN=`/`REPO=` fields. Deliberately skips
   * `RepoPath#validate` (the shell version only calls `_load_origin`
   * here, whose own not-a-git-repo/no-origin failure is already
   * reproduced by `Origin#resolve`'s existing error message).
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<string>} the `DOMAIN=<domain>\nREPO=<repo>\n` output.
   */
  async info(repoPath) {
    const { domain, repo } = await this._origin.resolve(repoPath);

    return `DOMAIN=${domain}\nREPO=${repo}\n`;
  }

  /**
   * Native implementation of the `github-issue-create` migrated
   * entrypoint's underlying logic — mirrors `github_issue.sh`'s
   * `cmd_create` exactly: validates `repoPath`, reads `file`'s
   * contents (trailing newlines stripped, matching `$(cat "$file")`'s
   * command-substitution trimming), creates the issue over the GitHub
   * REST API, writes the same body to `docs/agents/issues/`, and
   * returns the fields `cmd_create`'s stdout needs. Does not persist
   * any per-issue state file (no `IssueState#write` call), matching the
   * shell.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} title - the new issue's title.
   * @param {string} file - the local file whose contents become the
   *   issue's body.
   * @returns {Promise<string>} the `ID=...\nTITLE=...\nFILE=...\nDOMAIN=...\nREPO=...\n` output.
   */
  async create(repoPath, title, file) {
    await this._repoPath.validate(repoPath);

    let rawBody;

    try {
      rawBody = await readFile(file, 'utf8');
    } catch {
      throw new Error(`Error: file not found: ${file}`);
    }

    // $(cat "$file") in bash strips ALL trailing newlines via command
    // substitution; the shell then re-adds exactly one via `printf '%s\n'`.
    // Match that exactly, in both the POST payload and the written file —
    // do not just pass the raw file contents through.
    const body = rawBody.replace(/\n+$/, '');

    const { domain, repo } = await this._origin.resolve(repoPath);
    const issue = await this._issueClient(repoPath).createIssue(title, body);
    const id = this._rawString(issue.number);
    const normalized = this._normalizeTitle(title);
    const filePath = `${ISSUES_DIR}/${id}-${normalized}.md`;

    await mkdir(path.join(repoPath, ISSUES_DIR), { recursive: true });
    await writeFile(path.join(repoPath, filePath), `${body}\n`);

    return `ID=${id}\nTITLE=${title}\nFILE=${filePath}\nDOMAIN=${domain}\nREPO=${repo}\n`;
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

  /**
   * Build a per-call `IssueClient`, wrapping `repoPath` into a fresh
   * `RepoContext` bound to the shared `origin`/`githubToken` — same
   * per-call shape as `#_issueStateService`, since `fetch`/`create` are
   * dispatched with `repoPath` known only once the method is called
   * (see this migration's plan's Notes on why `GithubIssue` itself
   * keeps a zero-argument constructor).
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {IssueClient} the per-call `IssueClient`.
   */
  _issueClient(repoPath) {
    const context = new RepoContext({
      repoPath,
      origin: this._origin,
      githubToken: this._githubToken
    });

    return new IssueClient({ context, fetchFn: this._fetch, timeoutMs: this._timeoutMs });
  }

  /**
   * Mirrors `jq -r`'s rendering of a possibly-null/absent field: the
   * literal string `"null"` for a JSON `null` value, the value itself
   * (stringified) otherwise.
   * @param {*} value - the raw JSON field value.
   * @returns {string} the `jq -r`-equivalent string form.
   */
  _rawString(value) {
    return value === null || value === undefined ? 'null' : String(value);
  }

  /**
   * Native equivalent of `github_issue.sh`'s `normalize_title`:
   * lowercase, `[^a-z0-9]` -> `-`, collapse repeats, trim
   * leading/trailing `-`.
   * @param {string} title - the raw issue title.
   * @returns {string} the sanitized filename slug.
   */
  _normalizeTitle(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-/, '')
      .replace(/-$/, '');
  }
}

export default GithubIssue;
