import RepoContextFactory from '../../context/RepoContextFactory.js';
import TagMutationService, { defaultIssueTaggerFactory } from '../../services/TagMutationService.js';

/**
 * Native equivalent of `monitor-issues/scripts/github_remove_tag_shell.sh`
 * (`github.sh remove-tag`). Shares its tag-mutation logic with
 * `AutoFixAllGithub#removeTag` through
 * `TagMutationService.fromRepoContext`. The shell's `_ensure_gh_user`
 * (`gh auth switch` to `user.ghuser`) happens as part of token
 * resolution (`GithubToken#get`).
 */
class MonitorIssuesGithub {
  /**
   * @param {import('../../context/RepoContext.js').default} repoContext -
   *   the target repo's context.
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {RepoContextFactory} [deps.repoContextFactory] - builds the
   *   per-call bundle the tag-mutation service is built off.
   * @param {(bundle: object) => object} [deps.issueTaggerFactory] - builds the
   *   `IssueTagger` from that bundle.
   */
  constructor(repoContext, {
    repoContextFactory = new RepoContextFactory(),
    issueTaggerFactory = defaultIssueTaggerFactory
  } = {}) {
    this._repoContext = repoContext;
    this._repoContextFactory = repoContextFactory;
    this._issueTaggerFactory = issueTaggerFactory;
  }

  /**
   * `github.sh remove-tag` — see `TagMutationService#removeTag`.
   * @param {string} id - the numeric issue id.
   * @param {string} tag - the canonical tag name to remove.
   * @returns {Promise<string>} the resulting confirmation line.
   * @throws {Error} the usage line when `repoPath`/`id`/`tag` is missing.
   */
  async removeTag(id, tag) {
    if (!this._repoContext.repoPath || !id || !tag) {
      throw new Error('Usage: github.sh remove-tag <repo_path> <id> <tag>');
    }

    return TagMutationService.fromRepoContext(this._repoContext, {
      repoContextFactory: this._repoContextFactory,
      issueTaggerFactory: this._issueTaggerFactory
    }).removeTag(id, tag);
  }
}

export default MonitorIssuesGithub;
