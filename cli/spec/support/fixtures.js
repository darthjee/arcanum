import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Repo-relative path of the committed repo tier file. */
export const REPO_FILE = path.join('.claude', 'configuration', 'arcanum-repo-config.json');

/** Repo-relative path of the gitignored local tier file. */
export const LOCAL_FILE = path.join('.claude', 'state', 'arcanum-config.json');

/**
 * @returns {Promise<string>} a fresh temp dir (real path, so it compares
 *   equal to what `git rev-parse --show-toplevel` prints).
 */
export async function tmpDir() {
  return realpath(await mkdtemp(path.join(os.tmpdir(), 'arcanum-cli-spec-')));
}

/**
 * @param {string} dir - a temp dir from `tmpDir`.
 * @returns {Promise<void>} resolves once removed.
 */
export async function removeDir(dir) {
  if (dir) {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Initializes a git repo at `dir`.
 * @param {string} dir - the directory (created if needed).
 * @param {object} [options] - repo options.
 * @param {(object|string|null)} [options.repoConfig] - the repo tier
 *   file's content (an object is JSON-encoded); `null` leaves the repo
 *   unconfigured.
 * @param {(object|string)} [options.localConfig] - the local tier
 *   file's content, if any.
 * @returns {Promise<string>} `dir`.
 */
export async function makeRepo(dir, { repoConfig = {}, localConfig } = {}) {
  await mkdir(dir, { recursive: true });
  await execFileAsync('git', ['init', '-q', dir]);

  if (repoConfig !== null) {
    await writeTier(path.join(dir, REPO_FILE), repoConfig);
  }

  if (localConfig !== undefined) {
    await writeTier(path.join(dir, LOCAL_FILE), localConfig);
  }

  return dir;
}

/**
 * Writes a tier file, creating its directory.
 * @param {string} file - the file's path.
 * @param {(object|string)} content - an object (JSON-encoded) or raw text.
 * @returns {Promise<void>} resolves once written.
 */
export async function writeTier(file, content) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, typeof content === 'string' ? content : `${JSON.stringify(content, null, 2)}\n`);
}
