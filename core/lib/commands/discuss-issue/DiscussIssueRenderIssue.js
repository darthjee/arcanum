import { readFile as defaultReadFile, writeFile } from 'node:fs/promises';
import { resolveInstallPath } from '../../utils/file/InstallRoot.js';

/**
 * Native implementation of the `discuss-issue-render-issue` migrated
 * entrypoint — byte-identical stdout/exit-code counterpart to
 * `discuss-issue/scripts/render_issue.sh`. Renders
 * `discuss-issue/templates/issue.tmpl.md` (resolved from the arcanum
 * install, never the target `repoPath` — see `InstallRoot.js`) by
 * substituting each `%%PLACEHOLDER%%` with its corresponding argument,
 * collapsing the blank-line runs left behind by omitted sections, and
 * writing the result to `outputFile`. Purely filesystem-based — no
 * GitHub/network dependency. See
 * docs/agents/plans/448-migrate-discuss-issue-render-issue-entrypoint-to-native-node-js/plan.md
 * for the full design/shared contracts.
 */
class DiscussIssueRenderIssue {
  /**
   * @param {import('../../context/RepoContext.js').default} repoContext -
   *   the target repo's context (currently unused by this class, kept for
   *   the migrated-command constructor convention).
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Function} [deps.readFile] - `node:fs/promises` `readFile`-
   *   compatible implementation, used to read the issue template.
   */
  constructor(repoContext, { readFile = defaultReadFile } = {}) {
    this._repoContext = repoContext;
    this._readFile = readFile;
  }

  /**
   * Render the issue template into `outputFile`. Each section argument
   * is the full block including its own "## Heading" line; pass `''`
   * (the default) to omit a section entirely.
   * @param {string} outputFile - the local file to write the rendered
   *   content to.
   * @param {string} title - the issue title (`%%TITLE%%`).
   * @param {string} [description] - the description section
   *   (`%%DESCRIPTION%%`).
   * @param {string} [problem] - the problem section (`%%PROBLEM%%`).
   * @param {string} [expectedBehavior] - the expected-behavior section
   *   (`%%EXPECTED_BEHAVIOR%%`).
   * @param {string} [solution] - the solution section (`%%SOLUTION%%`).
   * @param {string} [benefits] - the benefits section (`%%BENEFITS%%`).
   * @returns {Promise<void>} resolves once `outputFile` has been
   *   written.
   * @throws {Error} when `outputFile` or `title` is missing/empty.
   */
  async run(outputFile, title, description = '', problem = '', expectedBehavior = '', solution = '', benefits = '') {
    if (!outputFile || !title) {
      throw new Error(
        'Usage: render_issue <output_file> <title> [description] [problem] [expected_behavior] [solution] [benefits]'
      );
    }

    const templatePath = resolveInstallPath('discuss-issue', 'templates', 'issue.tmpl.md');
    const template = await this._readFile(templatePath, 'utf8');

    let content = template
      .replace('%%TITLE%%', title)
      .replace('%%DESCRIPTION%%', description)
      .replace('%%PROBLEM%%', problem)
      .replace('%%EXPECTED_BEHAVIOR%%', expectedBehavior)
      .replace('%%SOLUTION%%', solution)
      .replace('%%BENEFITS%%', benefits);

    content = content
      .replace(/^\n+/, '')
      .replace(/\n+$/, '')
      .replace(/\n{3,}/g, '\n\n');

    await writeFile(outputFile, `${content}\n`);
  }
}

export default DiscussIssueRenderIssue;
