import { readdir } from 'node:fs/promises';
import path from 'node:path';

const USAGE = 'Usage: list_plan_agents.sh <plan_dir>';
const PLAN_FILE_BASENAME = 'plan';

/**
 * Native equivalent of
 * `auto-fix-issue/scripts/list_plan_agents_shell.sh`: lists the
 * specialist agents that have their own plan file in a plan dir. Every
 * `<agent-name>.md` file directly inside `<planDir>` (except `plan.md`
 * itself) corresponds to a specialist agent. See
 * docs/agents/plans/431-migrate-auto-fix-issue-list-plan-agents-entrypoint-to-native-node-js/node.md.
 */
class AutoFixIssueListPlanAgents {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Function} [deps.readdir] - `fs.promises.readdir`-compatible
   *   directory reader.
   */
  constructor({ readdir: readdirDep = readdir } = {}) {
    this._readdir = readdirDep;
  }

  /**
   * Native implementation of the `auto-fix-issue-list-plan-agents`
   * migrated entrypoint — byte-identical stdout/exit-code counterpart to
   * `list_plan_agents_shell.sh`. Validates that `planDir` is present
   * (usage message otherwise, propagated uncaught so the caller exits
   * 1), then lists its specialist-agent names.
   * @param {string} planDir - the plan directory to scan, relative to
   *   the caller's cwd (or absolute) — never joined against a repo
   *   path, mirroring the shell script's own direct `[[ -d "$PLAN_DIR"
   *   ]]` usage.
   * @returns {Promise<string>} one agent name per line (sorted by the
   *   matched files' full path), with a trailing newline, or `''` when
   *   `planDir` doesn't exist or has no agent files.
   */
  async run(planDir) {
    if (!planDir) {
      throw new Error(USAGE);
    }

    const entries = await this._readMarkdownFiles(planDir);

    if (entries.length === 0) {
      return '';
    }

    const names = entries
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      .map((entry) => path.basename(entry, '.md'))
      .filter((name) => name !== PLAN_FILE_BASENAME);

    return names.length > 0 ? `${names.join('\n')}\n` : '';
  }

  /**
   * @param {string} planDir - the plan directory to scan.
   * @returns {Promise<string[]>} the full paths of every entry matching
   *   `*.md` directly inside `planDir` (non-recursive) — matching the
   *   shell script's own glob (`"$PLAN_DIR"/*.md`, which does not
   *   discriminate between files/dirs), or `[]` when `planDir` doesn't
   *   exist.
   */
  async _readMarkdownFiles(planDir) {
    let entries;

    try {
      entries = await this._readdir(planDir);
    } catch {
      return [];
    }

    return entries
      .filter((name) => name.endsWith('.md'))
      .map((name) => path.join(planDir, name));
  }
}

export default AutoFixIssueListPlanAgents;
