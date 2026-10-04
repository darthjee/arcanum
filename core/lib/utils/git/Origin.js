import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const defaultExecFileAsync = promisify(execFile);

/**
 * GitHub host aliases, mapped to their canonical web/API domain.
 * `ssh.github.com` is GitHub's SSH-over-443 host: it has no web UI or
 * API of its own, so it is treated as `github.com` everywhere a
 * GitHub-ness decision, `gh -R` repo reference, or web URL is built.
 */
const GITHUB_DOMAIN_ALIASES = Object.freeze({ 'ssh.github.com': 'github.com' });

/**
 * Resolves a git repo's `origin` remote into a GitHub domain and
 * owner/repo path, mirroring `arcanum/_lib/origin.sh`'s
 * `get_domain`/`get_repo_path` (`_load_origin`'s ssh/https parsing).
 */
class Origin {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Function} [deps.execFileAsync] - promisified `execFile`.
   * @param {import('../../context/RepoContext.js').default} [deps.repoContext] -
   *   the target repo's context, supplying a `repoPath` fallback for
   *   `resolve()`/`resolveWithRef()` when no explicit `repoPath` argument
   *   is passed.
   */
  constructor({ execFileAsync = defaultExecFileAsync, repoContext } = {}) {
    this._execFileAsync = execFileAsync;
    this._repoContext = repoContext;
  }

  /**
   * Normalize a git remote host into its canonical GitHub domain.
   * @param {string} domain - the raw remote host (e.g. `ssh.github.com`).
   * @returns {string} the aliased domain (e.g. `github.com`), or `domain`
   *   unchanged when it has no alias.
   */
  static normalizeDomain(domain) {
    return GITHUB_DOMAIN_ALIASES[domain] ?? domain;
  }

  /**
   * Whether a git remote host is github.com (including its aliases).
   * @param {string} domain - the raw remote host.
   * @returns {boolean} true when `domain` normalizes to `github.com`.
   */
  static isGithub(domain) {
    return Origin.normalizeDomain(domain) === 'github.com';
  }

  /**
   * Resolve `<repoPath>`'s `origin` remote into `{ domain, repo }`.
   * @param {string} [repoPath] - the target repo's local checkout path;
   *   falls back to `this._repoContext.repoPath` when omitted. An
   *   explicitly passed `repoPath` wins over the constructor context.
   * @returns {Promise<{domain: string, repo: string}>} the parsed origin.
   */
  async resolve(repoPath) {
    const path = repoPath ?? this._repoContext?.repoPath;
    let stdout;

    try {
      ({ stdout } = await this._execFileAsync('git', ['-C', path, 'remote', 'get-url', 'origin']));
    } catch {
      throw new Error(`Error: '${path}' is not a git repository or has no 'origin' remote`);
    }

    const origin = stdout.trim();

    if (origin.startsWith('git@')) {
      const domain = origin.slice('git@'.length).split(':')[0];
      const repo = origin.slice(origin.indexOf(':') + 1).replace(/\.git$/, '');

      return { domain, repo };
    }

    if (/^https?:\/\//.test(origin)) {
      const stripped = origin.replace(/^https?:\/\//, '');
      const slashIndex = stripped.indexOf('/');
      const domain = stripped.slice(0, slashIndex);
      const repo = stripped.slice(slashIndex + 1).replace(/\.git$/, '');

      return { domain, repo };
    }

    if (origin.startsWith('ssh://')) {
      const stripped = origin.slice('ssh://'.length);
      const atIndex = stripped.indexOf('@');
      const withoutUser = atIndex === -1 ? stripped : stripped.slice(atIndex + 1);
      const slashIndex = withoutUser.indexOf('/');
      const hostpart = withoutUser.slice(0, slashIndex);
      const rest = withoutUser.slice(slashIndex + 1);
      const domain = hostpart.split(':')[0];
      const repo = rest.replace(/\.git$/, '');

      return { domain, repo };
    }

    throw new Error(`Error: unrecognized origin format: ${origin}`);
  }

  /**
   * Resolve `<repoPath>`'s `origin` remote into `{ domain, repo,
   * repoRef }`, where `repoRef` is the (possibly domain-qualified) repo
   * reference used in error/success messages and `gh -R`. Mirrors
   * `origin.sh`'s `get_repo_ref`, except that the github.com decision uses
   * the normalized domain (see `normalizeDomain`): an `ssh.github.com`
   * remote yields the bare `<owner>/<repo>` here, while bash still
   * domain-qualifies it (issue #453). The returned `domain` stays raw.
   * @param {string} [repoPath] - the target repo's local checkout path;
   *   falls back to `this._repoContext.repoPath` when omitted (see
   *   `resolve()`). An explicitly passed `repoPath` wins over the
   *   constructor context.
   * @returns {Promise<{domain: string, repo: string, repoRef: string}>}
   *   the parsed origin, plus its derived `repoRef`.
   */
  async resolveWithRef(repoPath) {
    const { domain, repo } = await this.resolve(repoPath);
    const repoRef = Origin.isGithub(domain) ? repo : `${domain}/${repo}`;

    return { domain, repo, repoRef };
  }
}

export default Origin;
