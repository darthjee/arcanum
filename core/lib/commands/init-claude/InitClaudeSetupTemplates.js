import { copyFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { resolveInstallPath } from '../../utils/file/InstallRoot.js';

const TEMPLATE_NAMES = [
  'pull_request_template.md',
  'commit_message_template.md',
  'commit_message_template-2.0.md'
];

/**
 * Native implementation of the `init-claude-setup-templates` migrated
 * entrypoint — byte-identical stdout/exit-code counterpart to
 * `init-claude/scripts/setup_templates_shell.sh`. Copies the install's
 * `init-claude/templates/*` GitHub templates into the target repo's
 * `.github/`, never overwriting one already present.
 */
class InitClaudeSetupTemplates {
  /**
   * @param {import('../../context/RepoContext.js').default} repoContext -
   *   the target repo's context, supplying `repoPath`.
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {function(string): string} [deps.templatePath] - resolves a
   *   template name to its source path (defaults to the install's
   *   `init-claude/templates/<name>`).
   */
  constructor(repoContext, {
    templatePath = (name) => resolveInstallPath('init-claude', 'templates', name)
  } = {}) {
    this._repoContext = repoContext;
    this._templatePath = templatePath;
  }

  /**
   * Copy each missing template into `<repoPath>/.github/`.
   * @returns {Promise<string>} `Created: <names>\n` (if any) followed by
   *   `Already present, left untouched: <names>\n` (if any).
   */
  async run() {
    const githubDir = path.join(this._repoContext.repoPath, '.github');
    const created = [];
    const skipped = [];

    await mkdir(githubDir, { recursive: true });

    for (const name of TEMPLATE_NAMES) {
      const dest = path.join(githubDir, name);
      const destStat = await this._stat(dest);

      if (destStat && destStat.isFile()) {
        skipped.push(name);
      } else {
        // Like `cp src dest`, a directory at `dest` receives the copy inside it.
        const target = destStat && destStat.isDirectory() ? path.join(dest, name) : dest;

        await copyFile(this._templatePath(name), target);
        created.push(name);
      }
    }

    let output = '';

    if (created.length > 0) {
      output += `Created: ${created.join(' ')}\n`;
    }

    if (skipped.length > 0) {
      output += `Already present, left untouched: ${skipped.join(' ')}\n`;
    }

    return output;
  }

  /**
   * @param {string} file - the path to stat (following symlinks, like
   *   `[ -f ]`).
   * @returns {Promise<import('node:fs').Stats|null>} its stats, or null
   *   when it doesn't exist.
   */
  async _stat(file) {
    try {
      return await stat(file);
    } catch {
      return null;
    }
  }
}

export default InitClaudeSetupTemplates;
