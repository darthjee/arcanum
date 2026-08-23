import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ConfigChain from './ConfigChain.js';
import DispatchFailure from './DispatchFailure.js';
import GithubToken from './GithubToken.js';
import IssueState from './IssueState.js';
import Origin from './Origin.js';
import { LABEL_TO_TAG } from './Tags.js';

const defaultExecFileAsync = promisify(execFile);
const DEFAULT_TIMEOUT_MS = 30000;

// Reverse of Tags.js's LABEL_TO_TAG — same construction as
// AutoFixAllQueue.js's own TAG_TO_LABEL, resolving a canonical tag name
// to its exact GitHub label name for add-tag/remove-tag/has-shipit-label.
const TAG_TO_LABEL = Object.fromEntries(
  Object.entries(LABEL_TO_TAG).map(([label, tag]) => [tag, label])
);

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
   * @param {ConfigChain} [deps.configChain] - 3-tier config reader, used
   *   by `prMerge`'s body-mode/coauthors resolution.
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
    configChain = new ConfigChain(),
    execFileAsync = defaultExecFileAsync,
    fetchFn = fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS
  } = {}) {
    this._origin = origin;
    this._githubToken = githubToken;
    this._issueState = issueState;
    this._configChain = configChain;
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
   * Native implementation of `github.sh pr-merge`: squash-merges the
   * current branch's pull request, deletes its branch, and prints the
   * PR's URL. When the current branch matches `issue-<id>` and both
   * `pr_id`/`pr_url` are cached (`IssueState`), the cached number/url
   * are trusted, but the title is still re-fetched via REST (matching
   * the shell's own `gh pr view ... --json title` re-fetch in that
   * branch).
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} [modelEmail] - the acting model's commit-author
   *   email, used by `coauthors` body mode to optionally exclude its
   *   own co-author entry.
   * @returns {Promise<string>} `<url>\n`, the merged PR's URL.
   * @throws {Error} `Error: no pull request found for the current
   *   branch on <repo_ref>` when no pull request is found.
   * @throws {Error} `Error: could not merge PR #<number> on <repo_ref>`
   *   when the merge call fails.
   */
  async prMerge(repoPath, modelEmail) {
    if (!repoPath) {
      throw new Error('Usage: github.sh pr-merge <repo_path> [model_email]');
    }

    const branch = await this._currentBranch(repoPath);
    const idMatch = branch.match(/^issue-(\d+)$/);

    let cachedNumber = '';
    let cachedUrl = '';

    if (idMatch) {
      cachedNumber = await this._issueState.get(repoPath, idMatch[1], 'pr_id');
      cachedUrl = await this._issueState.get(repoPath, idMatch[1], 'pr_url');
    }

    const { repo, repoRef } = await this._resolveRepo(repoPath);
    const token = await this._githubToken.get(repoPath);
    const pull = await this._findPr(repo, branch, token, repoRef);

    const number = cachedNumber && cachedUrl ? cachedNumber : pull.number;
    const url = cachedNumber && cachedUrl ? cachedUrl : pull.html_url;
    const commitTitle = `${pull.title} (#${number})`;

    const body = await this._resolveMergeBody(repoPath, repo, number, token, modelEmail);

    try {
      await this._mergePr(repo, number, token, commitTitle, body);
    } catch {
      throw new Error(`Error: could not merge PR #${number} on ${repoRef}`);
    }

    await this._deleteBranchRef(repo, branch, token);

    return `${url}\n`;
  }

  /**
   * Native implementation of `github.sh cleanup-branch`: deletes the
   * issue's remote and local `issue-<id>` branch, then switches back to
   * `main` and resets it to `origin/main`. No `gh`/REST calls — plain
   * `git`, mirroring the shell version exactly, including the fact that
   * the shell script never redirects `git checkout main` (whose own
   * `Your branch is up to date with 'origin/main'.` status line prints
   * to stdout when `main` tracks `origin/main`, as it does here — its
   * `Switched to branch 'main'` line prints to stderr instead, and so
   * needs no forwarding), `git reset --hard`'s (`HEAD is now at <sha>
   * <subject>`), or `git branch -D`'s (`Deleted branch <branch> (was
   * <sha>).`) own stdout — all three leak straight through to
   * `cmd_cleanup_branch`'s own stdout, so this forwards them too, for
   * byte-identical parity. The remote-delete step tolerates failure
   * (matching the shell's `|| true`, e.g. when the remote branch is
   * already gone); every other step is not tolerant of failure.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} id - the numeric issue id.
   * @returns {Promise<string>} the concatenated stdout of `git checkout
   *   main`, `git reset --hard origin/main`, and `git branch -D
   *   <branch>`.
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

    const { stdout: checkoutStdout } = await this._execFileAsync('git', ['checkout', 'main'], { cwd: repoPath });
    const { stdout: resetStdout } = await this._execFileAsync('git', ['reset', '--hard', 'origin/main'], { cwd: repoPath });
    const { stdout: branchStdout } = await this._execFileAsync('git', ['branch', '-D', branch], { cwd: repoPath });

    return `${checkoutStdout}${resetStdout}${branchStdout}`;
  }

  /**
   * Native implementation of `github.sh has-shipit-label`: no stdout
   * either way, matching the shell's `grep -qiE` contract — only the
   * exit code communicates the result.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} id - the numeric issue id.
   * @returns {Promise<string>} `''` when the issue has a `shipit`
   *   label (case-insensitive, exact match).
   * @throws {DispatchFailure} with an empty stdout payload and exit
   *   code 1 when the issue's labels can't be fetched, or the issue
   *   doesn't have a `shipit` label.
   */
  async hasShipitLabel(repoPath, id) {
    if (!repoPath || !id) {
      throw new Error('Usage: github.sh has-shipit-label <repo_path> <id>');
    }

    let labels;

    try {
      const { repo } = await this._resolveRepo(repoPath);
      const token = await this._githubToken.get(repoPath);

      labels = await this._fetchLabels(id, repo, token);
    } catch {
      throw new DispatchFailure('', 1);
    }

    const hasShipit = labels.some((label) => label.toLowerCase() === 'shipit');

    if (!hasShipit) {
      throw new DispatchFailure('', 1);
    }

    return '';
  }

  /**
   * Native implementation of `github.sh add-tag`: adds a single
   * canonical tag to GitHub issue `id`, mapped to its real GitHub
   * label via `Tags.js`'s `LABEL_TO_TAG` (inverted).
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} id - the numeric issue id.
   * @param {string} tag - the canonical tag name to add.
   * @returns {Promise<string>} the resulting confirmation line — see
   *   `#_mutateTag`.
   * @throws {Error} `Error: shipit is human-only; scripts must not add
   *   or remove it` when `tag` is `shipit`.
   */
  async addTag(repoPath, id, tag) {
    if (!repoPath || !id || !tag) {
      throw new Error('Usage: github.sh add-tag <repo_path> <id> <tag>');
    }

    return this._mutateTag(repoPath, id, tag, 'add');
  }

  /**
   * Native implementation of `github.sh remove-tag`: removes a single
   * canonical tag from GitHub issue `id`, mapped to its real GitHub
   * label via `Tags.js`'s `LABEL_TO_TAG` (inverted).
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} id - the numeric issue id.
   * @param {string} tag - the canonical tag name to remove.
   * @returns {Promise<string>} the resulting confirmation line — see
   *   `#_mutateTag`.
   * @throws {Error} `Error: shipit is human-only; scripts must not add
   *   or remove it` when `tag` is `shipit`.
   */
  async removeTag(repoPath, id, tag) {
    if (!repoPath || !id || !tag) {
      throw new Error('Usage: github.sh remove-tag <repo_path> <id> <tag>');
    }

    return this._mutateTag(repoPath, id, tag, 'remove');
  }

  /**
   * Shared `addTag`/`removeTag` implementation, mirroring
   * `tag_mutate_add_label`/`tag_mutate_remove_label` exactly (same
   * shape `AutoFixAllQueue.js`'s own `_mutateTag` already established
   * for its best-effort, internal-only mutation — this version is
   * caller-facing, so failures throw instead of warning-and-continuing).
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} id - the numeric issue id.
   * @param {string} tag - the canonical tag name.
   * @param {'add'|'remove'} action - whether to add or remove the tag.
   * @returns {Promise<string>} a `Tag '<tag>' already/not present on
   *   issue #<id> — nothing to do.\n` line when no mutation was
   *   needed, or an `Added`/`Removed tag '<tag>' .../... issue #<id>
   *   on <repo_ref>\n` line once mutated.
   * @throws {Error} `Error: shipit is human-only; scripts must not add
   *   or remove it` when `tag` is `shipit`.
   * @throws {Error} `Error: could not fetch issue #<id> from <repo_ref>`
   *   when the issue's current labels can't be fetched.
   * @throws {Error} `Error: could not update issue #<id> on <repo_ref>`
   *   when the add/remove-label REST call fails.
   */
  async _mutateTag(repoPath, id, tag, action) {
    if (tag === 'shipit') {
      throw new Error('Error: shipit is human-only; scripts must not add or remove it');
    }

    const label = TAG_TO_LABEL[tag];
    const { repo, repoRef } = await this._resolveRepo(repoPath);
    const token = await this._githubToken.get(repoPath);

    let labels;

    try {
      labels = await this._fetchLabels(id, repo, token);
    } catch {
      throw new Error(`Error: could not fetch issue #${id} from ${repoRef}`);
    }

    const present = labels.includes(label);

    if (action === 'add' ? present : !present) {
      const state = action === 'add' ? 'already present on' : 'not present on';

      return `Tag '${tag}' ${state} issue #${id} — nothing to do.\n`;
    }

    try {
      if (action === 'add') {
        await this._addLabel(id, repo, token, label);
      } else {
        await this._removeLabel(id, repo, token, label);
      }
    } catch {
      throw new Error(`Error: could not update issue #${id} on ${repoRef}`);
    }

    const verb = action === 'add' ? 'Added' : 'Removed';
    const preposition = action === 'add' ? 'to' : 'from';

    return `${verb} tag '${tag}' ${preposition} issue #${id} on ${repoRef}\n`;
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

  /**
   * Native re-derivation of `merge_body.sh`'s `merge_body_mode`, built
   * on `ConfigChain#read`.
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<'empty'|'full'|'coauthors'>} the resolved mode —
   *   `empty` when absent/null, or when present but not one of the
   *   three recognized values (which also warns to stderr).
   */
  async mergeBodyMode(repoPath) {
    const value = await this._configChain.read(repoPath, 'git', 'merge_body_mode');

    if (value === 'empty' || value === 'full' || value === 'coauthors') {
      return value;
    }

    if (value !== undefined) {
      const formatted = typeof value === 'string' ? value : JSON.stringify(value);

      process.stderr.write(`Warning: unrecognized git.merge_body_mode value '${formatted}' — falling back to 'empty'.\n`);
    }

    return 'empty';
  }

  /**
   * Resolve the `commit_message` payload for the REST merge call, per
   * `mergeBodyMode`'s resolved mode.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} repo - the `owner/repo` path.
   * @param {number|string} number - the pull request number.
   * @param {string} token - the GitHub token.
   * @param {string} [modelEmail] - the acting model's commit-author
   *   email.
   * @returns {Promise<{included: boolean, body: string}>} `included:
   *   false` means "omit `commit_message` entirely" (GitHub's own
   *   default squash body applies); `included: true` carries the exact
   *   `body` string to send (possibly an empty string, for `empty`
   *   mode).
   */
  async _resolveMergeBody(repoPath, repo, number, token, modelEmail) {
    const mode = await this.mergeBodyMode(repoPath);

    if (mode === 'empty') {
      return { included: true, body: '' };
    }

    if (mode === 'full') {
      return { included: false, body: '' };
    }

    const coauthors = await this._coauthorsBody(repoPath, repo, number, token, modelEmail);

    return coauthors ? { included: true, body: coauthors } : { included: false, body: '' };
  }

  /**
   * Native re-derivation of `merge_body.sh`'s
   * `merge_body_coauthors_list`, built on `ConfigChain#read` for the
   * `omit_model_coauthor`/`remove_coauthors` config keys (see
   * `agent_email.sh`'s `model_coauthor_omitted`/`remove_coauthors_list`).
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} repo - the `owner/repo` path.
   * @param {number|string} number - the pull request number.
   * @param {string} token - the GitHub token.
   * @param {string} [modelEmail] - the acting model's commit-author
   *   email.
   * @returns {Promise<string>} the deduped `Co-authored-by: ...` block
   *   (one line per author, trailing newline), or `''` when the
   *   resulting list is empty.
   */
  async _coauthorsBody(repoPath, repo, number, token, modelEmail) {
    const commits = await this._fetchPrCommits(repo, number, token);
    const merger = await this._resolveMergerLogin(token);
    const omitModel = modelEmail ? await this._modelCoauthorOmitted(repoPath) : false;
    const removeList = await this._removeCoauthorsList(repoPath);

    const authors = commits.map((commit) => {
      const commitAuthor = commit && commit.commit && commit.commit.author;

      return {
        name: commitAuthor && commitAuthor.name,
        email: commitAuthor && commitAuthor.email,
        login: commit && commit.author && commit.author.login
      };
    });

    const withEmail = authors.filter((author) => !!author.email);
    const deduped = this._uniqueByEmail(withEmail);

    const lines = deduped
      .filter((author) => !removeList.includes(author.email))
      .filter((author) => !merger || author.login !== merger)
      .filter((author) => !omitModel || author.email !== modelEmail)
      .map((author) => `Co-authored-by: ${author.name} <${author.email}>`);

    return lines.length > 0 ? `${lines.join('\n')}\n` : '';
  }

  /**
   * Dedupe `authors` by `email`, mirroring jq's `unique_by(.email)`:
   * stably sorts by `email` ascending, then keeps the first entry for
   * each distinct email (the resulting order is sorted by email, NOT
   * original commit order — matching jq's own `unique_by` semantics
   * exactly, since the final co-author line order depends on it).
   * @param {Array<{name: string, email: string, login: string}>} authors -
   *   the candidate author entries (already filtered to a non-empty
   *   `email`).
   * @returns {Array<{name: string, email: string, login: string}>} the
   *   deduped, email-sorted list.
   */
  _uniqueByEmail(authors) {
    const sorted = authors
      .map((author, index) => ({ author, index }))
      .sort((a, b) => {
        if (a.author.email < b.author.email) {
          return -1;
        }

        if (a.author.email > b.author.email) {
          return 1;
        }

        return a.index - b.index;
      });

    const seen = new Set();
    const result = [];

    for (const { author } of sorted) {
      if (seen.has(author.email)) {
        continue;
      }

      seen.add(author.email);
      result.push(author);
    }

    return result;
  }

  /**
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<boolean>} the `git.omit_model_coauthor` config
   *   value, `true` only when it resolves to the exact JSON boolean
   *   `true` (mirroring `model_coauthor_omitted`'s `[[ "$value" ==
   *   "true" ]]` check against jq's `-c` boolean rendering).
   */
  async _modelCoauthorOmitted(repoPath) {
    const value = await this._configChain.read(repoPath, 'git', 'omit_model_coauthor');

    return value === true;
  }

  /**
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<string[]>} the `git.remove_coauthors` config
   *   array, or `[]` when absent/null/not an array.
   */
  async _removeCoauthorsList(repoPath) {
    const value = await this._configChain.read(repoPath, 'git', 'remove_coauthors');

    return Array.isArray(value) ? value : [];
  }

  /**
   * @param {string} repo - the `owner/repo` path.
   * @param {number|string} number - the pull request number.
   * @param {string} token - the GitHub token.
   * @returns {Promise<Array>} the pull request's commits (first page
   *   only, `per_page=100`), or `[]` on a malformed response.
   */
  async _fetchPrCommits(repo, number, token) {
    const response = await this._fetch(`https://api.github.com/repos/${repo}/pulls/${number}/commits?per_page=100`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(this._timeoutMs)
    });

    if (!response.ok) {
      throw new Error(`could not fetch commits for pull request #${number} in ${repo}`);
    }

    const commits = await response.json();

    return Array.isArray(commits) ? commits : [];
  }

  /**
   * Resolve the acting GitHub user's own login, replacing `gh api user
   * -q '.login'`. Fails open (returns `''`) on any error, mirroring
   * `merge_body_coauthors_list`'s own `|| merger_login=""` fallback.
   * @param {string} token - the GitHub token.
   * @returns {Promise<string>} the merger's GitHub login, or `''`.
   */
  async _resolveMergerLogin(token) {
    try {
      const response = await this._fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(this._timeoutMs)
      });

      if (!response.ok) {
        return '';
      }

      const user = await response.json();

      return user && user.login ? user.login : '';
    } catch {
      return '';
    }
  }

  /**
   * Squash-merge pull request `number` via the REST merge endpoint,
   * replacing `gh pr merge --squash --subject ... [--body ...]`.
   * @param {string} repo - the `owner/repo` path.
   * @param {number|string} number - the pull request number.
   * @param {string} token - the GitHub token.
   * @param {string} commitTitle - the squash commit's title.
   * @param {{included: boolean, body: string}} body - the resolved
   *   `commit_message` payload (see `#_resolveMergeBody`).
   * @returns {Promise<void>} resolves once the merge succeeds.
   * @throws {Error} on any non-ok response.
   */
  async _mergePr(repo, number, token, commitTitle, body) {
    const payload = { merge_method: 'squash', commit_title: commitTitle };

    if (body.included) {
      payload.commit_message = body.body;
    }

    const response = await this._fetch(`https://api.github.com/repos/${repo}/pulls/${number}/merge`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this._timeoutMs)
    });

    if (!response.ok) {
      throw new Error(`could not merge PR #${number} on ${repo}`);
    }
  }

  /**
   * Best-effort delete of `<branch>`'s remote ref, replacing `gh pr
   * merge --delete-branch` (which has no REST merge-endpoint
   * equivalent). Tolerates any failure (network error or non-ok
   * response, e.g. an already-deleted/404 ref), mirroring
   * `cleanupBranch`'s own tolerant remote-delete step.
   * @param {string} repo - the `owner/repo` path.
   * @param {string} branch - the branch name to delete.
   * @param {string} token - the GitHub token.
   * @returns {Promise<void>} resolves regardless of outcome.
   */
  async _deleteBranchRef(repo, branch, token) {
    try {
      await this._fetch(`https://api.github.com/repos/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(this._timeoutMs)
      });
    } catch {
      // best-effort — tolerate any failure.
    }
  }

  /**
   * @param {string} id - the issue id.
   * @param {string} repo - the `owner/repo` path.
   * @param {string} token - the GitHub token.
   * @returns {Promise<string[]>} the issue's current GitHub label names.
   */
  async _fetchLabels(id, repo, token) {
    const response = await this._fetch(`https://api.github.com/repos/${repo}/issues/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(this._timeoutMs)
    });

    if (!response.ok) {
      throw new Error(`could not fetch issue #${id} from ${repo}`);
    }

    const issue = await response.json();

    return (issue.labels || []).map((issueLabel) => issueLabel.name);
  }

  /**
   * @param {string} id - the issue id.
   * @param {string} repo - the `owner/repo` path.
   * @param {string} token - the GitHub token.
   * @param {string} label - the GitHub label name to add.
   * @returns {Promise<void>} resolves once added.
   */
  async _addLabel(id, repo, token, label) {
    const response = await this._fetch(`https://api.github.com/repos/${repo}/issues/${id}/labels`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ labels: [label] }),
      signal: AbortSignal.timeout(this._timeoutMs)
    });

    if (!response.ok) {
      throw new Error(`could not add label '${label}' to issue #${id} on ${repo}`);
    }
  }

  /**
   * @param {string} id - the issue id.
   * @param {string} repo - the `owner/repo` path.
   * @param {string} token - the GitHub token.
   * @param {string} label - the GitHub label name to remove.
   * @returns {Promise<void>} resolves once removed.
   */
  async _removeLabel(id, repo, token, label) {
    const response = await this._fetch(
      `https://api.github.com/repos/${repo}/issues/${id}/labels/${encodeURIComponent(label)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(this._timeoutMs)
      }
    );

    if (!response.ok) {
      throw new Error(`could not remove label '${label}' from issue #${id} on ${repo}`);
    }
  }
}

export default AutoFixAllGithub;
