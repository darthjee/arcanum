import BranchCleanup from '../utils/git/BranchCleanup.js';
import DispatchFailure from '../utils/errors/DispatchFailure.js';
import IssueTagger from '../utils/issue/IssueTagger.js';
import PrOperations from '../utils/github/PrOperations.js';
import RepoContextFactory from '../context/RepoContextFactory.js';
import TagMutationService from '../services/TagMutationService.js';

/**
 * Native equivalent of `auto-fix-all/scripts/github.sh`'s 7 GitHub-facing
 * subcommands. A thin facade over just three collaborators: a
 * `RepoContextFactory` that builds each per-call `RepoContext` bundle
 * (PR lifecycle goes through a per-call `PrOperations`, tag/label
 * mutation through a per-call `TagMutationService`, both built off that
 * bundle — `repoPath` differs call to call, so none of the context-bound
 * pieces can be shared), an `issueTaggerFactory` for the per-call
 * `IssueTagger` (`hasShipitLabel` plus the tag-mutation service), and a
 * `BranchCleanup` for local-git branch teardown — see
 * `docs/agents/plans/284-refactor-core-lib-autofixallgithub-js/`,
 * `docs/agents/plans/292-reduce-size-of-properations/`,
 * `docs/agents/plans/294-refactor-properations/`, and
 * `docs/agents/plans/304-refactor-autofixallgithub-to-extract-responsibilities/`.
 * Kept (not removed) since `AutoFixAllWaitCiAndMerge.js` instantiates it
 * directly to call `#prMerge`.
 */
class AutoFixAllGithub {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {RepoContextFactory} [deps.repoContextFactory] - builds each
   *   per-call `RepoContext` bundle (context plus context-bound
   *   clients) — see `#_prOperations`/`#_issueTagger`/
   *   `#_tagMutationService`. Owns the low-level `origin`/`githubToken`/
   *   `issueStateService`/`configChain`/`execFileAsync`/`fetchFn`/
   *   `timeoutMs` wiring.
   * @param {Function} [deps.issueTaggerFactory] - builds an
   *   `IssueTagger` (used by `addTag`/`removeTag`/`hasShipitLabel`) from
   *   a per-call `RepoContext` bundle — see `#_issueTagger`. A factory,
   *   not a pre-built instance, since a context-bound `IssueTagger`
   *   can't be shared across calls once `repoPath` varies call to call.
   * @param {BranchCleanup} [deps.branchCleanup] - delegate for
   *   `cleanupBranch`.
   */
  constructor({
    repoContextFactory = new RepoContextFactory(),
    issueTaggerFactory = (bundle) => new IssueTagger({
      context: bundle.context,
      issueClient: bundle.issueClient
    }),
    branchCleanup = new BranchCleanup()
  } = {}) {
    this._repoContextFactory = repoContextFactory;
    this._issueTaggerFactory = issueTaggerFactory;
    this._branchCleanup = branchCleanup;
  }

  /**
   * `github.sh pr-number` — see `PrOperations#prNumber`.
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<string>} `<number>\n`.
   */
  async prNumber(repoPath) {
    if (!repoPath) {
      throw new Error('Usage: github.sh pr-number <repo_path>');
    }

    return this._prOperations(repoPath).prNumber();
  }

  /**
   * `github.sh pr-state` — see `PrOperations#prState`.
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<string>} `STATE=<OPEN|MERGED|CLOSED>\n`.
   */
  async prState(repoPath) {
    if (!repoPath) {
      throw new Error('Usage: github.sh pr-state <repo_path>');
    }

    return this._prOperations(repoPath).prState();
  }

  /**
   * `github.sh pr-merge` — see `PrOperations#prMerge`.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} [modelEmail] - the acting model's commit email.
   * @returns {Promise<string>} `<url>\n`, the merged PR's URL.
   */
  async prMerge(repoPath, modelEmail) {
    if (!repoPath) {
      throw new Error('Usage: github.sh pr-merge <repo_path> [model_email]');
    }

    return this._prOperations(repoPath).prMerge(modelEmail);
  }

  /**
   * Build a per-call `PrOperations` from a fresh `RepoContextFactory`
   * bundle (its `context` plus a context-bound `gitClient`/`gitBranch`/
   * `git`/`githubClient` — the extra `issueClient` key is ignored by
   * `PrOperations`). The whole bundle is cheap, zero-I/O construction,
   * so building it per call has no meaningful cost.
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {PrOperations} the per-call `PrOperations` facade.
   */
  _prOperations(repoPath) {
    return new PrOperations(this._repoContextFactory.build(repoPath));
  }

  /**
   * Build a per-call `IssueTagger` by handing the `issueTaggerFactory` a
   * fresh `RepoContextFactory` bundle (it reads `.context`/
   * `.issueClient` off it), since a context-bound `IssueTagger` can't be
   * a constructor-level shared singleton once `repoPath` varies call to
   * call.
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {IssueTagger} the per-call `IssueTagger` delegate.
   */
  _issueTagger(repoPath) {
    return this._issueTaggerFactory(this._repoContextFactory.build(repoPath));
  }

  /**
   * Build a per-call `TagMutationService` from a fresh
   * `RepoContextFactory` bundle — its context-bound `IssueTagger`
   * (via `issueTaggerFactory`) and `RepoContext` can't be shared once
   * `repoPath` varies call to call.
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {TagMutationService} the per-call tag-mutation service.
   */
  _tagMutationService(repoPath) {
    const bundle = this._repoContextFactory.build(repoPath);

    return new TagMutationService({
      issueTagger: this._issueTaggerFactory(bundle),
      context: bundle.context
    });
  }

  /**
   * `github.sh cleanup-branch` — see `BranchCleanup#cleanupBranch`.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} id - the numeric issue id.
   * @returns {Promise<string>} the concatenated git stdout.
   */
  cleanupBranch(repoPath, id) {
    return this._branchCleanup.cleanupBranch(repoPath, id);
  }

  /**
   * `github.sh has-shipit-label`: wraps `IssueTagger#hasLabel` with the
   * caller-facing `DispatchFailure('', 1)` around any failure (repo/
   * token/label-fetch) or an absent label — `IssueTagger#hasLabel`
   * itself only throws a plain `Error`, so this facade owns that
   * conversion.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} id - the numeric issue id.
   * @returns {Promise<string>} `''` when the issue has a `shipit` label.
   */
  async hasShipitLabel(repoPath, id) {
    if (!repoPath || !id) {
      throw new Error('Usage: github.sh has-shipit-label <repo_path> <id>');
    }

    let hasShipit;

    try {
      hasShipit = await this._issueTagger(repoPath).hasLabel(id, 'shipit');
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
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} id - the numeric issue id.
   * @param {string} tag - the canonical tag name to add.
   * @returns {Promise<string>} the resulting confirmation line.
   */
  async addTag(repoPath, id, tag) {
    if (!repoPath || !id || !tag) {
      throw new Error('Usage: github.sh add-tag <repo_path> <id> <tag>');
    }

    return this._tagMutationService(repoPath).addTag(id, tag);
  }

  /**
   * `github.sh remove-tag` — see `TagMutationService#removeTag`.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} id - the numeric issue id.
   * @param {string} tag - the canonical tag name to remove.
   * @returns {Promise<string>} the resulting confirmation line.
   */
  async removeTag(repoPath, id, tag) {
    if (!repoPath || !id || !tag) {
      throw new Error('Usage: github.sh remove-tag <repo_path> <id> <tag>');
    }

    return this._tagMutationService(repoPath).removeTag(id, tag);
  }
}

export default AutoFixAllGithub;
