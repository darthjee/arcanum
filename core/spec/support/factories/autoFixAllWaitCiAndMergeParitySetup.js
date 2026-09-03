import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { REPO_ROOT, seedOriginUrl } from '../utils/runCommand.js';

const FAKE_GITHUB_URL = 'https://github.com/darthjee/arcanum-wait-ci-and-merge-fixture.git';

/** The `auto-fix-all-wait-ci-and-merge` shell entrypoint's script path. */
export const SHELL_SCRIPT = path.join(REPO_ROOT, 'auto-fix-all', 'scripts', 'wait_ci_and_merge_shell.sh');

/** The `auto-fix-all-wait-ci-and-merge` engine_dispatch shim's script path. */
export const SHIM_SCRIPT = path.join(REPO_ROOT, 'auto-fix-all', 'scripts', 'wait_ci_and_merge.sh');

/**
 * Rewrites `repo.repoPath`'s `origin` remote to a github.com-shaped URL
 * — `Origin.js`/`origin.sh` both need a recognizable origin URL to
 * derive `{ domain, repo }` from, and neither `AutoFixAllWaitCi` nor
 * `AutoFixAllGithub#prMerge` actually pushes/fetches against `origin`,
 * so no local-bare-repo transport rewrite is needed (mirrors
 * autoFixAllWaitCiParity_spec.js's own `seedGithubLikeRepo`).
 * @param {{repoPath: string}} repo - the fixture repo.
 * @returns {Promise<void>} resolves once seeded.
 */
export async function seedGithubLikeRepo(repo) {
  await seedOriginUrl(repo.repoPath, FAKE_GITHUB_URL);
}

/**
 * Seeds `.claude/state/arcanum-config.json` under `repo.repoPath`, the
 * local-state (highest-precedence) tier `config_chain_read`/
 * `engine_dispatch.sh` consult — overriding whatever the outermost
 * (global, `~/.claude/arcanum-config.json`) tier happens to be set to
 * on the machine running this spec, for both `engine.mode` (see this
 * file's header comment) and `git.merge_body_mode` (`AutoFixAllGithub#
 * mergeBodyMode` defaults to `'empty'` only when every tier is silent;
 * a machine with a global `'coauthors'` default would otherwise make
 * `AutoFixAllGithub#prMerge` issue extra `/pulls/<number>/commits`/
 * `https://api.github.com/user` calls this spec's fake fetch/gh
 * doubles don't need to stub for the scenarios below).
 * @param {{repoPath: string}} repo - the fixture repo.
 * @param {object} config - the config object to write (merged under
 *   `engine`/`git`, etc. — whatever keys the caller needs pinned).
 * @returns {Promise<void>} resolves once written.
 */
export async function seedLocalState(repo, config) {
  const dir = path.join(repo.repoPath, '.claude', 'state');

  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'arcanum-config.json'), JSON.stringify(config));
}
