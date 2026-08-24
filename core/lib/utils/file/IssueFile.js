import { readdir } from 'node:fs/promises';
import path from 'node:path';

/**
 * Shared issue-file filename/lookup helpers, used by both
 * `ResolveAndFetch` and `ResolveIdAndFile` — the `<id>_*`/`<id>-*`
 * existing-file glob and the id-prefix-stripping, Title-Case filename
 * → title derivation they both need. See
 * docs/agents/architecture/script-engine.md for the migration this
 * supports.
 */
class IssueFile {
  /**
   * Glob `<issuesFolder>/<id>_*`/`<id>-*` (first match wins — match
   * order is filesystem-dependent, mirroring `find ... | head -1`).
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} issuesFolder - the folder to search, relative to `repoPath`.
   * @param {string} id - the issue id (numeric, once validated by the caller).
   * @returns {Promise<string|null>} the matched path (in the same
   *   `<issuesFolder>/<filename>` shape the shell prints), or null if
   *   no file matches.
   */
  static async findExisting(repoPath, issuesFolder, id) {
    let entries;

    try {
      entries = await readdir(path.join(repoPath, issuesFolder));
    } catch {
      return null;
    }

    const match = entries.find((name) => name.startsWith(`${id}_`) || name.startsWith(`${id}-`));

    return match ? path.posix.join(issuesFolder, match) : null;
  }

  /**
   * Native equivalent of `title_from_filename`: strip the id prefix up
   * to the first `_` (falling back to the first `-` only when the
   * filename has no `_` at all — matching the shell original's
   * parameter-expansion order exactly, quirks included), replace
   * remaining `_`/`-` with spaces, Title-Case each word.
   * @param {string} filePath - the matched existing-file path.
   * @returns {string} the derived title.
   */
  static titleFromFilename(filePath) {
    const base = path.basename(filePath, '.md');
    const underscoreIndex = base.indexOf('_');

    let titlePart;

    if (underscoreIndex !== -1) {
      titlePart = base.slice(underscoreIndex + 1);
    } else {
      const dashIndex = base.indexOf('-');

      titlePart = dashIndex !== -1 ? base.slice(dashIndex + 1) : base;
    }

    return titlePart
      .replace(/[_-]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}

export default IssueFile;
