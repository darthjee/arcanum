import { mkdir, readFile, readdir, stat, unlink, writeFile as fsWriteFile } from 'node:fs/promises';
import path from 'node:path';

const DRAFTS_DIR = path.join('.claude', 'state', 'create-issue');
const DRAFT_EXT = '.md';
const MAX_NAME_ATTEMPTS = 100;

/**
 * The `/arcanum-create-issue` drafts under
 * `<repo>/.claude/state/create-issue/` (git-ignored): listing, creating,
 * resolving a `--resume` path, reading a draft's title/body, and
 * deleting a draft after a successful publish. Shared by
 * `ArcanumCreateIssueStart` and `ArcanumCreateIssuePublish`. See the
 * "Draft file" section of docs/agents/architecture/arcanum-create-issue.md.
 */
class DraftStore {
  /**
   * @param {object} deps - the store's target repo and collaborators.
   * @param {string} deps.repoPath - the target repo's local checkout
   *   path.
   * @param {() => Date} [deps.now] - clock, overridable for tests.
   * @param {typeof fsWriteFile} [deps.writeFile] - file writer used to
   *   create drafts, overridable for tests.
   */
  constructor({ repoPath, now = () => new Date(), writeFile = fsWriteFile }) {
    this._dir = path.resolve(repoPath, DRAFTS_DIR);
    this._now = now;
    this._writeFile = writeFile;
  }

  /**
   * @returns {string} the absolute drafts directory.
   */
  get dir() {
    return this._dir;
  }

  /**
   * Every draft, newest (last modified) first.
   * @returns {Promise<Array<{path: string, timestamp: string, mtime: Date, title: string}>>}
   *   one entry per `*.md` file; `timestamp` is the ISO-8601 (UTC,
   *   second precision) last-modified time.
   */
  async list() {
    let names;

    try {
      names = await readdir(this._dir);
    } catch {
      return [];
    }

    const drafts = [];

    for (const name of names.filter((entry) => entry.endsWith(DRAFT_EXT))) {
      const file = path.join(this._dir, name);
      const info = await stat(file);

      if (info.isFile()) {
        drafts.push({
          path: file,
          timestamp: this.isoSeconds(info.mtime),
          mtime: info.mtime,
          title: await this.label(file)
        });
      }
    }

    return drafts.sort((a, b) => b.mtime - a.mtime || b.path.localeCompare(a.path));
  }

  /**
   * Create a new, empty draft named after the current time
   * (`YYYYMMDD-HHMMSS.md`, UTC — sortable and filesystem-safe), adding a
   * `-N` suffix if that name is already taken.
   * @returns {Promise<string>} the new draft's absolute path.
   * @throws {Error} when no free name is found or the file cannot be
   *   written.
   */
  async create() {
    await mkdir(this._dir, { recursive: true });

    const stamp = this.isoSeconds(this._now()).replace(/[-:]/g, '').replace('T', '-').replace('Z', '');

    for (let attempt = 0; attempt < MAX_NAME_ATTEMPTS; attempt += 1) {
      const suffix = attempt === 0 ? '' : `-${attempt}`;
      const file = path.join(this._dir, `${stamp}${suffix}${DRAFT_EXT}`);

      try {
        await this._writeFile(file, '', { flag: 'wx' });

        return file;
      } catch (error) {
        if (error.code !== 'EEXIST') {
          throw error;
        }
      }
    }

    throw new Error(`could not create a draft under ${this._dir}`);
  }

  /**
   * Resolve a `--resume` argument to an existing draft: an absolute or
   * repo-relative path to a regular `*.md` file directly inside the
   * drafts directory.
   * @param {string} draft - the `--resume` argument.
   * @param {string} repoPath - the target repo's local checkout path,
   *   relative paths are resolved against it.
   * @returns {Promise<string|null>} the draft's absolute path, or `null`
   *   when it is not a known draft.
   */
  async resolve(draft, repoPath) {
    const file = path.resolve(repoPath, draft);

    if (path.dirname(file) !== this._dir || !file.endsWith(DRAFT_EXT)) {
      return null;
    }

    try {
      return (await stat(file)).isFile() ? file : null;
    } catch {
      return null;
    }
  }

  /**
   * A draft's display label: its first level-1 heading's text, or else
   * its first non-blank line.
   * @param {string} file - the draft path.
   * @returns {Promise<string>} the label (`''` for a blank draft).
   */
  async label(file) {
    const lines = (await readFile(file, 'utf8')).split('\n');
    const heading = lines.find((line) => /^# \S/.test(line));

    if (heading) {
      return heading.slice(2).trim();
    }

    return (lines.find((line) => line.trim() !== '') ?? '').trim();
  }

  /**
   * A draft's issue body: its contents with the first level-1 heading
   * line removed, and leading/trailing blank lines trimmed.
   * @param {string} file - the draft path.
   * @returns {Promise<string>} the body (`''` when there is none).
   */
  async body(file) {
    const lines = (await readFile(file, 'utf8')).split('\n');
    const index = lines.findIndex((line) => /^# \S/.test(line));

    if (index !== -1) {
      lines.splice(index, 1);
    }

    return lines.join('\n').replace(/^(\s*\n)+/, '').replace(/\s+$/, '');
  }

  /**
   * Delete a draft.
   * @param {string} file - the draft path.
   * @returns {Promise<void>} resolves once deleted.
   */
  async delete(file) {
    await unlink(file);
  }

  /**
   * @param {Date} date - the time to format.
   * @returns {string} `YYYY-MM-DDTHH:MM:SSZ` (UTC).
   */
  isoSeconds(date) {
    return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
  }
}

export default DraftStore;
