import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import GithubToken from './GithubToken.js';
import IssueState from './IssueState.js';
import Origin from './Origin.js';
import Tags from './Tags.js';

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
   * @param {IssueState} [deps.issueState] - issue state-file writer.
   * @param {Function} [deps.fetchFn] - `fetch`-compatible implementation
   *   (global `fetch` by default).
   * @param {number} [deps.timeoutMs] - the REST call's abort timeout,
   *   overridable for tests (defaults to the real 30s protocol value).
   */
  constructor({
    origin = new Origin(),
    githubToken = new GithubToken(),
    issueState = new IssueState(),
    fetchFn = fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS
  } = {}) {
    this._origin = origin;
    this._githubToken = githubToken;
    this._issueState = issueState;
    this._fetch = fetchFn;
    this._timeoutMs = timeoutMs;
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
    const token = await this._githubToken.get(repoPath);

    let response;

    try {
      response = await this._fetch(`https://api.github.com/repos/${repo}/issues/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(this._timeoutMs)
      });
    } catch {
      throw new Error(`Error: could not fetch issue #${id} from ${repo}`);
    }

    if (!response.ok) {
      throw new Error(`Error: could not fetch issue #${id} from ${repo}`);
    }

    const issue = await response.json();
    const title = this._rawString(issue.title);
    const body = this._rawString(issue.body);
    const state = this._rawString(issue.state);
    const updatedAt = this._rawString(issue.updated_at);
    const labels = (issue.labels || []).map((label) => label.name);

    const normalized = this._normalizeTitle(title);
    const filePath = `${ISSUES_DIR}/${id}-${normalized}.md`;

    await mkdir(path.join(repoPath, ISSUES_DIR), { recursive: true });
    await writeFile(path.join(repoPath, filePath), `${body}\n`);

    await this._issueState.write(repoPath, id, {
      tags: Tags.extractTags(labels),
      updated_at: updatedAt,
      title,
      state
    });

    return { title, file: filePath, domain, repo };
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
