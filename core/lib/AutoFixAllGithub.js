import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import GithubToken from './GithubToken.js';
import IssueState from './IssueState.js';
import Origin from './Origin.js';

const defaultExecFileAsync = promisify(execFile);
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Native equivalent of `auto-fix-all/scripts/github.sh`: the 7
 * GitHub-facing subcommands (`pr-number`, `pr-state`, `pr-merge`,
 * `cleanup-branch`, `has-shipit-label`, `add-tag`, `remove-tag`) used
 * throughout the `auto-fix-all` skill. Uses the GitHub REST API (via
 * `fetch` + a `gh auth token`-resolved bearer token) instead of
 * shelling out to `gh pr view`/`gh pr merge`/`gh issue view`/`gh issue
 * edit`, mirroring every other migrated GitHub-facing entrypoint (see
 * `core/lib/GithubIssue.js`, `core/lib/AutoFixAllQueue.js`,
 * `core/lib/AutoFixAllWaitCi.js`).
 */
class AutoFixAllGithub {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Origin} [deps.origin] - git-origin resolver.
   * @param {GithubToken} [deps.githubToken] - GitHub token resolver.
   * @param {IssueState} [deps.issueState] - issue state-file reader,
   *   used by `prNumber`'s cache lookup.
   * @param {Function} [deps.execFileAsync] - promisified `execFile`.
   * @param {Function} [deps.fetchFn] - `fetch`-compatible implementation
   *   (global `fetch` by default).
   * @param {number} [deps.timeoutMs] - each REST call's abort timeout,
   *   overridable for tests (defaults to the real 30s protocol value).
   */
  constructor({
    origin = new Origin(),
    githubToken = new GithubToken(),
    issueState = new IssueState(),
    execFileAsync = defaultExecFileAsync,
    fetchFn = fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS
  } = {}) {
    this._origin = origin;
    this._githubToken = githubToken;
    this._issueState = issueState;
    this._execFileAsync = execFileAsync;
    this._fetch = fetchFn;
    this._timeoutMs = timeoutMs;
  }

  /**
   * Native implementation of `github.sh pr-number`: prints the current
   * branch's pull request number. When the current branch matches
   * `issue-<id>`, tries `IssueState`'s cached `pr_id` field first
   * (reusing `core/lib/IssueState.js` directly rather than re-deriving
   * the cache read) before falling back to a GitHub REST lookup.
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<string>} `<number>\n`.
   * @throws {Error} `Error: no pull request found for the current
   *   branch on <repo_ref>` when no pull request is found.
   */
  async prNumber(repoPath) {
    if (!repoPath) {
      throw new Error('Usage: github.sh pr-number <repo_path>');
    }

    const branch = await this._currentBranch(repoPath);
    const idMatch = branch.match(/^issue-(\d+)$/);

    if (idMatch) {
      const cached = await this._issueState.get(repoPath, idMatch[1], 'pr_id');

      if (cached) {
        return `${cached}\n`;
      }
    }

    const { repo, repoRef } = await this._resolveRepo(repoPath);
    const token = await this._githubToken.get(repoPath);
    const pull = await this._findPr(repo, branch, token, repoRef);

    return `${pull.number}\n`;
  }

  /**
   * Native implementation of `github.sh pr-state`: prints
   * `STATE=<OPEN|MERGED|CLOSED>` for the current branch's pull request.
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<string>} `STATE=<OPEN|MERGED|CLOSED>\n`.
   * @throws {Error} `Error: no pull request found for the current
   *   branch on <repo_ref>` when no pull request is found.
   */
  async prState(repoPath) {
    if (!repoPath) {
      throw new Error('Usage: github.sh pr-state <repo_path>');
    }

    const branch = await this._currentBranch(repoPath);
    const { repo, repoRef } = await this._resolveRepo(repoPath);
    const token = await this._githubToken.get(repoPath);
    const pull = await this._findPr(repo, branch, token, repoRef);

    return `STATE=${this._prStateLabel(pull)}\n`;
  }

  /**
   * Native implementation of `github.sh cleanup-branch`: deletes the
   * issue's remote and local `issue-<id>` branch, then switches back to
   * `main` and resets it to `origin/main`. No `gh`/REST calls — plain
   * `git`, mirroring the shell version exactly. The remote-delete step
   * tolerates failure (matching the shell's `|| true`, e.g. when the
   * remote branch is already gone); every other step is not tolerant of
   * failure.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} id - the numeric issue id.
   * @returns {Promise<string>} `''` (no stdout on success, matching the
   *   shell version).
   */
  async cleanupBranch(repoPath, id) {
    if (!repoPath || !id) {
      throw new Error('Usage: github.sh cleanup-branch <repo_path> <id>');
    }

    const branch = `issue-${id}`;

    try {
      await this._execFileAsync('git', ['push', 'origin', '--delete', branch], { cwd: repoPath });
    } catch {
      // tolerate failure — matches the shell's `|| true`.
    }

    await this._execFileAsync('git', ['checkout', 'main'], { cwd: repoPath });
    await this._execFileAsync('git', ['reset', '--hard', 'origin/main'], { cwd: repoPath });
    await this._execFileAsync('git', ['branch', '-D', branch], { cwd: repoPath });

    return '';
  }

  /**
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<string>} the current branch's name.
   */
  async _currentBranch(repoPath) {
    const { stdout } = await this._execFileAsync('git', ['branch', '--show-current'], { cwd: repoPath });

    return stdout.trim();
  }

  /**
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<{repo: string, repoRef: string}>} the origin's
   *   `owner/repo` path, plus the (possibly domain-qualified) repo
   *   reference used in error/success messages, mirroring
   *   `origin.sh`'s `get_repo_ref`.
   */
  async _resolveRepo(repoPath) {
    const { domain, repo } = await this._origin.resolve(repoPath);
    const repoRef = domain === 'github.com' ? repo : `${domain}/${repo}`;

    return { repo, repoRef };
  }

  /**
   * Resolve the current branch's pull request, replacing the shell
   * script's `gh pr view -R "$repo_ref" "$branch"` lookup. Unlike
   * `AutoFixAllWaitCi.js`'s open-only PR lookup, this fetches across
   * every state (`state=all`) since `pr-state` must be able to report
   * `MERGED`/`CLOSED` as well as `OPEN`.
   * @param {string} repo - the `owner/repo` path.
   * @param {string} branch - the current branch's name.
   * @param {string} token - the GitHub token.
   * @param {string} repoRef - the (possibly domain-qualified) repo
   *   reference, used in the not-found error message.
   * @returns {Promise<object>} the resolved pull request object.
   * @throws {Error} `Error: no pull request found for the current
   *   branch on <repoRef>` on any lookup failure.
   */
  async _findPr(repo, branch, token, repoRef) {
    const notFound = () => new Error(`Error: no pull request found for the current branch on ${repoRef}`);
    const owner = repo.split('/')[0];
    const url = `https://api.github.com/repos/${repo}/pulls?head=${encodeURIComponent(owner)}:${encodeURIComponent(branch)}&state=all`;

    let response;

    try {
      response = await this._fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(this._timeoutMs)
      });
    } catch {
      throw notFound();
    }

    if (!response.ok) {
      throw notFound();
    }

    let pulls;

    try {
      pulls = await response.json();
    } catch {
      throw notFound();
    }

    const pull = Array.isArray(pulls) && pulls.length > 0 ? pulls[0] : undefined;

    if (!pull || !pull.number) {
      throw notFound();
    }

    return pull;
  }

  /**
   * Mirrors `gh pr view --json state`'s derivation of `OPEN`/`MERGED`/
   * `CLOSED` from the REST API's `state`/`merged`/`merged_at` fields —
   * a merged PR always reports `MERGED`, even though the REST `state`
   * field itself is just `closed` for both a merged and a plain-closed
   * PR.
   * @param {object} pull - the pull request object.
   * @returns {'OPEN'|'MERGED'|'CLOSED'} the derived state label.
   */
  _prStateLabel(pull) {
    if (pull.merged || pull.merged_at) {
      return 'MERGED';
    }

    return pull.state === 'closed' ? 'CLOSED' : 'OPEN';
  }
}

export default AutoFixAllGithub;
