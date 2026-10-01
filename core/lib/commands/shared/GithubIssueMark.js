import IssueTagger from '../../utils/issue/IssueTagger.js';

/**
 * Per-subcommand tag transition table, mirroring `github_issue_shell.sh`'s
 * `cmd_mark_*` functions exactly: each of `adds` is added first, then
 * each of `removes` is removed, in order.
 * @type {Readonly<Record<string, {adds: string[], removes: string[]}>>}
 */
export const MARK_TRANSITIONS = Object.freeze({
  created: Object.freeze({ adds: Object.freeze(['created']), removes: Object.freeze(['idea', 'writting', 'enhancing']) }),
  refined: Object.freeze({ adds: Object.freeze(['refined']), removes: Object.freeze(['created', 'idea', 'writting']) }),
  ready: Object.freeze({ adds: Object.freeze(['ready']), removes: Object.freeze(['refined']) }),
  enhancing: Object.freeze({ adds: Object.freeze(['enhancing']), removes: Object.freeze(['idea', 'writting']) }),
  planning: Object.freeze({ adds: Object.freeze(['planning']), removes: Object.freeze(['idea', 'writting', 'created']) }),
  split: Object.freeze({ adds: Object.freeze(['split', 'epic']), removes: Object.freeze(['planning']) })
});

/**
 * Native equivalent of `github_issue_shell.sh`'s six `cmd_mark_*`
 * functions (the `github-issue-mark-created` / `-refined` / `-ready` /
 * `-enhancing` / `-planning` / `-split` migrated entrypoints). Every
 * subcommand shares one table-driven implementation (`#mark`); the
 * per-command methods exist only because the command registry maps
 * each command name to a method name.
 *
 * Each tag mutation goes through `IssueTagger#mutateTag`, which writes
 * its own stdout/stderr lines directly and never throws, so per-tag
 * failures are best-effort (Error + Warning to stderr, then continue)
 * and the command still exits 0.
 */
class GithubIssueMark {
  /**
   * @param {import('../../context/RepoContext.js').default} repoContext -
   *   the target repo's context (its leading `repoPath` positional has
   *   already been stripped by `Dispatcher.commandArgs()`).
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {IssueTagger} [deps.issueTagger] - the per-tag mutation
   *   delegate.
   */
  constructor(repoContext, { issueTagger = new IssueTagger({ context: repoContext }) } = {}) {
    this._repoContext = repoContext;
    this._issueTagger = issueTagger;
  }

  /**
   * @param {string} id - the issue id.
   * @returns {Promise<string>} `''` — output is written directly.
   */
  async markCreated(id) {
    return this.mark('created', id);
  }

  /**
   * @param {string} id - the issue id.
   * @returns {Promise<string>} `''` — output is written directly.
   */
  async markRefined(id) {
    return this.mark('refined', id);
  }

  /**
   * @param {string} id - the issue id.
   * @returns {Promise<string>} `''` — output is written directly.
   */
  async markReady(id) {
    return this.mark('ready', id);
  }

  /**
   * @param {string} id - the issue id.
   * @returns {Promise<string>} `''` — output is written directly.
   */
  async markEnhancing(id) {
    return this.mark('enhancing', id);
  }

  /**
   * @param {string} id - the issue id.
   * @returns {Promise<string>} `''` — output is written directly.
   */
  async markPlanning(id) {
    return this.mark('planning', id);
  }

  /**
   * @param {string} id - the issue id.
   * @returns {Promise<string>} `''` — output is written directly.
   */
  async markSplit(id) {
    return this.mark('split', id);
  }

  /**
   * Shared `cmd_mark_*` body: resolves the plain (non-domain-qualified)
   * `owner/repo` — `cmd_mark_*` uses `$_ORIGIN_REPO_PATH`, not
   * `get_repo_ref` — then applies `MARK_TRANSITIONS[name]` in order.
   * An origin resolution failure propagates unchanged (`Origin#resolve`'s
   * `Error: '<repo_path>' is not a git repository or has no 'origin'
   * remote`), which the CLI turns into exit 1.
   * @param {string} name - the `MARK_TRANSITIONS` key.
   * @param {string} id - the issue id.
   * @returns {Promise<string>} `''` once every mutation was attempted.
   */
  async mark(name, id) {
    const { repo } = await this._repoContext.resolve();
    const { adds, removes } = MARK_TRANSITIONS[name];

    for (const tag of adds) {
      await this._issueTagger.mutateTag(id, repo, 'add', tag);
    }

    for (const tag of removes) {
      await this._issueTagger.mutateTag(id, repo, 'remove', tag);
    }

    return '';
  }
}

export default GithubIssueMark;
