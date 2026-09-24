import { execFile } from 'node:child_process';
import { statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const defaultExecFileAsync = promisify(execFile);

/**
 * @param {string} file - the path to test.
 * @returns {boolean} whether it is a regular file (following symlinks),
 *   like the shell's `[[ -f ]]`.
 */
function defaultIsFile(file) {
  const stats = statSync(file, { throwIfNoEntry: false });

  return Boolean(stats && stats.isFile());
}

/**
 * @param {string} file - the path to test.
 * @returns {boolean} whether it is a directory (following symlinks),
 *   like the shell's `[[ -d ]]` — so a git worktree's `.git` *file*
 *   does not count.
 */
function defaultIsDirectory(file) {
  const stats = statSync(file, { throwIfNoEntry: false });

  return Boolean(stats && stats.isDirectory());
}

/**
 * Resolves an arcanum install's own version: the zip install's
 * `arcanum.json` `.version`, or a git-clone install's exact tag on HEAD.
 * Shared by `init-claude-stamp-arcanum-version` (which mirrors
 * `init-claude/scripts/stamp_arcanum_version.sh`) and
 * `ArcanumUpdateRunUpdate` (which adds its own short-hash fallback).
 */
class InstallVersion {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Function} [deps.readFile] - `fs/promises`-compatible file
   *   reader, used for `arcanum.json`.
   * @param {function(string): boolean} [deps.isFile] - synchronous
   *   regular-file check (`[[ -f ]]`), used for `arcanum.json`.
   * @param {function(string): boolean} [deps.isDirectory] - synchronous
   *   directory check (`[[ -d ]]`), used for `.git`.
   * @param {Function} [deps.execFileAsync] - promisified `execFile`.
   */
  constructor({
    readFile: readFileFn = readFile,
    isFile = defaultIsFile,
    isDirectory = defaultIsDirectory,
    execFileAsync = defaultExecFileAsync
  } = {}) {
    this._readFile = readFileFn;
    this._isFile = isFile;
    this._isDirectory = isDirectory;
    this._execFileAsync = execFileAsync;
  }

  /**
   * Mirrors `stamp_arcanum_version.sh`'s resolution: the zip version if
   * `<installRoot>/arcanum.json` is a regular file, else the exact tag if
   * `<installRoot>/.git` is a directory, else `''`.
   * @param {string} installRoot - the arcanum install's root directory.
   * @returns {Promise<string>} the resolved version, or `''`.
   */
  async resolve(installRoot) {
    if (this._isFile(path.join(installRoot, 'arcanum.json'))) {
      return this.zipVersion(installRoot);
    }

    if (this._isDirectory(path.join(installRoot, '.git'))) {
      return this.exactTag(installRoot);
    }

    return '';
  }

  /**
   * Mirrors `jq -r '.version // empty' arcanum.json 2>/dev/null || true`.
   * @param {string} installRoot - the arcanum install's root directory.
   * @returns {Promise<string>} `arcanum.json`'s `.version`, or `''` when
   *   the file is missing, malformed, or has no `.version`.
   */
  async zipVersion(installRoot) {
    let data;

    try {
      const raw = await this._readFile(path.join(installRoot, 'arcanum.json'), 'utf8');

      data = JSON.parse(raw);
    } catch {
      return '';
    }

    const version = data && typeof data === 'object' ? data.version : undefined;

    if (version === undefined || version === null || version === false) {
      return '';
    }

    return typeof version === 'string' ? version : JSON.stringify(version);
  }

  /**
   * Mirrors `git -C <installRoot> describe --tags --exact-match
   * 2>/dev/null || true`.
   * @param {string} installRoot - the arcanum install's root directory.
   * @returns {Promise<string>} the trimmed exact tag on HEAD, or `''` on
   *   failure.
   */
  async exactTag(installRoot) {
    try {
      const { stdout } = await this._execFileAsync('git', [
        '-C', installRoot, 'describe', '--tags', '--exact-match'
      ]);

      return stdout.trim();
    } catch {
      return '';
    }
  }
}

export default InstallVersion;
