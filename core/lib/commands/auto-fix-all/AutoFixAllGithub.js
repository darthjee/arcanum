import BranchCleanup from '../../utils/git/BranchCleanup.js';
import DispatchFailure from '../../utils/errors/DispatchFailure.js';
import IssueTagger from '../../utils/issue/IssueTagger.js';
import PrOperations from '../../utils/github/PrOperations.js';
import RepoContextFactory from '../../context/RepoContextFactory.js';
import TagMutationService from '../../services/TagMutationService.js';

/**
 * Native equivalent of `auto-fix-all/scripts/github.sh`'s 7 GitHub-facing
 * subcommands. A thin facade over just three collaborators: a
 * `RepoContextFactory` that wraps the constructor-injected `RepoContext`
 * into a per-call bundle via `buildFromContext` (PR lifecycle goes
 * through a per-call `PrOperations`, tag/label mutation through a
 * per-call `TagMutationService`, both built off that bundle — the
 * context-bound pieces are rebuilt per call, but always off the same
 * `RepoContext`), an `issueTaggerFactory` for the per-call `IssueTagger`
 * (`hasShipitLabel` plus the tag-mutation service), and a
 * `BranchCleanup` for local-git branch teardown — see
 * `docs/agents/plans/284-refactor-core-lib-autofixallgithub-js/`,
 * `docs/agents/plans/292-reduce-size-of-properations/`,
 * `docs/agents/plans/294-refactor-properations/`, and
 * `docs/agents/plans/304-refactor-autofixallgithub-to-extract-responsibilities/`.
 * Kept (not removed) since `AutoFixAllWaitCiAndMerge.js` instantiates it
 * directly (now with a `repoContext`) to call `#prMerge`.
 */
class AutoFixAllGithub {
  /**
   * @param {import('../context/RepoContext.js').default} repoContext -
   *   the target repo's context (provides `repoPath` plus the low-level
   *   `origin`/`githubToken`/`issueStateService`/`configChain` wiring the
   *   per-call bundle is built off via `buildFromContext`).
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {RepoContextFactory} [deps.repoContextFactory] - wraps the
   *   injected `RepoContext` into a per-call bundle (context plus
   *   context-bound clients) via `buildFromContext` — see
   *   `#_prOperations`/`#_issueTagger`/`#_tagMutationService`. Only its
   *   `execFileAsync`/`fetchFn`/`timeoutMs` knobs are consulted on this
   *   path.
   * @param {Function} [deps.issueTaggerFactory] - builds an
   *   `IssueTagger` (used by `addTag`/`removeTag`/`hasShipitLabel`) from
   *   a per-call `RepoContext` bundle — see `#_issueTagger`. A factory,
   *   not a pre-built instance, since the context-bound `IssueTagger` is
   *   rebuilt per call.
   * @param {BranchCleanup} [deps.branchCleanup] - delegate for
   *   `cleanupBranch`.
   */
  constructor(repoContext, {
    repoContextFactory = new RepoContextFactory(),
    issueTaggerFactory = (bundle) => new IssueTagger({
      context: bundle.context,
      issueClient: bundle.issueClient
    }),
    branchCleanup = new BranchCleanup()
  } = {}) {
    this._repoContext = repoContext;
    this._repoContextFactory = repoContextFactory;
    this._issueTaggerFactory = issueTaggerFactory;
    this._branchCleanup = branchCleanup;
  }

  /**
   * `github.sh pr-number` — see `PrOperations#prNumber`.
   * @returns {Promise<string>} `<number>\n`.
   */
  async prNumber() {
    if (!this._repoContext.repoPath) {
      throw new Error('Usage: github.sh pr-number <repo_path>');
    }

    return this._prOperations().prNumber();
  }

  /**
   * `github.sh pr-state` — see `PrOperations#prState`.
   * @returns {Promise<string>} `STATE=<OPEN|MERGED|CLOSED>\n`.
   */
  async prState() {
    if (!this._repoContext.repoPath) {
      throw new Error('Usage: github.sh pr-state <repo_path>');
    }

    return this._prOperations().prState();
  }

  /**
   * `github.sh pr-merge` — see `PrOperations#prMerge`.
   * @param {string} [modelEmail] - the acting model's commit email.
   * @returns {Promise<string>} `<url>\n`, the merged PR's URL.
   */
  async prMerge(modelEmail) {
    if (!this._repoContext.repoPath) {
      throw new Error('Usage: github.sh pr-merge <repo_path> [model_email]');
    }

    return this._prOperations().prMerge(modelEmail);
  }

  /**
   * Build a per-call `PrOperations` by wrapping the injected
   * `RepoContext` into a `RepoContextFactory` bundle (its `context` plus
   * a context-bound `gitClient`/`gitBranch`/`git`/`githubClient` — the
   * extra `issueClient` key is ignored by `PrOperations`). The bundle is
   * cheap, zero-I/O construction, so building it per call has no
   * meaningful cost.
   * @returns {PrOperations} the per-call `PrOperations` facade.
   */
  _prOperations() {
    return new PrOperations(this._repoContextFactory.buildFromContext(this._repoContext));
  }

  /**
   * Build a per-call `IssueTagger` by handing the `issueTaggerFactory` a
   * `RepoContextFactory` bundle wrapping the injected `RepoContext` (it
   * reads `.context`/`.issueClient` off it) — the context-bound
   * `IssueTagger` is rebuilt per call rather than shared.
   * @returns {IssueTagger} the per-call `IssueTagger` delegate.
   */
  _issueTagger() {
    return this._issueTaggerFactory(this._repoContextFactory.buildFromContext(this._repoContext));
  }

  /**
   * Build a per-call `TagMutationService` from a `RepoContextFactory`
   * bundle wrapping the injected `RepoContext` — its context-bound
   * `IssueTagger` (via `issueTaggerFactory`) and `RepoContext` are
   * rebuilt per call rather than shared.
   * @returns {TagMutationService} the per-call tag-mutation service.
   */
  _tagMutationService() {
    const bundle = this._repoContextFactory.buildFromContext(this._repoContext);

    return new TagMutationService({
      issueTagger: this._issueTaggerFactory(bundle),
      context: bundle.context
    });
  }

  /**
   * `github.sh cleanup-branch` — see `BranchCleanup#cleanupBranch`.
   * @param {string} id - the numeric issue id.
   * @returns {Promise<string>} the concatenated git stdout.
   */
  cleanupBranch(id) {
    return this._branchCleanup.cleanupBranch(this._repoContext.repoPath, id);
  }

  /**
   * `github.sh has-shipit-label`: wraps `IssueTagger#hasLabel` with the
   * caller-facing `DispatchFailure('', 1)` around any failure (repo/
   * token/label-fetch) or an absent label — `IssueTagger#hasLabel`
   * itself only throws a plain `Error`, so this facade owns that
   * conversion.
   * @param {string} id - the numeric issue id.
   * @returns {Promise<string>} `''` when the issue has a `shipit` label.
   */
  async hasShipitLabel(id) {
    if (!this._repoContext.repoPath || !id) {
      throw new Error('Usage: github.sh has-shipit-label <repo_path> <id>');
    }

    let hasShipit;

    try {
      hasShipit = await this._issueTagger().hasLabel(id, 'shipit');
    } catch {
      throw new DispatchFailure('', 1);
    }

    if (!hasShipit) {
      throw new DispatchFailure('', 1);
    }

    return '';
  }

  /**
   * `github.sh add-tag` — see `TagMutationService#addTag`.
   * @param {string} id - the numeric issue id.
   * @param {string} tag - the canonical tag name to add.
   * @returns {Promise<string>} the resulting confirmation line.
   */
  async addTag(id, tag) {
    if (!this._repoContext.repoPath || !id || !tag) {
      throw new Error('Usage: github.sh add-tag <repo_path> <id> <tag>');
    }

    return this._tagMutationService().addTag(id, tag);
  }

  /**
   * `github.sh remove-tag` — see `TagMutationService#removeTag`.
   * @param {string} id - the numeric issue id.
   * @param {string} tag - the canonical tag name to remove.
   * @returns {Promise<string>} the resulting confirmation line.
   */
  async removeTag(id, tag) {
    if (!this._repoContext.repoPath || !id || !tag) {
      throw new Error('Usage: github.sh remove-tag <repo_path> <id> <tag>');
    }

    return this._tagMutationService().removeTag(id, tag);
  }
}

export default AutoFixAllGithub;
