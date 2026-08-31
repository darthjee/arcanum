import { execFile, spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { promisify } from 'node:util';

const promisifiedExecFile = promisify(execFile);
const USAGE = 'Usage: cleanup_artifacts.sh <repo_path> <issue_file> <plan_dir> <id> <model_name> <model_email>';

/**
 * `execFile`-compatible helper that additionally supports an
 * `options.input` string, piped to the child process's stdin — needed
 * for `git commit -F -`, which the plain (`util.promisify`'d) `execFile`
 * can't feed (it has no `input` option; that's `execFileSync`-only).
 * Delegates straight to the promisified `execFile` whenever `input` is
 * absent, so every other call site is unaffected.
 * @param {string} file - the executable to run.
 * @param {string[]} [args] - the executable's arguments.
 * @param {object} [options] - `child_process.spawn` options, plus the
 *   optional `input` string.
 * @returns {Promise<{stdout: string, stderr: string}>} resolves on exit
 *   code 0; rejects with an `Error` carrying `code`/`stdout`/`stderr`
 *   otherwise, mirroring `promisify(execFile)`'s rejection shape.
 */
function defaultExecFileAsync(file, args = [], options = {}) {
  const { input, ...spawnOptions } = options;

  if (input === undefined) {
    return promisifiedExecFile(file, args, spawnOptions);
  }

  return new Promise((resolve, reject) => {
    const child = spawn(file, args, spawnOptions);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', reject);

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const error = new Error(`Command failed: ${file} ${args.join(' ')}\n${stderr}`);
      error.code = code;
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });

    child.stdin.write(input);
    child.stdin.end();
  });
}

/**
 * Native equivalent of `auto-fix-all/scripts/cleanup_artifacts_shell.sh`:
 * removes the planning artifacts (issue file + plan dir) once a PR is
 * approved, committing and pushing only when something actually ended up
 * staged. See
 * docs/agents/plans/254-migrate-auto-fix-all-cleanup-artifacts-entrypoint-to-native-node-js/plan.md's
 * "Shared contracts".
 */
class AutoFixAllCleanupArtifacts {
  /**
   * @param {import('../context/RepoContext.js').default} repoContext -
   *   the target repo's context (provides `repoPath`).
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Function} [deps.execFileAsync] - promisified `execFile`.
   */
  constructor(repoContext, { execFileAsync = defaultExecFileAsync } = {}) {
    this._repoContext = repoContext;
    this._execFileAsync = execFileAsync;
  }

  /**
   * Native implementation of the `auto-fix-all-cleanup-artifacts`
   * migrated entrypoint — byte-identical stdout/exit-code counterpart to
   * `cleanup_artifacts_shell.sh`. Validates that all
   * other arguments are present (usage message on missing/empty
   * argument, propagated uncaught so the caller exits 1). Stages removal
   * of `issueFile`/`planDir` when tracked, then — only if something ends
   * up staged — commits with a hardcoded message and pushes the current
   * branch.
   * @param {string} issueFile - the issue markdown file's path (relative
   *   to `repoPath`).
   * @param {string} planDir - the plan directory's path (relative to
   *   `repoPath`).
   * @param {string} id - the issue's numeric id.
   * @param {string} modelName - the acting model's display name, used
   *   in the commit's `Co-Authored-By` trailer.
   * @param {string} modelEmail - the acting model's email, used in both
   *   `Co-Authored-By` trailers.
   * @returns {Promise<string>} `''` for the no-op path (nothing tracked
   *   to remove, or nothing ended up staged); otherwise `git commit`'s
   *   own stdout (its `[branch hash] subject` summary block) followed by
   *   `git push -u`'s own stdout (its `branch '<name>' set up to track
   *   'origin/<name>'.` confirmation) — the shell counterpart never
   *   redirects either call's stdout, so the native side relays both
   *   verbatim, in order, for byte-identical parity.
   */
  async run(issueFile, planDir, id, modelName, modelEmail) {
    const repoPath = this._repoContext.repoPath;

    if (!repoPath || !issueFile || !planDir || !id || !modelName || !modelEmail) {
      throw new Error(USAGE);
    }

    if (await this._isTracked(issueFile)) {
      await this._execFileAsync('git', ['rm', issueFile], { cwd: repoPath });
    }

    if ((await this._isDirectory(planDir)) && (await this._isTracked(planDir))) {
      await this._execFileAsync('git', ['rm', '-r', planDir], { cwd: repoPath });
    }

    if (await this._nothingStaged()) {
      return '';
    }

    const commitStdout = await this._commit(id, modelName, modelEmail);
    const pushStdout = await this._pushCurrentBranch();

    return commitStdout + pushStdout;
  }

  /**
   * @param {string} target - the file/dir path to check, relative to
   *   `repoPath`.
   * @returns {Promise<boolean>} whether `git ls-files <target>` reports
   *   any tracked path.
   */
  async _isTracked(target) {
    const { stdout } = await this._execFileAsync('git', ['ls-files', target], { cwd: this._repoContext.repoPath });

    return stdout.trim().length > 0;
  }

  /**
   * @param {string} target - the path to check, relative to `repoPath`.
   * @returns {Promise<boolean>} whether `target` exists on disk and is a
   *   directory.
   */
  async _isDirectory(target) {
    try {
      const stats = await stat(`${this._repoContext.repoPath}/${target}`);

      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * @returns {Promise<boolean>} whether `git diff --cached --quiet`
   *   reports nothing staged.
   */
  async _nothingStaged() {
    try {
      await this._execFileAsync('git', ['diff', '--cached', '--quiet'], { cwd: this._repoContext.repoPath });

      return true;
    } catch (error) {
      if (error.code === 1) {
        return false;
      }

      throw error;
    }
  }

  /**
   * Commits whatever is staged with the hardcoded planning-artifacts
   * removal message, mirroring `cleanup_artifacts_shell.sh`'s inline
   * `git commit -F -` heredoc exactly (not `arcanum/_lib/commit_template.sh`/
   * `agent_email.sh`) — including leaving `git commit`'s own stdout
   * (unlike the `git rm` calls above, the shell script never redirects
   * this one to `/dev/null`) for the caller to relay.
   * @param {string} id - the issue's numeric id.
   * @param {string} modelName - the acting model's display name.
   * @param {string} modelEmail - the acting model's email.
   * @returns {Promise<string>} `git commit`'s own stdout.
   */
  async _commit(id, modelName, modelEmail) {
    const message = [
      `chore(docs): remove planning artifacts (issue #${id})`,
      '',
      `Co-Authored-By: ${modelName} <${modelEmail}>`,
      `Co-Authored-By: architect agent <${modelEmail}>`
    ].join('\n');

    const { stdout } = await this._execFileAsync('git', ['commit', '-F', '-'], {
      cwd: this._repoContext.repoPath,
      input: message
    });

    return stdout;
  }

  /**
   * Native re-derivation of `arcanum/_lib/push.sh`'s `push_current_branch`
   * for this entrypoint's own use only (per `script-engine.md`'s "No
   * standalone, wholesale `_lib` migration" rule): resolves the current
   * branch, then pushes it to `origin` with upstream tracking. `git push
   * -u`'s own stdout (its `branch '<name>' set up to track
   * 'origin/<name>'.` confirmation — its transfer summary goes to
   * stderr instead) is left unredirected in the shell script, so it's
   * relayed here too, same as `#_commit`'s.
   * @returns {Promise<string>} `git push`'s own stdout.
   */
  async _pushCurrentBranch() {
    const { stdout: branchStdout } = await this._execFileAsync('git', ['branch', '--show-current'], {
      cwd: this._repoContext.repoPath
    });
    const branch = branchStdout.trim();

    const { stdout } = await this._execFileAsync('git', ['push', '-u', 'origin', `${branch}:${branch}`], {
      cwd: this._repoContext.repoPath
    });

    return stdout;
  }
}

export default AutoFixAllCleanupArtifacts;
