import { access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import IssueFile from './IssueFile.js';

const NUMERIC_ID_PATTERN = /^[0-9]+$/;

/**
 * Native implementation of the `resolve-plan-paths` migrated
 * entrypoint — see docs/agents/architecture/script-engine.md and
 * docs/agents/plans/235-migrate-resolve-plan-paths-entrypoint-to-native-node-js/plan.md
 * for the full design/shared contracts. Byte-identical stdout/exit-code
 * counterpart to `arcanum/_lib/resolve_plan_paths_shell.sh`. Purely
 * filesystem-based — no GitHub/network dependency.
 */
class ResolvePlanPaths {
  /**
   * Resolve the issue file and plan dir/file for a given issue id,
   * creating the plan dir as a side effect. Always resolves to an
   * `ISSUE_FILE=`/`PLAN_DIR=`/`PLAN_FILE=`/`PLAN_EXISTS=` stdout
   * string, exiting 0 — the exceptions are a non-numeric id or no
   * matching issue file, both of which throw (propagated uncaught,
   * same hard-failure class as `ResolveIdAndFile#run`).
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} issuesFolder - the local issues folder to search
   *   for an existing `<id>_*`/`<id>-*` file, relative to `repoPath`.
   * @param {string} plansFolder - the local plans folder under which
   *   the plan dir/file are resolved, relative to `repoPath`.
   * @param {string} id - the issue id.
   * @returns {Promise<string>} the `ISSUE_FILE=.../PLAN_EXISTS=...` output.
   */
  async run(repoPath, issuesFolder, plansFolder, id) {
    if (!NUMERIC_ID_PATTERN.test(id)) {
      throw new Error(
        `Error: issue id must be numeric and linked to a GitHub issue (got '${id}'). Local-only ids are no longer supported.`
      );
    }

    const issueFile = await IssueFile.findExisting(repoPath, issuesFolder, id);

    if (!issueFile) {
      throw new Error(`Error: no issue file found for id ${id}`);
    }

    const baseName = path.basename(issueFile, '.md');
    const planDir = path.posix.join(plansFolder, baseName);
    const planFile = path.posix.join(planDir, 'plan.md');
    const planExists = await this._exists(path.join(repoPath, planFile));

    await mkdir(path.join(repoPath, planDir), { recursive: true });

    return `ISSUE_FILE=${issueFile}\nPLAN_DIR=${planDir}\nPLAN_FILE=${planFile}\nPLAN_EXISTS=${planExists}\n`;
  }

  /**
   * Check whether a path exists on disk.
   * @param {string} targetPath - the absolute path to check.
   * @returns {Promise<boolean>} true when the path exists.
   */
  async _exists(targetPath) {
    try {
      await access(targetPath);

      return true;
    } catch {
      return false;
    }
  }
}

export default ResolvePlanPaths;
