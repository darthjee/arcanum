import IssueFile from './utils/file/IssueFile.js';

const ARG_PATTERN = /^#([^\s]+)(.*)$/;
const NUMERIC_ID_PATTERN = /^[0-9]+$/;

/**
 * Native implementation of the `resolve-id-and-file` migrated
 * entrypoint — see docs/agents/architecture/script-engine.md and
 * docs/agents/plans/227-migrat-next-entry-point-to-use-native-nodejs/plan.md
 * for the full design/shared contracts. Byte-identical stdout/exit-code
 * counterpart to `arcanum/_lib/resolve_id_and_file_shell.sh`. Purely
 * filesystem-based — no GitHub/network dependency.
 */
class ResolveIdAndFile {
  /**
   * Resolve an issue id/title/filename from a skill's raw `#<id>
   * [title]` argument string plus the local issues folder. Always
   * resolves to a `SCENARIO=`/`STATUS=` stdout string, exiting 0 — the
   * only exception is a non-empty, non-numeric id, which throws
   * (propagated uncaught, same hard-failure class as
   * `checkout_safe_branch.sh`'s dirty-tree failure: no `SCENARIO=`
   * line, non-zero exit).
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} issuesFolder - the local issues folder to search
   *   for an existing `<id>_*`/`<id>-*` file, relative to `repoPath`.
   * @param {string} [argString] - the raw skill argument string.
   * @returns {Promise<string>} the `SCENARIO=.../STATUS=...` output.
   */
  async run(repoPath, issuesFolder, argString = '') {
    const { scenario, id, title } = this._parse(argString);

    if (id && !NUMERIC_ID_PATTERN.test(id)) {
      throw new Error(
        `Error: issue id must be numeric and linked to a GitHub issue (got '${id}'). Local-only ids are no longer supported.`
      );
    }

    if (scenario === 'A') {
      return this._resolveA(repoPath, issuesFolder, id, title);
    }

    if (scenario === 'C') {
      return this._resolveC(repoPath, issuesFolder, id);
    }

    return `SCENARIO=B\nID=\nTITLE=${title}\nFILE=\nSTATUS=missing_id\n`;
  }

  /**
   * Native equivalent of the shell's `^#([^[:space:]]+)(.*)` argument
   * grammar — see plan.md's Scenario A/B/C shapes. Reproduces the
   * shell's exact (non-full) whitespace trimming quirks: only ever a
   * single leading/trailing space is stripped at each step, mirroring
   * `${var## }`/`${var%% }` against a fixed one-character pattern.
   * @param {string} argString - the raw skill argument string.
   * @returns {{scenario: string, id: string, title: string}} the parsed shape.
   */
  _parse(argString) {
    const match = ARG_PATTERN.exec(argString);

    if (!match) {
      return { scenario: 'B', id: '', title: this._stripOneSpace(argString, 'both') };
    }

    const id = match[1];
    let rest = match[2];

    rest = this._stripOneSpace(rest, 'leading');
    rest = rest.replace(/^- /, '');
    rest = this._stripOneSpace(rest, 'leading');

    let title = rest.replace(/-/g, ' ');

    title = this._stripOneSpace(title, 'both');

    return { scenario: title ? 'A' : 'C', id, title };
  }

  /**
   * Mirrors the shell's `${var## }`/`${var%% }` single-character
   * leading/trailing-space trim — NOT a full `trim()`: at most one
   * leading and/or one trailing space is ever removed, quirks included
   * (matches `resolve_id_and_file_shell.sh` exactly).
   * @param {string} value - the string to trim.
   * @param {'leading'|'trailing'|'both'} side - which side(s) to trim.
   * @returns {string} the trimmed string.
   */
  _stripOneSpace(value, side) {
    let result = value;

    if (side === 'leading' || side === 'both') {
      result = result.replace(/^ /, '');
    }

    if (side === 'trailing' || side === 'both') {
      result = result.replace(/ $/, '');
    }

    return result;
  }

  /**
   * Scenario A resolution: an existing-file match reuses the parsed
   * title as-is; no match builds a fresh `FILE=` guess from the
   * snake_case slug of the parsed title.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} issuesFolder - the folder to search, relative to `repoPath`.
   * @param {string} id - the numeric issue id.
   * @param {string} title - the parsed title.
   * @returns {Promise<string>} Scenario A's output.
   */
  async _resolveA(repoPath, issuesFolder, id, title) {
    const existing = await IssueFile.findExisting(repoPath, issuesFolder, id);

    if (existing) {
      return `SCENARIO=A\nID=${id}\nTITLE=${title}\nFILE=${existing}\nSTATUS=existing\n`;
    }

    const file = `${issuesFolder}/${id}_${this._titleToSnakeCase(title)}.md`;

    return `SCENARIO=A\nID=${id}\nTITLE=${title}\nFILE=${file}\nSTATUS=new\nNEEDS_FETCH=true\n`;
  }

  /**
   * Scenario C resolution: an existing-file match derives `TITLE` from
   * the matched filename; no match leaves `TITLE`/`FILE` empty.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} issuesFolder - the folder to search, relative to `repoPath`.
   * @param {string} id - the numeric issue id.
   * @returns {Promise<string>} Scenario C's output.
   */
  async _resolveC(repoPath, issuesFolder, id) {
    const existing = await IssueFile.findExisting(repoPath, issuesFolder, id);

    if (existing) {
      const title = IssueFile.titleFromFilename(existing);

      return `SCENARIO=C\nID=${id}\nTITLE=${title}\nFILE=${existing}\nSTATUS=existing\n`;
    }

    return `SCENARIO=C\nID=${id}\nTITLE=\nFILE=\nSTATUS=new\nNEEDS_FETCH=true\n`;
  }

  /**
   * Native equivalent of `title_to_snake_case`: lowercase, `[^a-z0-9]`
   * → `_`, collapse repeated `_`, trim leading/trailing `_`.
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

export default ResolveIdAndFile;
