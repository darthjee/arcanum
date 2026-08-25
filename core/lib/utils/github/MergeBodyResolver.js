/**
 * Merge-body-mode and co-authors resolution for `pr-merge`, extracted
 * from `PrOperations`'s `mergeBodyMode`/`_resolveMergeBody`/
 * `_coauthorsBody`/`_uniqueByEmail`/`_modelCoauthorOmitted`/
 * `_removeCoauthorsList` private methods. Takes `RepoContext` (for
 * config reads) and `GitHubClient` (for the commits fetch + merger-login
 * resolution) in its constructor, since both are needed across nearly
 * every method here.
 */
class MergeBodyResolver {
  /**
   * @param {object} [deps] - the resolver's collaborators.
   * @param {import('../../context/RepoContext.js').default} deps.context -
   *   the target repo's context, for config reads.
   * @param {import('./GitHubClient.js').default} deps.githubClient - the
   *   GitHub REST client, for the commits fetch + merger-login
   *   resolution.
   */
  constructor({ context, githubClient } = {}) {
    this._context = context;
    this._github = githubClient;
  }

  /**
   * Native re-derivation of `merge_body.sh`'s `merge_body_mode`, built
   * on `RepoContext#readConfig`.
   * @returns {Promise<'empty'|'full'|'coauthors'>} the resolved mode —
   *   `empty` when absent/null, or when present but not one of the
   *   three recognized values (which also warns to stderr).
   */
  async resolveMode() {
    const value = await this._context.readConfig('git', 'merge_body_mode');

    if (value === 'empty' || value === 'full' || value === 'coauthors') {
      return value;
    }

    if (value !== undefined) {
      const formatted = typeof value === 'string' ? value : JSON.stringify(value);

      process.stderr.write(`Warning: unrecognized git.merge_body_mode value '${formatted}' — falling back to 'empty'.\n`);
    }

    return 'empty';
  }

  /**
   * Resolve the `commit_message` payload for the REST merge call, per
   * `#resolveMode`'s resolved mode.
   * @param {number|string} number - the pull request number.
   * @param {string} [modelEmail] - the acting model's commit-author
   *   email, used by `coauthors` body mode to optionally exclude its
   *   own co-author entry.
   * @returns {Promise<{included: boolean, body: string}>} `included:
   *   false` means "omit `commit_message` entirely" (GitHub's own
   *   default squash body applies); `included: true` carries the exact
   *   `body` string to send (possibly an empty string, for `empty`
   *   mode).
   */
  async buildBody(number, modelEmail) {
    const mode = await this.resolveMode();

    if (mode === 'empty') {
      return { included: true, body: '' };
    }

    if (mode === 'full') {
      return { included: false, body: '' };
    }

    const coauthors = await this._coauthorsBody(number, modelEmail);

    return coauthors ? { included: true, body: coauthors } : { included: false, body: '' };
  }

  /**
   * Native re-derivation of `merge_body.sh`'s
   * `merge_body_coauthors_list`, built on `RepoContext#readConfig` for
   * the `omit_model_coauthor`/`remove_coauthors` config keys (see
   * `agent_email.sh`'s `model_coauthor_omitted`/`remove_coauthors_list`).
   * @param {number|string} number - the pull request number.
   * @param {string} [modelEmail] - the acting model's commit-author
   *   email.
   * @returns {Promise<string>} the deduped `Co-authored-by: ...` block
   *   (one line per author, trailing newline), or `''` when the
   *   resulting list is empty.
   */
  async _coauthorsBody(number, modelEmail) {
    const commits = await this._github.getPrCommits(number);
    const merger = await this._resolveMergerLogin();
    const omitModel = modelEmail ? await this._modelCoauthorOmitted() : false;
    const removeList = await this._removeCoauthorsList();

    const authors = commits.map((commit) => {
      const commitAuthor = commit && commit.commit && commit.commit.author;

      return {
        name: commitAuthor && commitAuthor.name,
        email: commitAuthor && commitAuthor.email,
        login: commit && commit.author && commit.author.login
      };
    });

    const withEmail = authors.filter((author) => !!author.email);
    const deduped = this._uniqueByEmail(withEmail);

    const lines = deduped
      .filter((author) => !removeList.includes(author.email))
      .filter((author) => !merger || author.login !== merger)
      .filter((author) => !omitModel || author.email !== modelEmail)
      .map((author) => `Co-authored-by: ${author.name} <${author.email}>`);

    return lines.length > 0 ? `${lines.join('\n')}\n` : '';
  }

  /**
   * Dedupe `authors` by `email`, mirroring jq's `unique_by(.email)`:
   * stably sorts by `email` ascending, then keeps the first entry for
   * each distinct email (the resulting order is sorted by email, NOT
   * original commit order — matching jq's own `unique_by` semantics
   * exactly, since the final co-author line order depends on it).
   * @param {Array<{name: string, email: string, login: string}>} authors -
   *   the candidate author entries (already filtered to a non-empty
   *   `email`).
   * @returns {Array<{name: string, email: string, login: string}>} the
   *   deduped, email-sorted list.
   */
  _uniqueByEmail(authors) {
    const sorted = authors
      .map((author, index) => ({ author, index }))
      .sort((a, b) => {
        if (a.author.email < b.author.email) {
          return -1;
        }

        if (a.author.email > b.author.email) {
          return 1;
        }

        return a.index - b.index;
      });

    const seen = new Set();
    const result = [];

    for (const { author } of sorted) {
      if (seen.has(author.email)) {
        continue;
      }

      seen.add(author.email);
      result.push(author);
    }

    return result;
  }

  /**
   * @returns {Promise<boolean>} the `git.omit_model_coauthor` config
   *   value, `true` only when it resolves to the exact JSON boolean
   *   `true` (mirroring `model_coauthor_omitted`'s `[[ "$value" ==
   *   "true" ]]` check against jq's `-c` boolean rendering).
   */
  async _modelCoauthorOmitted() {
    const value = await this._context.readConfig('git', 'omit_model_coauthor');

    return value === true;
  }

  /**
   * @returns {Promise<string[]>} the `git.remove_coauthors` config
   *   array, or `[]` when absent/null/not an array.
   */
  async _removeCoauthorsList() {
    const value = await this._context.readConfig('git', 'remove_coauthors');

    return Array.isArray(value) ? value : [];
  }

  /**
   * Resolve the acting GitHub user's own login, replacing `gh api user
   * -q '.login'`. Fails open (returns `''`) on any error, mirroring
   * `merge_body_coauthors_list`'s own `|| merger_login=""` fallback.
   * @returns {Promise<string>} the merger's GitHub login, or `''`.
   */
  async _resolveMergerLogin() {
    try {
      const user = await this._github.getCurrentUser();

      return user && user.login ? user.login : '';
    } catch {
      return '';
    }
  }
}

export default MergeBodyResolver;
