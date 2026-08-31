import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const USAGE = 'Usage: create_sub_issue_file.sh <repo_path> <issue_id> <title> <body_file>';
const ISSUES_DIR = 'docs/agents/issues';

/**
 * Native equivalent of
 * `arcanum-split-issue/scripts/create_sub_issue_file_shell.sh`: creates one
 * local sub-issue draft file for a parent issue being split. See
 * docs/agents/plans/257-migrate-arcanum-split-issue-create-sub-issue-file-entrypoint-to-native-node-js/node.md's
 * "Shared contracts".
 */
class ArcanumSplitIssueCreateSubIssueFile {
  /**
   * @param {import('../context/RepoContext.js').default} repoContext -
   *   the target repo's context (provides `repoPath`).
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Function} [deps.readdir] - `node:fs/promises`'s `readdir`.
   * @param {Function} [deps.mkdir] - `node:fs/promises`'s `mkdir`.
   * @param {Function} [deps.readFile] - `node:fs/promises`'s `readFile`.
   * @param {Function} [deps.writeFile] - `node:fs/promises`'s `writeFile`.
   */
  constructor(repoContext, {
    readdir: readdirFn = readdir,
    mkdir: mkdirFn = mkdir,
    readFile: readFileFn = readFile,
    writeFile: writeFileFn = writeFile
  } = {}) {
    this._repoContext = repoContext;
    this._readdir = readdirFn;
    this._mkdir = mkdirFn;
    this._readFile = readFileFn;
    this._writeFile = writeFileFn;
  }

  /**
   * Native implementation of the `arcanum-split-issue-create-sub-issue-file`
   * migrated entrypoint — byte-identical stdout/exit-code counterpart to
   * `create_sub_issue_file_shell.sh`. Validates all 4 arguments are
   * present (usage message otherwise, propagated uncaught so the caller
   * exits 1), checks that
   * `bodyFile` exists (relative to `repoPath`, mirroring the shell
   * script's `cd`-then-check order), scans `docs/agents/issues/` for the
   * next gap-tolerant zero-padded sub-issue count, snake_cases `title`,
   * writes the new sub-issue file, and returns `FILE=<path>\n`.
   * @param {string} issueId - the parent issue's numeric id.
   * @param {string} title - the sub-issue's title.
   * @param {string} bodyFile - path (absolute, or relative to `repoPath`)
   *   to the sub-issue's body content.
   * @returns {Promise<string>} the `FILE=<path>\n` output.
   */
  async run(issueId, title, bodyFile) {
    if (!this._repoContext.repoPath || !issueId || !title || !bodyFile) {
      throw new Error(USAGE);
    }

    const resolvedBodyFile = path.resolve(this._repoContext.repoPath, bodyFile);
    let body;

    try {
      body = await this._readFile(resolvedBodyFile);
    } catch {
      throw new Error(`Error: file not found: ${bodyFile}`);
    }

    const issuesDir = path.join(this._repoContext.repoPath, ISSUES_DIR);

    await this._mkdir(issuesDir, { recursive: true });

    const count = await this._nextCount(issuesDir, issueId);
    const snakeTitle = this._titleToSnakeCase(title);
    const fileName = `${issueId}_${count}_${snakeTitle}.md`;
    const relativeFile = path.posix.join(ISSUES_DIR, fileName);

    const header = Buffer.from(`# ${title}\n\n`);

    await this._writeFile(path.join(this._repoContext.repoPath, ISSUES_DIR, fileName), Buffer.concat([header, body]));

    return `FILE=${relativeFile}\n`;
  }

  /**
   * Computes the next gap-tolerant, zero-padded sub-issue count for
   * `issueId`, mirroring `arcanum/migrations/generate_next.sh`'s
   * convention: scans `issuesDir` (already created by `#run` via `mkdir
   * -p` semantics before this is called, mirroring the shell script's own
   * ordering) for entries matching `<issueId>_[0-9][0-9]*_*` (bash glob
   * semantics — at least 2 digits immediately after `<issueId>_`,
   * followed by anything, then a literal `_`, then anything), strips the
   * `<issueId>_` prefix, takes the leading run up to the next `_` as the
   * count segment (non-numeric segments are skipped), and returns `1 +
   * max(existing counts)` (or `1` if none exist) zero-padded to 2 digits
   * — a count freed by a deleted file is never reused.
   * @param {string} issuesDir - the absolute `docs/agents/issues/` path.
   * @param {string} issueId - the parent issue's numeric id.
   * @returns {Promise<string>} the zero-padded next count.
   */
  async _nextCount(issuesDir, issueId) {
    const entries = await this._readdir(issuesDir);
    const prefix = `${issueId}_`;
    const globPattern = new RegExp(`^${this._escapeRegExp(prefix)}[0-9]{2}.*_.*$`);

    let highest = 0;

    for (const name of entries) {
      if (!globPattern.test(name)) {
        continue;
      }

      const rest = name.slice(prefix.length);
      const countSegment = rest.split('_')[0];

      if (!/^[0-9]+$/.test(countSegment)) {
        continue;
      }

      const num = parseInt(countSegment, 10);

      if (num > highest) {
        highest = num;
      }
    }

    return String(highest + 1).padStart(2, '0');
  }

  /**
   * @param {string} value - the string to escape.
   * @returns {string} `value` with regex metacharacters escaped.
   */
  _escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Native equivalent of `title_to_snake_case`: lowercase, `[^a-z0-9]`
   * → `_`, collapse repeated `_`, trim leading/trailing `_`. Identical
   * to `ResolveIdAndFile.js`'s private `_titleToSnakeCase`.
   * @param {string} title - the raw title.
   * @returns {string} the snake_case slug.
   */
  _titleToSnakeCase(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_/, '')
      .replace(/_$/, '');
  }
}

export default ArcanumSplitIssueCreateSubIssueFile;
