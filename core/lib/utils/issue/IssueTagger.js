import DispatchFailure from '../errors/DispatchFailure.js';
import IssueClient from '../github/IssueClient.js';
import { TAG_TO_LABEL } from './Tags.js';

/**
 * Generic (not `AutoFixAll`-prefixed) GitHub issue tag/label mutation
 * helper, so it can be reused by future skills outside the queue
 * context. Mirrors `tag_mutate_add_label`/`tag_mutate_remove_label`
 * exactly, including their own stdout/stderr output. `RepoContext`-bound
 * (`repo`/`token` resolved internally via `this._context`/
 * `this._issueClient`, not taken as method parameters), mirroring
 * `PrOperations`'s conversion to `GitHubClient`.
 */
class IssueTagger {
  /**
   * @param {object} deps - the tagger's collaborators.
   * @param {import('../../context/RepoContext.js').default} deps.context -
   *   the target repo's context, for `repo`/`repoRef`/`token` resolution.
   * @param {IssueClient} [deps.issueClient] - the label mutation's
   *   GitHub REST delegate.
   */
  constructor({ context, issueClient = new IssueClient({ context }) } = {}) {
    this._context = context;
    this._issueClient = issueClient;
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
   * @param {string[]} ids - the affected issue ids.
   * @returns {Promise<void>} resolves once every mutation attempt has
   *   finished.
   * @throws {DispatchFailure} with an empty stdout payload and exit
   *   code 1 when the repo's origin/GitHub token can't be resolved.
   */
  async markEnqueued(ids) {
    let repoRef;

    try {
      const resolved = await this._context.resolveWithRef();

      repoRef = resolved.repoRef;
      await this._context.getToken();
    } catch {
      throw new DispatchFailure('', 1);
    }

    for (const id of ids) {
      await this.mutateTag(id, repoRef, 'add', 'enqueued');
      await this.mutateTag(id, repoRef, 'remove', 'ready_for_work');
      await this.mutateTag(id, repoRef, 'remove', 'created');
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
   * @param {string} repoRef - the (possibly domain-qualified) repo
   *   reference, used in both the success/failure messages.
   * @param {'add'|'remove'} action - whether to add or remove the tag.
   * @param {string} tag - the canonical tag name.
   * @returns {Promise<void>} resolves regardless of outcome.
   */
  async mutateTag(id, repoRef, action, tag) {
    const label = TAG_TO_LABEL[tag];
    let labels;

    try {
      labels = await this.fetchLabels(id);
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
        await this.addLabel(id, label);
      } else {
        await this.removeLabel(id, label);
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
   * @returns {Promise<string[]>} the issue's current GitHub label names.
   */
  async fetchLabels(id) {
    const issue = await this._issueClient.getIssue(id);

    return (issue.labels || []).map((issueLabel) => issueLabel.name);
  }

  /**
   * @param {string} id - the issue id.
   * @param {string} label - the GitHub label name to add.
   * @returns {Promise<void>} resolves once added.
   */
  async addLabel(id, label) {
    await this._issueClient.addLabel(id, label);
  }

  /**
   * @param {string} id - the issue id.
   * @param {string} label - the GitHub label name to remove.
   * @returns {Promise<void>} resolves once removed.
   */
  async removeLabel(id, label) {
    await this._issueClient.removeLabel(id, label);
  }

  /**
   * Case-insensitive, exact-match check for whether issue `id` carries
   * `label`, reusing `#fetchLabels` — symmetric with `#addLabel`/
   * `#removeLabel`. Throws a plain `Error` (not `DispatchFailure`) on a
   * failed fetch, matching its siblings; callers needing a
   * `DispatchFailure('', 1)` wrap this themselves.
   * @param {string} id - the issue id.
   * @param {string} label - the GitHub label name to check for.
   * @returns {Promise<boolean>} `true` when the issue has `label`
   *   (case-insensitive, exact match).
   */
  async hasLabel(id, label) {
    const labels = await this.fetchLabels(id);

    return labels.some((current) => current.toLowerCase() === label.toLowerCase());
  }
}

export default IssueTagger;
