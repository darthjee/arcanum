import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import RepoPath from '../utils/file/RepoPath.js';

const FRONTMATTER_DELIMITER = '---';

/**
 * Native equivalent of `arcanum/_lib/list_agents_shell.sh`: lists
 * specialist agents configured under a target project's `agents_dir`
 * (default `.claude/agents`, relative to `repoPath`), one
 * `<name>|<description>` line per `*.md` file, ordered alphabetically by
 * filename, parsed from each file's leading YAML frontmatter block via a
 * plain per-line field extraction (not a general YAML parser) — matching
 * the shell version's `awk` logic exactly.
 */
class ListAgents {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {RepoPath} [deps.repoPath] - repo-path validation helper.
   */
  constructor({ repoPath = new RepoPath() } = {}) {
    this._repoPath = repoPath;
  }

  /**
   * Native implementation of the `list-agents` migrated entrypoint —
   * byte-identical stdout/exit-code counterpart to
   * `arcanum/_lib/list_agents_shell.sh`: validates `repoPath`
   * (`RepoPath#validate`, matching `repo_path_enter`'s messages/exit-1
   * semantics), then lists `*.md` files directly under the resolved
   * `agentsDir`, returning one `name|description\n` line per file (in
   * filename order) that has a `name:` frontmatter field. Returns `''`
   * when `agentsDir` doesn't exist or has no `*.md` files, matching the
   * shell script's "prints nothing, exit 0" behavior.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} [agentsDir] - the agents directory, relative to
   *   `repoPath` (defaults to `.claude/agents`).
   * @returns {Promise<string>} the joined `name|description\n` lines.
   */
  async run(repoPath, agentsDir = '.claude/agents') {
    await this._repoPath.validate(repoPath);

    const resolvedDir = path.join(repoPath, agentsDir);
    const files = await this._listMarkdownFiles(resolvedDir);

    if (files.length === 0) {
      return '';
    }

    const lines = [];

    for (const file of files) {
      const line = await this._describe(path.join(resolvedDir, file));

      if (line !== null) {
        lines.push(line);
      }
    }

    return lines.join('');
  }

  /**
   * @param {string} dir - the directory to list `*.md` files from.
   * @returns {Promise<string[]>} the sorted `*.md` filenames, or `[]`
   *   when `dir` doesn't exist.
   */
  async _listMarkdownFiles(dir) {
    let entries;

    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return [];
    }

    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
      .map((entry) => entry.name)
      .sort();
  }

  /**
   * @param {string} filePath - the agent `*.md` file's full path.
   * @returns {Promise<?string>} the `name|description\n` line, or `null`
   *   when the file has no `name` frontmatter field.
   */
  async _describe(filePath) {
    const content = await readFile(filePath, 'utf8');
    const frontmatter = this._extractFrontmatter(content);
    const name = this._extractField(frontmatter, 'name');

    if (!name) {
      return null;
    }

    const description = this._extractField(frontmatter, 'description');

    return `${name}|${description}\n`;
  }

  /**
   * @param {string} content - the file's full content.
   * @returns {string[]} the lines strictly between the first pair of
   *   `---` delimiter lines, or `[]` when there is no such block.
   */
  _extractFrontmatter(content) {
    const lines = content.split('\n');

    if (lines[0] !== FRONTMATTER_DELIMITER) {
      return [];
    }

    const endIndex = lines.indexOf(FRONTMATTER_DELIMITER, 1);

    if (endIndex === -1) {
      return [];
    }

    return lines.slice(1, endIndex);
  }

  /**
   * @param {string[]} frontmatterLines - the frontmatter block's lines.
   * @param {string} field - the field name to look for (e.g. `name`).
   * @returns {string} the first matching field's value (quotes
   *   stripped), or `''` when the field isn't present.
   */
  _extractField(frontmatterLines, field) {
    const pattern = new RegExp(`^${field}:[ ]*(.*)$`);

    for (const line of frontmatterLines) {
      const match = line.match(pattern);

      if (match) {
        return this._stripQuotes(match[1]);
      }
    }

    return '';
  }

  /**
   * @param {string} value - the raw captured field value.
   * @returns {string} `value` with a single leading quote and a single
   *   trailing quote (single or double, independently — mirroring the
   *   shell's `gsub(/^["']|["']$/, "")`, not requiring a matching pair)
   *   stripped, if present.
   */
  _stripQuotes(value) {
    return value.replace(/^["']/, '').replace(/["']$/, '');
  }
}

export default ListAgents;
