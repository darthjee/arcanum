import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const defaultExecFileAsync = promisify(execFile);

/**
 * Resolves a git repo's `origin` remote into a GitHub domain and
 * owner/repo path, mirroring `arcanum/_lib/origin.sh`'s
 * `get_domain`/`get_repo_path` (`_load_origin`'s ssh/https parsing).
 */
class Origin {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Function} [deps.execFileAsync] - promisified `execFile`.
   */
  constructor({ execFileAsync = defaultExecFileAsync } = {}) {
    this._execFileAsync = execFileAsync;
  }

  /**
   * Resolve `<repoPath>`'s `origin` remote into `{ domain, repo }`.
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<{domain: string, repo: string}>} the parsed origin.
   */
  async resolve(repoPath) {
    let stdout;

    try {
      ({ stdout } = await this._execFileAsync('git', ['-C', repoPath, 'remote', 'get-url', 'origin']));
    } catch {
      throw new Error(`Error: '${repoPath}' is not a git repository or has no 'origin' remote`);
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
   * reference used in error/success messages, mirroring `origin.sh`'s
   * `get_repo_ref`.
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<{domain: string, repo: string, repoRef: string}>}
   *   the parsed origin, plus its derived `repoRef`.
   */
  async resolveWithRef(repoPath) {
    const { domain, repo } = await this.resolve(repoPath);
    const repoRef = domain === 'github.com' ? repo : `${domain}/${repo}`;

    return { domain, repo, repoRef };
  }
}

export default Origin;
