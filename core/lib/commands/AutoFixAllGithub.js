import BranchCleanup from '../utils/git/BranchCleanup.js';
import DispatchFailure from '../utils/errors/DispatchFailure.js';
import Git from '../utils/git/Git.js';
import GitBranch from '../utils/git/GitBranch.js';
import GitClient from '../utils/git/GitClient.js';
import GitHubClient from '../utils/github/GitHubClient.js';
import GithubToken from '../utils/github/GithubToken.js';
import IssueClient from '../utils/github/IssueClient.js';
import IssueTagger from '../utils/issue/IssueTagger.js';
import Origin from '../utils/git/Origin.js';
import PrOperations from '../utils/github/PrOperations.js';
import RepoContext from '../context/RepoContext.js';
import { TAG_TO_LABEL } from '../utils/issue/Tags.js';

/**
 * Native equivalent of `auto-fix-all/scripts/github.sh`'s 7 GitHub-facing
 * subcommands. A thin facade delegating PR lifecycle to a per-call
 * `PrOperations` (built from a per-call `RepoContext`, plus a fresh
 * context-bound `gitClient`/`githubClient` pair — `repoPath` differs
 * call to call, so none of `RepoContext`/`GitClient`/`GitHubClient` can
 * be shared across calls once `GitClient`/`GitHubClient` become
 * context-bound), local-git branch teardown to `BranchCleanup`, and
 * tag/label mutation to `IssueTagger` — see
 * `docs/agents/plans/284-refactor-core-lib-autofixallgithub-js/`,
 * `docs/agents/plans/292-reduce-size-of-properations/`, and
 * `docs/agents/plans/294-refactor-properations/`. Kept (not removed)
 * since `AutoFixAllWaitCiAndMerge.js` instantiates it directly to call
 * `#prMerge`.
 */
class AutoFixAllGithub {
  /**
   * Builds and shares one `origin`/`githubToken` pair across every
   * per-call collaborator, keeping `execFileAsync`/`fetchFn`/`timeoutMs`
   * around only to forward into each call's fresh, context-bound
   * `gitClient`/`githubClient` pair (built by `#_prOperations`) and
   * `issueTagger` (built by `#_issueTagger`) — none of those are
   * constructor-level shared singletons, since a context-bound
   * collaborator built without a `context` can't resolve `repoPath`/
   * `token`/`repo`/`repoRef` at all.
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Origin} [deps.origin] - shared git-origin resolver.
   * @param {GithubToken} [deps.githubToken] - shared GitHub token resolver.
   * @param {Function} [deps.fetchFn] - forwarded to the default
   *   `issueTaggerFactory`, and to each per-call `githubClient`.
   * @param {number} [deps.timeoutMs] - forwarded to the default
   *   `issueTaggerFactory`, and to each per-call `githubClient`.
   * @param {object} [deps.issueStateService] - forwarded to each
   *   per-call `RepoContext`.
   * @param {object} [deps.configChain] - forwarded to each per-call
   *   `RepoContext`.
   * @param {Function} [deps.execFileAsync] - forwarded to the default
   *   `branchCleanup`, and to each per-call `gitClient`.
   * @param {Function} [deps.issueTaggerFactory] - builds an
   *   `IssueTagger` (used by `addTag`/`removeTag`/`hasShipitLabel`) from
   *   a per-call `RepoContext` — see `#_issueTagger`. A factory, not a
   *   pre-built instance, since a context-bound `IssueTagger` can't be
   *   shared across calls once `repoPath` varies call to call.
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
    issueTaggerFactory = (context) => new IssueTagger({
      context,
      issueClient: new IssueClient({ context, fetchFn, timeoutMs })
    }),
    branchCleanup = new BranchCleanup({ execFileAsync })
  } = {}) {
    this._origin = origin;
    this._githubToken = githubToken;
    this._issueStateService = issueStateService;
    this._configChain = configChain;
    this._issueTaggerFactory = issueTaggerFactory;
    this._fetchFn = fetchFn;
    this._timeoutMs = timeoutMs;
    this._execFileAsync = execFileAsync;
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
   * Build a per-call `PrOperations`, wrapping `repoPath` (plus the
   * shared `origin`/`githubToken`/`issueStateService`/`configChain`)
   * into a fresh `RepoContext`, and building a fresh, context-bound
   * `gitClient`/`githubClient` pair right alongside it — both are cheap,
   * stateless-construction objects (no I/O in their constructors), so
   * building them per call has no meaningful cost.
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {PrOperations} the per-call `PrOperations` facade.
   */
  _prOperations(repoPath) {
    const context = new RepoContext({
      repoPath,
      origin: this._origin,
      githubToken: this._githubToken,
      issueStateService: this._issueStateService,
      configChain: this._configChain
    });
    const gitClient = new GitClient({ context, execFileAsync: this._execFileAsync });
    const gitBranch = new GitBranch({ context, gitClient });
    const git = new Git({ context, gitBranch });
    const githubClient = new GitHubClient({ context, fetchFn: this._fetchFn, timeoutMs: this._timeoutMs });

    return new PrOperations({ context, gitClient, gitBranch, git, githubClient });
  }

  /**
   * Build a per-call `IssueTagger`, wrapping `repoPath` (plus the shared
   * `origin`/`githubToken`/`issueStateService`/`configChain`) into a
   * fresh `RepoContext` — mirroring `#_prOperations`'s own per-call
   * context construction, since a context-bound `IssueTagger` can't be a
   * constructor-level shared singleton once `repoPath` varies call to
   * call.
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {IssueTagger} the per-call `IssueTagger` delegate.
   */
  _issueTagger(repoPath) {
    const context = new RepoContext({
      repoPath,
      origin: this._origin,
      githubToken: this._githubToken,
      issueStateService: this._issueStateService,
      configChain: this._configChain
    });

    return this._issueTaggerFactory(context);
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
   * `github.sh add-tag` — see `#_mutateTag`.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} id - the numeric issue id.
   * @param {string} tag - the canonical tag name to add.
   * @returns {Promise<string>} the resulting confirmation line.
   */
  async addTag(repoPath, id, tag) {
    if (!repoPath || !id || !tag) {
      throw new Error('Usage: github.sh add-tag <repo_path> <id> <tag>');
    }

    return this._mutateTag(repoPath, id, tag, 'add');
  }

  /**
   * `github.sh remove-tag` — see `#_mutateTag`.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} id - the numeric issue id.
   * @param {string} tag - the canonical tag name to remove.
   * @returns {Promise<string>} the resulting confirmation line.
   */
  async removeTag(repoPath, id, tag) {
    if (!repoPath || !id || !tag) {
      throw new Error('Usage: github.sh remove-tag <repo_path> <id> <tag>');
    }

    return this._mutateTag(repoPath, id, tag, 'remove');
  }

  /**
   * Shared `addTag`/`removeTag` implementation: throws instead of the
   * best-effort warn-and-continue `IssueTagger#mutateTag` uses, so it
   * reuses `IssueTagger`'s `fetchLabels`/`addLabel`/`removeLabel`
   * primitives directly rather than `#mutateTag` itself.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} id - the numeric issue id.
   * @param {string} tag - the canonical tag name.
   * @param {'add'|'remove'} action - whether to add or remove the tag.
   * @returns {Promise<string>} a "nothing to do" line, or an
   *   `Added`/`Removed` confirmation line once mutated.
   */
  async _mutateTag(repoPath, id, tag, action) {
    if (tag === 'shipit') {
      throw new Error('Error: shipit is human-only; scripts must not add or remove it');
    }

    const label = TAG_TO_LABEL[tag];
    const { repoRef } = await this._origin.resolveWithRef(repoPath);
    const issueTagger = this._issueTagger(repoPath);

    let labels;

    try {
      labels = await issueTagger.fetchLabels(id);
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
        await issueTagger.addLabel(id, label);
      } else {
        await issueTagger.removeLabel(id, label);
      }
    } catch {
      throw new Error(`Error: could not update issue #${id} on ${repoRef}`);
    }

    const verb = action === 'add' ? 'Added' : 'Removed';
    const preposition = action === 'add' ? 'to' : 'from';

    return `${verb} tag '${tag}' ${preposition} issue #${id} on ${repoRef}\n`;
  }
}

export default AutoFixAllGithub;
