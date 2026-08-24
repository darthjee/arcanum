import DispatchFailure from './DispatchFailure.js';
import GithubToken from './GithubToken.js';
import Origin from './Origin.js';
import { LABEL_TO_TAG } from './Tags.js';

const DEFAULT_TIMEOUT_MS = 30000;

// Reverse of Tags.js's LABEL_TO_TAG — resolves the 3 canonical tag
// names this module's best-effort label mutation touches
// (enqueued/ready_for_work/created) to their exact GitHub label names,
// rather than hardcoding a second copy of that mapping.
const TAG_TO_LABEL = Object.fromEntries(
  Object.entries(LABEL_TO_TAG).map(([label, tag]) => [tag, label])
);

/**
 * Generic (not `AutoFixAll`-prefixed) GitHub issue tag/label mutation
 * helper, so it can be reused by future skills outside the queue
 * context. Mirrors `tag_mutate_add_label`/`tag_mutate_remove_label`
 * exactly, including their own stdout/stderr output.
 */
class IssueTagger {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Origin} [deps.origin] - git-origin resolver.
   * @param {GithubToken} [deps.githubToken] - GitHub token resolver.
   * @param {Function} [deps.fetchFn] - `fetch`-compatible implementation
   *   (global `fetch` by default), used for the label mutation's GitHub
   *   REST calls.
   * @param {number} [deps.timeoutMs] - each REST call's abort timeout,
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
   * Best-effort: adds the `enqueued` tag and removes the
   * `ready_for_work`/`created` tags from each given issue id, mirroring
   * `_mark_enqueued` — each per-tag mutation writes its own stdout/
   * stderr lines directly (see `#mutateTag`'s doc comment). Per-tag
   * mutation failures are fully best-effort (warn and continue — see
   * `#mutateTag`), but a failure resolving the repo's origin itself is
   * NOT swallowed: `_mark_enqueued`'s own `repo_ref=$(get_repo_ref
   * "$repo_path")` command substitution, under `set -euo pipefail`,
   * aborts the whole shell script at that point (after the caller's own
   * confirmation line has already printed) whenever `repo_path` isn't a
   * git repo with an `origin` remote — so this rethrows as a
   * `DispatchFailure('', 1)` to match that exit code, deliberately with
   * an empty `.stdout` payload since the caller already wrote its own
   * confirmation line directly.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string[]} ids - the affected issue ids.
   * @returns {Promise<void>} resolves once every mutation attempt has
   *   finished.
   * @throws {DispatchFailure} with an empty stdout payload and exit
   *   code 1 when the repo's origin/GitHub token can't be resolved.
   */
  async markEnqueued(repoPath, ids) {
    let repo;
    let repoRef;
    let token;

    try {
      const resolved = await this._origin.resolve(repoPath);

      repo = resolved.repo;
      repoRef = resolved.domain === 'github.com' ? resolved.repo : `${resolved.domain}/${resolved.repo}`;
      token = await this._githubToken.get(repoPath);
    } catch {
      throw new DispatchFailure('', 1);
    }

    for (const id of ids) {
      await this.mutateTag(id, repo, repoRef, token, 'add', 'enqueued');
      await this.mutateTag(id, repo, repoRef, token, 'remove', 'ready_for_work');
      await this.mutateTag(id, repo, repoRef, token, 'remove', 'created');
    }
  }

  /**
   * Add or remove a single canonical tag's mapped GitHub label on issue
   * `id`, mirroring `tag_mutate_add_label`/`tag_mutate_remove_label`
   * exactly, including their own stdout lines (not just the caller's
   * stderr warning on failure): fetches the issue's current labels
   * (a fetch failure prints `Error: could not fetch issue #<id> from
   * <repo>` to stderr); if the label is already in the desired state,
   * prints a "nothing to do" line to stdout and stops; otherwise
   * mutates it (a mutate failure prints `Error: could not update issue
   * #<id> on <repo>` to stderr) and prints a success line to stdout. In
   * either failure case, this method's own caller-facing warning
   * (`Warning: could not add/remove '<tag>' tag ...`) is also printed
   * to stderr, exactly as `_mark_enqueued`'s `|| echo ...` does.
   * @param {string} id - the issue id.
   * @param {string} repo - the `owner/repo` path, for the REST calls.
   * @param {string} repoRef - the (possibly domain-qualified) repo
   *   reference, used in both the success/failure messages.
   * @param {string} token - the GitHub token.
   * @param {'add'|'remove'} action - whether to add or remove the tag.
   * @param {string} tag - the canonical tag name.
   * @returns {Promise<void>} resolves regardless of outcome.
   */
  async mutateTag(id, repo, repoRef, token, action, tag) {
    const label = TAG_TO_LABEL[tag];
    let labels;

    try {
      labels = await this.fetchLabels(id, repo, token);
    } catch {
      this.warnMutationFailure(action, tag, id, repoRef);

      return;
    }

    const present = labels.includes(label);

    if (action === 'add' ? present : !present) {
      const state = action === 'add' ? 'already present on' : 'not present on';

      process.stdout.write(`Tag '${tag}' ${state} issue #${id} — nothing to do.\n`);

      return;
    }

    try {
      if (action === 'add') {
        await this.addLabel(id, repo, token, label);
      } else {
        await this.removeLabel(id, repo, token, label);
      }
    } catch {
      this.warnMutationFailure(action, tag, id, repoRef);

      return;
    }

    const verb = action === 'add' ? 'Added' : 'Removed';
    const preposition = action === 'add' ? 'to' : 'from';

    process.stdout.write(`${verb} tag '${tag}' ${preposition} issue #${id} on ${repoRef}\n`);
  }

  /**
   * Prints `_mark_enqueued`'s own `|| echo "Warning: ..."` fallback
   * message to stderr for a failed tag mutation.
   * @param {'add'|'remove'} action - whether the mutation was an add
   *   or a remove.
   * @param {string} tag - the canonical tag name.
   * @param {string} id - the issue id.
   * @param {string} repoRef - the (possibly domain-qualified) repo
   *   reference.
   * @returns {void}
   */
  warnMutationFailure(action, tag, id, repoRef) {
    const preposition = action === 'add' ? 'to' : 'from';

    process.stderr.write(`Warning: could not ${action} '${tag}' tag ${preposition} issue #${id} on ${repoRef}\n`);
  }

  /**
   * @param {string} id - the issue id.
   * @param {string} repo - the `owner/repo` path.
   * @param {string} token - the GitHub token.
   * @returns {Promise<string[]>} the issue's current GitHub label names.
   */
  async fetchLabels(id, repo, token) {
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
  async addLabel(id, repo, token, label) {
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
  async removeLabel(id, repo, token, label) {
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

export default IssueTagger;
