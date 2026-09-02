import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { REPO_ROOT, seedOriginUrl } from '../utils/runCommand.js';

const FAKE_GITHUB_URL = 'https://github.com/darthjee/arcanum-wait-ci-fixture.git';

/** The `auto-fix-all-wait-ci` shell entrypoint's script path. */
export const SHELL_SCRIPT = path.join(REPO_ROOT, 'auto-fix-all', 'scripts', 'wait_ci_shell.sh');

/**
 * Rewrites `repo.repoPath`'s `origin` remote to a github.com-shaped URL
 * — `Origin.js`/`origin.sh` both need a recognizable origin URL to
 * derive `{ domain, repo }` from, and `AutoFixAllWaitCi` never actually
 * pushes/fetches against `origin` (unlike auto-fix-all-reply-comment),
 * so no local-bare-repo transport rewrite is needed.
 * @param {{repoPath: string}} repo - the fixture repo.
 * @returns {Promise<void>} resolves once seeded.
 */
export async function seedGithubLikeRepo(repo) {
  await seedOriginUrl(repo.repoPath, FAKE_GITHUB_URL);
}

/**
 * Seeds `.claude/configuration/arcanum-repo-config.json`'s
 * `auto-fix-all.ignored_check_patterns` under `repo.repoPath`.
 * @param {{repoPath: string}} repo - the fixture repo.
 * @param {Array<string>} patterns - the ignored-pattern regex strings.
 * @returns {Promise<void>} resolves once written.
 */
export async function seedIgnoredCheckPatterns(repo, patterns) {
  const dir = path.join(repo.repoPath, '.claude', 'configuration');

  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, 'arcanum-repo-config.json'),
    JSON.stringify({ 'auto-fix-all': { ignored_check_patterns: patterns } })
  );
}
