import BranchCleanup from '../utils/git/BranchCleanup.js';
import DispatchFailure from '../utils/errors/DispatchFailure.js';
import GitClient from '../utils/git/GitClient.js';
import GitHubClient from '../utils/github/GitHubClient.js';
import GithubToken from '../utils/github/GithubToken.js';
import IssueTagger from '../utils/issue/IssueTagger.js';
import Origin from '../utils/git/Origin.js';
import PrOperations from '../utils/github/PrOperations.js';
import RepoContext from '../context/RepoContext.js';
import { TAG_TO_LABEL } from '../utils/issue/Tags.js';

/**
 * Native equivalent of `auto-fix-all/scripts/github.sh`'s 7 GitHub-facing
 * subcommands. A thin facade delegating PR lifecycle to a per-call
 * `PrOperations` (built from a per-call `RepoContext` plus the shared
 * `gitClient`/`githubClient` singletons — `repoPath` differs call to
 * call, so `RepoContext` can't be built once per instance), local-git
 * branch teardown to `BranchCleanup`, and tag/label mutation to
 * `IssueTagger` — see `docs/agents/plans/284-refactor-core-lib-autofixallgithub-js/`
 * and `docs/agents/plans/292-reduce-size-of-properations/`. Kept (not
 * removed) since `AutoFixAllWaitCiAndMerge.js` instantiates it directly
 * to call `#prMerge`.
 */
class AutoFixAllGithub {
  /**
   * Builds and shares one `origin`/`githubToken` pair across the
   * default `issueTagger`, and one `gitClient`/`githubClient` pair
   * across every per-call `PrOperations`, rather than letting each
   * default its own.
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Origin} [deps.origin] - shared git-origin resolver.
   * @param {GithubToken} [deps.githubToken] - shared GitHub token resolver.
   * @param {Function} [deps.fetchFn] - forwarded to the default
   *   `issueTagger`/`githubClient`.
   * @param {number} [deps.timeoutMs] - forwarded to the default
   *   `issueTagger`/`githubClient`.
   * @param {object} [deps.issueState] - forwarded to each per-call
   *   `RepoContext`.
   * @param {object} [deps.configChain] - forwarded to each per-call
   *   `RepoContext`.
   * @param {Function} [deps.execFileAsync] - forwarded to the default
   *   `gitClient`/`branchCleanup`.
   * @param {IssueTagger} [deps.issueTagger] - delegate for `addTag`/
   *   `removeTag`/`hasShipitLabel`.
   * @param {GitClient} [deps.gitClient] - shared git CLI client, forwarded
   *   to each per-call `PrOperations`.
   * @param {GitHubClient} [deps.githubClient] - shared GitHub REST
   *   client, forwarded to each per-call `PrOperations`.
   * @param {BranchCleanup} [deps.branchCleanup] - delegate for
   *   `cleanupBranch`.
   */
  constructor({
    origin = new Origin(),
    githubToken = new GithubToken(),
    fetchFn = fetch,
    timeoutMs,
    issueState,
    configChain,
    execFileAsync,
    issueTagger = new IssueTagger({ origin, githubToken, fetchFn, timeoutMs }),
    gitClient = new GitClient({ execFileAsync }),
    githubClient = new GitHubClient({ fetchFn, timeoutMs }),
    branchCleanup = new BranchCleanup({ execFileAsync })
  } = {}) {
    this._origin = origin;
    this._githubToken = githubToken;
    this._issueState = issueState;
    this._configChain = configChain;
    this._issueTagger = issueTagger;
    this._gitClient = gitClient;
    this._githubClient = githubClient;
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
   * shared `origin`/`githubToken`/`issueState`/`configChain`) into a
   * fresh `RepoContext` and forwarding the shared `gitClient`/
   * `githubClient` singletons.
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {PrOperations} the per-call `PrOperations` facade.
   */
  _prOperations(repoPath) {
    const context = new RepoContext({
      repoPath,
      origin: this._origin,
      githubToken: this._githubToken,
      issueState: this._issueState,
      configChain: this._configChain
    });

    return new PrOperations({ context, gitClient: this._gitClient, githubClient: this._githubClient });
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
      const { repo } = await this._origin.resolve(repoPath);
      const token = await this._githubToken.get(repoPath);

      hasShipit = await this._issueTagger.hasLabel(id, repo, token, 'shipit');
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
    const { repo, repoRef } = await this._origin.resolveWithRef(repoPath);
    const token = await this._githubToken.get(repoPath);

    let labels;

    try {
      labels = await this._issueTagger.fetchLabels(id, repo, token);
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
        await this._issueTagger.addLabel(id, repo, token, label);
      } else {
        await this._issueTagger.removeLabel(id, repo, token, label);
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
