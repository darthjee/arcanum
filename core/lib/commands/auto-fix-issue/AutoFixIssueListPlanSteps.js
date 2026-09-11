import { readdir } from 'node:fs/promises';
import path from 'node:path';

const USAGE = 'Usage: list_plan_steps.sh <plan_dir> <agent_name>';

/**
 * Native equivalent of
 * `auto-fix-issue/scripts/list_plan_steps_shell.sh`: lists a specialist
 * agent's ordered step files inside a plan dir. Every `*.md` file
 * directly inside `<planDir>/<agentName>` (no recursion) is one ordered
 * step for that agent's plan. See
 * docs/agents/plans/432-migrate-auto-fix-issue-list-plan-steps-entrypoint-to-native-node-js/node.md.
 */
class AutoFixIssueListPlanSteps {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Function} [deps.readdir] - `fs.promises.readdir`-compatible
   *   directory reader.
   */
  constructor({ readdir: readdirDep = readdir } = {}) {
    this._readdir = readdirDep;
  }

  /**
   * Native implementation of the `auto-fix-issue-list-plan-steps`
   * migrated entrypoint — byte-identical stdout/exit-code counterpart to
   * `list_plan_steps_shell.sh`. Validates that `planDir` and
   * `agentName` are both present (usage message otherwise, propagated
   * uncaught so the caller exits 1), then lists the agent's ordered
   * step files.
   * @param {string} planDir - the plan directory to scan, relative to
   *   the caller's cwd (or absolute) — never joined against a repo
   *   path, mirroring the shell script's own direct
   *   `[[ -d "$PLAN_DIR/$AGENT_NAME" ]]` usage.
   * @param {string} agentName - the specialist agent's subdirectory
   *   name inside `planDir`.
   * @returns {Promise<string>} one `<plan_dir>/<agent_name>/<file>`
   *   path per line (sorted alphabetically by filename), with a
   *   trailing newline, or `''` when `<planDir>/<agentName>` doesn't
   *   exist or has no step files.
   */
  async run(planDir, agentName) {
    if (!planDir || !agentName) {
      throw new Error(USAGE);
    }

    const stepsDir = path.join(planDir, agentName);
    const entries = await this._readMarkdownFiles(stepsDir);

    if (entries.length === 0) {
      return '';
    }

    const paths = entries
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      .map((entry) => path.join(stepsDir, entry));

    return `${paths.join('\n')}\n`;
  }

  /**
   * @param {string} stepsDir - the `<plan_dir>/<agent_name>` directory
   *   to scan.
   * @returns {Promise<string[]>} the bare filenames of every entry
   *   matching `*.md` directly inside `stepsDir` (non-recursive) —
   *   matching the shell script's own glob (`"$PLAN_DIR/$AGENT_NAME"/*.md`,
   *   which does not discriminate between files/dirs), or `[]` when
   *   `stepsDir` doesn't exist.
   */
  async _readMarkdownFiles(stepsDir) {
    let entries;

    try {
      entries = await this._readdir(stepsDir);
    } catch {
      return [];
    }

    return entries.filter((name) => name.endsWith('.md'));
  }
}

export default AutoFixIssueListPlanSteps;
