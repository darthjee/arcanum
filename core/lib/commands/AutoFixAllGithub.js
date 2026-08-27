import BranchCleanup from '../utils/git/BranchCleanup.js';
import DispatchFailure from '../utils/errors/DispatchFailure.js';
import GithubToken from '../utils/github/GithubToken.js';
import IssueTagger from '../utils/issue/IssueTagger.js';
import Origin from '../utils/git/Origin.js';
import PrOperations from '../utils/github/PrOperations.js';
import RepoContextFactory from '../context/RepoContextFactory.js';
import TagMutationService from '../services/TagMutationService.js';

/**
 * Native equivalent of `auto-fix-all/scripts/github.sh`'s 7 GitHub-facing
 * subcommands. A thin facade delegating PR lifecycle to a per-call
 * `PrOperations` (built from a per-call `RepoContextFactory` bundle —
 * `repoPath` differs call to call, so none of the context-bound
 * collaborators can be shared across calls), local-git branch teardown
 * to `BranchCleanup`, and tag/label mutation to `IssueTagger` — see
 * `docs/agents/plans/284-refactor-core-lib-autofixallgithub-js/`,
 * `docs/agents/plans/292-reduce-size-of-properations/`, and
 * `docs/agents/plans/294-refactor-properations/`. Kept (not removed)
 * since `AutoFixAllWaitCiAndMerge.js` instantiates it directly to call
 * `#prMerge`.
 */
class AutoFixAllGithub {
  /**
   * Builds one shared `RepoContextFactory` (from `origin`/`githubToken`/
   * `issueStateService`/`configChain`/`execFileAsync`/`fetchFn`/
   * `timeoutMs`) that `#_prOperations`/`#_issueTagger` call per request —
   * none of the context-bound collaborators are constructor-level shared
   * singletons, since a context-bound collaborator built without a
   * `context` can't resolve `repoPath`/`token`/`repo`/`repoRef` at all.
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Origin} [deps.origin] - shared git-origin resolver.
   * @param {GithubToken} [deps.githubToken] - shared GitHub token resolver.
   * @param {Function} [deps.fetchFn] - forwarded to the default
   *   `repoContextFactory` (its per-call `githubClient`/`issueClient`).
   * @param {number} [deps.timeoutMs] - forwarded to the default
   *   `repoContextFactory` (its per-call `githubClient`/`issueClient`).
   * @param {object} [deps.issueStateService] - forwarded to the default
   *   `repoContextFactory`, then to each per-call `RepoContext`.
   * @param {object} [deps.configChain] - forwarded to the default
   *   `repoContextFactory`, then to each per-call `RepoContext`.
   * @param {Function} [deps.execFileAsync] - forwarded to the default
   *   `branchCleanup`, and to the default `repoContextFactory`.
   * @param {RepoContextFactory} [deps.repoContextFactory] - builds each
   *   per-call `RepoContext` bundle (context plus context-bound
   *   clients) — see `#_prOperations`/`#_issueTagger`.
   * @param {Function} [deps.issueTaggerFactory] - builds an
   *   `IssueTagger` (used by `addTag`/`removeTag`/`hasShipitLabel`) from
   *   a per-call `RepoContext` bundle — see `#_issueTagger`. A factory,
   *   not a pre-built instance, since a context-bound `IssueTagger`
   *   can't be shared across calls once `repoPath` varies call to call.
   * @param {BranchCleanup} [deps.branchCleanup] - delegate for
   *   `cleanupBranch`.
   */
  constructor({
    origin = new Origin(),
    githubToken = new GithubToken(),
    fetchFn = fetch,
    timeoutMs,
    issueStateService,
    configChain,
    execFileAsync,
    repoContextFactory = new RepoContextFactory({
      origin,
      githubToken,
      issueStateService,
      configChain,
      execFileAsync,
      fetchFn,
      timeoutMs
    }),
    issueTaggerFactory = (bundle) => new IssueTagger({
      context: bundle.context,
      issueClient: bundle.issueClient
    }),
    branchCleanup = new BranchCleanup({ execFileAsync })
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
