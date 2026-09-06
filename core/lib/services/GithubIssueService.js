import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import IssueClient from '../utils/github/IssueClient.js';
import GithubToken from '../utils/github/GithubToken.js';
import Origin from '../utils/git/Origin.js';

const DEFAULT_TIMEOUT_MS = 30000;
const ISSUES_DIR = 'docs/agents/issues';

/**
 * REST-call-plus-file-write logic shared by `commands/shared/GithubIssue.js`'s
 * `create`/`fetch` methods, extracted so `context/RepoContext.js` can depend
 * on it directly instead of reaching into `commands/` — a `services/`
 * module, per `core/lib/`'s one-way `commands` → `context`/`services` →
 * `utils` layering, may only depend on `utils/`, so it never builds a
 * `RepoContext` itself; it talks to `Origin`/`GithubToken` directly and
 * hands `IssueClient` a plain object satisfying its `context` shape
 * (`resolveWithRef`/`getToken`) instead.
 */
class GithubIssueService {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Origin} [deps.origin] - git-origin resolver.
   * @param {GithubToken} [deps.githubToken] - GitHub token resolver.
   * @param {Function} [deps.fetchFn] - `fetch`-compatible implementation
   *   (global `fetch` by default).
   * @param {number} [deps.timeoutMs] - the REST call's abort timeout,
   *   overridable for tests (defaults to the real 30s protocol value).
   */
  constructor({
    origin = new Origin(),
    githubToken = new GithubToken(),
    fetchFn = fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS
  } = {}) {
    this._origin = origin;
    this._githubToken = githubToken;
    this._fetch = fetchFn;
    this._timeoutMs = timeoutMs;
  }

  /**
   * Native implementation of the `github-issue-create` migrated
   * entrypoint's underlying logic — mirrors `github_issue.sh`'s
   * `cmd_create` exactly: reads `file`'s contents (trailing newlines
   * stripped, matching `$(cat "$file")`'s command-substitution
   * trimming), creates the issue over the GitHub REST API, writes the
   * same body to `docs/agents/issues/`, and returns the fields
   * `cmd_create`'s stdout needs. Does not persist any per-issue state
   * file, matching the shell.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} title - the new issue's title.
   * @param {string} file - the local file whose contents become the
   *   issue's body.
   * @returns {Promise<string>} the `ID=...\nTITLE=...\nFILE=...\nDOMAIN=...\nREPO=...\n` output.
   */
  async create(repoPath, title, file) {
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
    const issue = await this.issueClient(repoPath).createIssue(title, body);
    const id = this.rawString(issue.number);
    const normalized = this.normalizeTitle(title);
    const filePath = `${ISSUES_DIR}/${id}-${normalized}.md`;

    await mkdir(path.join(repoPath, ISSUES_DIR), { recursive: true });
    await writeFile(path.join(repoPath, filePath), `${body}\n`);

    return `ID=${id}\nTITLE=${title}\nFILE=${filePath}\nDOMAIN=${domain}\nREPO=${repo}\n`;
  }

  /**
   * Build a per-call `IssueClient`, bound to a plain object satisfying
   * `IssueClient`'s expected `context` shape (`resolveWithRef`/
   * `getToken`, resolved against `repoPath`) rather than an actual
   * `RepoContext` — this class must not import `context/RepoContext.js`,
   * per `core/lib/`'s one-way layering. Reused by both `#create` and by
   * `commands/shared/GithubIssue.js#fetch`.
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {IssueClient} the per-call `IssueClient`.
   */
  issueClient(repoPath) {
    const context = {
      resolveWithRef: () => this._origin.resolveWithRef(repoPath),
      getToken: () => this._githubToken.get(repoPath)
    };

    return new IssueClient({ context, fetchFn: this._fetch, timeoutMs: this._timeoutMs });
  }

  /**
   * Mirrors `jq -r`'s rendering of a possibly-null/absent field: the
   * literal string `"null"` for a JSON `null` value, the value itself
   * (stringified) otherwise.
   * @param {*} value - the raw JSON field value.
   * @returns {string} the `jq -r`-equivalent string form.
   */
  rawString(value) {
    return value === null || value === undefined ? 'null' : String(value);
  }

  /**
   * Native equivalent of `github_issue.sh`'s `normalize_title`:
   * lowercase, `[^a-z0-9]` -> `-`, collapse repeats, trim
   * leading/trailing `-`.
   * @param {string} title - the raw issue title.
   * @returns {string} the sanitized filename slug.
   */
  normalizeTitle(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-/, '')
      .replace(/-$/, '');
  }
}

export default GithubIssueService;
