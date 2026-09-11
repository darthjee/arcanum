import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const USAGE = 'Usage: create_branch.sh <repo_path> <plan_dir> <id>';
const BRANCH_HEADING = /^## Branch/;

/**
 * Native equivalent of `auto-fix-issue/scripts/create_branch_shell.sh`:
 * creates (or checks out, if it already exists locally) the branch
 * defined in an implementation plan's `## Branch` section, falling back
 * to `issue-<id>` when the plan file/section/name is missing or empty.
 * See docs/agents/plans/429-migrate-auto-fix-issue-create-branch-entrypoint-to-native-node-js/node.md.
 */
class AutoFixIssueCreateBranch {
  /**
   * @param {import('../../context/RepoContext.js').default} repoContext -
   *   the target repo's context (provides `repoPath`).
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Function} [deps.execFileAsync] - promisified `execFile`.
   * @param {Function} [deps.readFile] - `fs.readFile`-compatible reader.
   */
  constructor(repoContext, { execFileAsync: execFileAsyncDep = execFileAsync, readFile: readFileDep = readFile } = {}) {
    this._repoContext = repoContext;
    this._execFileAsync = execFileAsyncDep;
    this._readFile = readFileDep;
  }

  /**
   * Native implementation of the `auto-fix-issue-create-branch` migrated
   * entrypoint — byte-identical stdout/exit-code counterpart to
   * `create_branch_shell.sh`. Validates that `planDir`/`id` are present
   * (usage message otherwise, propagated uncaught so the caller exits
   * 1), resolves the branch name, checks it out (creating it if it
   * doesn't exist locally yet), and returns it.
   * @param {string} planDir - the plan directory, relative to the
   *   target repo's root (or absolute).
   * @param {string} id - the issue's numeric id, used for the
   *   `issue-<id>` fallback branch name.
   * @returns {Promise<string>} the resulting branch name — `dispatch()`
   *   prints it to stdout with exit code 0.
   */
  async run(planDir, id) {
    const repoPath = this._repoContext.repoPath;

    if (!repoPath || !planDir || !id) {
      throw new Error(USAGE);
    }

    const branch = await this._resolveBranch(repoPath, planDir, id);

    await this._checkout(repoPath, branch);

    return branch;
  }

  /**
   * Resolve the branch name from `<planDir>/plan.md`'s `## Branch`
   * section, falling back to `issue-<id>` when the plan file doesn't
   * exist, has no `## Branch` section, or the extracted name is empty —
   * native re-derivation of the shell script's
   * `grep -A2 '^## Branch' | tail -1 | tr -d '`[:space:]'` pipeline.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} planDir - the plan directory, relative to
   *   `repoPath` (or absolute).
   * @param {string} id - the issue's numeric id.
   * @returns {Promise<string>} the resolved branch name.
   */
  async _resolveBranch(repoPath, planDir, id) {
    const planFile = path.join(repoPath, planDir, 'plan.md');
    const content = await this._readPlanFile(planFile);

    const extracted = content === null ? '' : this._extractBranchName(content);

    return extracted || `issue-${id}`;
  }

  /**
   * @param {string} planFile - the plan file's absolute path.
   * @returns {Promise<string|null>} the plan file's contents, or `null`
   *   when it doesn't exist (mirroring the shell script's `[[ -f ...
   *   ]]` guard).
   */
  async _readPlanFile(planFile) {
    try {
      return await this._readFile(planFile, 'utf8');
    } catch {
      return null;
    }
  }

  /**
   * Find the `## Branch` heading line, take the next non-empty line
   * after it, then strip every backtick and whitespace character
   * anywhere in it (not just leading/trailing — matching `tr -d
   * '`[:space:]'`'s behavior).
   * @param {string} content - the plan file's contents.
   * @returns {string} the extracted branch name, or `''` when no
   *   `## Branch` heading or no non-empty line follows it.
   */
  _extractBranchName(content) {
    const lines = content.split('\n');
    const headingIndex = lines.findIndex((line) => BRANCH_HEADING.test(line));

    if (headingIndex === -1) {
      return '';
    }

    const nextLine = lines.slice(headingIndex + 1).find((line) => line.trim() !== '');

    return nextLine ? nextLine.replace(/[`\s]/g, '') : '';
  }

  /**
   * Check out `branch`, creating it first if it doesn't already exist
   * locally — native re-derivation of the shell script's `git show-ref
   * --verify --quiet refs/heads/<branch>` / `git checkout [-b]
   * <branch>` pair.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} branch - the branch name to check out.
   * @returns {Promise<void>}
   */
  async _checkout(repoPath, branch) {
    const exists = await this._branchExists(repoPath, branch);

    if (exists) {
      await this._execFileAsync('git', ['checkout', branch], { cwd: repoPath });
      return;
    }

    await this._execFileAsync('git', ['checkout', '-b', branch], { cwd: repoPath });
  }

  /**
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} branch - the branch name to check.
   * @returns {Promise<boolean>} whether `branch` already exists locally.
   */
  async _branchExists(repoPath, branch) {
    try {
      await this._execFileAsync('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], {
        cwd: repoPath
      });

      return true;
    } catch {
      return false;
    }
  }
}

export default AutoFixIssueCreateBranch;
