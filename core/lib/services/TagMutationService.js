import { TAG_TO_LABEL } from '../utils/issue/Tags.js';

/**
 * Strict tag-mutation decision tree behind `github.sh add-tag`/
 * `remove-tag` — lifted verbatim in behavior from
 * `AutoFixAllGithub._mutateTag`. Unlike `IssueTagger#mutateTag` (which
 * warns-and-continues and writes its own stdout/stderr lines), this
 * throws on any failure and only ever returns a string for the dispatch
 * harness to print. Built per call (its `IssueTagger`/`RepoContext` are
 * context-bound, so can't be shared once `repoPath` varies).
 */
class TagMutationService {
  /**
   * @param {object} deps - the service's collaborators.
   * @param {import('../utils/issue/IssueTagger.js').default} deps.issueTagger -
   *   context-bound tagger; its `fetchLabels`/`addLabel`/`removeLabel`
   *   primitives are used directly.
   * @param {import('../context/RepoContext.js').default} deps.context -
   *   the same repo's context, for `repoRef` via `resolveWithRef()`.
   */
  constructor({ issueTagger, context } = {}) {
    this._issueTagger = issueTagger;
    this._context = context;
  }

  /**
   * `github.sh add-tag` — see `#_mutate`.
   * @param {string} id - the numeric issue id.
   * @param {string} tag - the canonical tag name to add.
   * @returns {Promise<string>} a "nothing to do" line, or an `Added`
   *   confirmation line once mutated.
   */
  async addTag(id, tag) {
    return this._mutate(id, tag, 'add');
  }

  /**
   * `github.sh remove-tag` — see `#_mutate`.
   * @param {string} id - the numeric issue id.
   * @param {string} tag - the canonical tag name to remove.
   * @returns {Promise<string>} a "nothing to do" line, or a `Removed`
   *   confirmation line once mutated.
   */
  async removeTag(id, tag) {
    return this._mutate(id, tag, 'remove');
  }

  /**
   * Shared `addTag`/`removeTag` implementation: throws instead of the
   * best-effort warn-and-continue `IssueTagger#mutateTag` uses, so it
   * reuses `IssueTagger`'s `fetchLabels`/`addLabel`/`removeLabel`
   * primitives directly rather than `#mutateTag` itself.
   * @param {string} id - the numeric issue id.
   * @param {string} tag - the canonical tag name.
   * @param {'add'|'remove'} action - whether to add or remove the tag.
   * @returns {Promise<string>} a "nothing to do" line, or an
   *   `Added`/`Removed` confirmation line once mutated.
   */
  async _mutate(id, tag, action) {
    if (tag === 'shipit') {
      throw new Error('Error: shipit is human-only; scripts must not add or remove it');
    }

    const label = TAG_TO_LABEL[tag];
    const { repoRef } = await this._context.resolveWithRef();

    let labels;

    try {
      labels = await this._issueTagger.fetchLabels(id);
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
        await this._issueTagger.addLabel(id, label);
      } else {
        await this._issueTagger.removeLabel(id, label);
      }
    } catch {
      throw new Error(`Error: could not update issue #${id} on ${repoRef}`);
    }

    const verb = action === 'add' ? 'Added' : 'Removed';
    const preposition = action === 'add' ? 'to' : 'from';

    return `${verb} tag '${tag}' ${preposition} issue #${id} on ${repoRef}\n`;
  }
}

export default TagMutationService;
