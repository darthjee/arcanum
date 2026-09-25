import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { REPO_ROOT, git } from './runCommand.js';
import { createTempDir, removeTempDir } from './tempDir.js';

/** The real, shipped `arcanum/update/bootstrap.sh` under test. */
export const BOOTSTRAP_SCRIPT = path.join(REPO_ROOT, 'arcanum', 'update', 'bootstrap.sh');

/** `bootstrap.sh`'s path relative to an install root. */
const BOOTSTRAP_RELATIVE = path.join('arcanum', 'update', 'bootstrap.sh');

/**
 * Seed a repo with `bootstrap.sh` + a tracked `README.md` tagged `v1`,
 * then a second commit tagged `v2`, and push both (plus `main`) to
 * `remotePath`.
 * @param {string} seedPath - the (not yet created) seed repo path.
 * @param {string} remotePath - the bare remote's path.
 * @param {string} root - the fixture's root temp dir.
 * @returns {Promise<void>} resolves once pushed.
 */
async function seedTaggedRemote(seedPath, remotePath, root) {
  await mkdir(path.join(seedPath, 'arcanum', 'update'), { recursive: true });
  await git(['init', '--quiet', '-b', 'main', seedPath], root);
  await git(['config', 'commit.gpgsign', 'false'], seedPath);
  await git(['config', 'tag.gpgsign', 'false'], seedPath);
  // `seedPath` is always a trusted, test-controlled temporary directory
  // created above (never user/external input), so these are known
  // false positives for Codacy's `detect-non-literal-fs-filename`
  // pattern (see issue #460).
  await copyFile(BOOTSTRAP_SCRIPT, path.join(seedPath, BOOTSTRAP_RELATIVE));
  await writeFile(path.join(seedPath, 'README.md'), '# fixture\n');
  await git(['add', '.'], seedPath);
  await git(['commit', '--quiet', '-m', 'v1'], seedPath);
  await git(['tag', 'v1'], seedPath);

  await writeFile(path.join(seedPath, 'CHANGELOG.md'), '# v2\n');
  await git(['add', 'CHANGELOG.md'], seedPath);
  await git(['commit', '--quiet', '-m', 'v2'], seedPath);
  await git(['tag', 'v2'], seedPath);

  await git(['push', '--quiet', '--tags', remotePath, 'main'], seedPath);
}

/**
 * Build a throwaway, offline git-clone arcanum install for exercising
 * `arcanum/update/bootstrap.sh`'s git-clone update path: a bare
 * `remote.git` holding tags `v1` and `v2` (each commit carrying the
 * real `bootstrap.sh`), cloned into `install` and checked out at `v1`
 * (so the install has `.git` and no `arcanum.json`).
 * @returns {Promise<{installPath: string, scriptPath: string, cleanup: () => Promise<void>}>}
 *   the install root, the copy of `bootstrap.sh` inside it, and a
 *   cleanup callback removing everything.
 */
export async function createGitTaggedInstall() {
  const root = await createTempDir('arcanum-core-git-install-');
  const remotePath = path.join(root, 'remote.git');
  const seedPath = path.join(root, 'seed');
  const installPath = path.join(root, 'install');

  await git(['init', '--quiet', '--bare', '-b', 'main', remotePath], root);
  await seedTaggedRemote(seedPath, remotePath, root);

  await git(['clone', '--quiet', remotePath, installPath], root);
  await git(['config', 'commit.gpgsign', 'false'], installPath);
  await git(['-c', 'advice.detachedHead=false', 'checkout', '--quiet', 'v1'], installPath);

  return {
    installPath,
    scriptPath: path.join(installPath, BOOTSTRAP_RELATIVE),
    cleanup: () => removeTempDir(root)
  };
}
