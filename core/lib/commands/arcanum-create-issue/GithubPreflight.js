import Origin from '../../utils/git/Origin.js';

/**
 * The `/arcanum-create-issue` GitHub preflight: `origin` must resolve to
 * a `github.com` remote and a GitHub token must be obtainable (`gh` is
 * authenticated). GitHub host aliases such as `ssh.github.com` (SSH over
 * port 443) count as GitHub (see `Origin.normalizeDomain`). The token
 * itself is never returned or printed.
 */
class GithubPreflight {
  /**
   * @param {import('../../context/RepoContext.js').default} repoContext -
   *   the target repo's context (`resolve`, `getToken`).
   */
  constructor(repoContext) {
    this._repoContext = repoContext;
  }

  /**
   * @returns {Promise<void>} resolves when both checks pass.
   * @throws {Error} with a user-facing message (no `Error: ` prefix)
   *   when `origin` is missing/unparseable or not on GitHub, or when no
   *   token can be obtained.
   */
  async check() {
    try {
      const { domain, repo } = await this._repoContext.resolve();

      if (!Origin.isGithub(domain)) {
        throw new Error(`origin is not a GitHub remote: ${domain}/${repo}`);
      }

      await this._repoContext.getToken();
    } catch (error) {
      throw new Error(error.message.replace(/^Error: /, ''), { cause: error });
    }
  }
}

export default GithubPreflight;
