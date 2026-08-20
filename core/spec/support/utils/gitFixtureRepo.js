import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { createTempDir, removeTempDir } from './tempDir.js';

const execFileAsync = promisify(execFile);

/**
 * @param {string[]} args - the `git` arguments to run.
 * @param {string} cwd - the directory to run them in.
 * @returns {Promise<void>} resolves once the command succeeds.
 */
async function git(args, cwd) {
  await execFileAsync('git', args, {
    cwd,
    env: { ...process.env, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 't@example.com' }
  });
}

/**
 * Build a throwaway local git repo (with a local, filesystem-path
 * `origin` remote — no network involved) suitable for exercising
 * safe-branch-checkout logic in specs: `origin/main` exists and is
 * checked-out-able purely offline, mirroring the shape
 * `arcanum/_lib/checkout_safe_branch.sh`/`safe_branch.sh` expect.
 * @returns {Promise<{repoPath: string, remotePath: string, cleanup: Function}>} the built repo.
 */
export async function createGitFixtureRepo() {
  const root = await createTempDir('arcanum-core-git-fixture-');
  const remotePath = path.join(root, 'remote.git');
  const seedPath = path.join(root, 'seed');
  const repoPath = path.join(root, 'repo');

  await mkdir(remotePath, { recursive: true });
  await git(['init', '--quiet', '--bare', '-b', 'main', remotePath], root);

  await mkdir(seedPath, { recursive: true });
  await git(['init', '--quiet', '-b', 'main', seedPath], root);
  await git(['config', 'commit.gpgsign', 'false'], seedPath);
  await writeFile(path.join(seedPath, 'README.md'), '# fixture\n');
  await git(['add', 'README.md'], seedPath);
  await git(['commit', '--quiet', '-m', 'seed'], seedPath);
  await git(['push', '--quiet', remotePath, 'main'], seedPath);

  await git(['clone', '--quiet', remotePath, repoPath], root);
  await git(['config', 'commit.gpgsign', 'false'], repoPath);

  return {
    repoPath,
    remotePath,
    cleanup: () => removeTempDir(root)
  };
}
