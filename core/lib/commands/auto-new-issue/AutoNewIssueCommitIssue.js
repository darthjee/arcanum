import { stat } from 'node:fs/promises';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import AgentEmail from '../../../../shared/lib/config/AgentEmail.js';
import ConfigChain from '../../../../shared/lib/config/ConfigChain.js';
import CoauthorTrailers from '../../utils/git/CoauthorTrailers.js';

const promisifiedExecFile = promisify(execFile);
const USAGE = 'Usage: commit_issue.sh <repo_path> <file_path> <id> <model_name> <model_email>';
const AGENT = 'architect';

/**
 * `execFile`-compatible helper that additionally supports an
 * `options.input` string, piped to the child process's stdin — needed
 * for `git commit -F -`, which the plain (`util.promisify`'d) `execFile`
 * can't feed (it has no `input` option; that's `execFileSync`-only).
 * Delegates straight to the promisified `execFile` whenever `input` is
 * absent, so every other call site is unaffected. Copied from
 * `AutoFixIssueCommitChange.js`/`AutoPlanIssueCommitPlan.js`, which
 * aren't shared/exported elsewhere yet (see
 * `docs/agents/architecture/script-engine.md`'s "no standalone,
 * wholesale `_lib` migration" rule).
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
 * Native equivalent of `auto-new-issue/scripts/commit_issue_shell.sh`:
 * stages and commits the issue file created by the auto-new-issue
 * skill, always on behalf of the `"architect"` agent, using a commit
 * message built from the repo's commit message template shape, then
 * pushes the current branch. See
 * docs/agents/plans/450-migrate-auto-new-issue-commit-issue-entrypoint-to-native-node-js/node.md's
 * "Shared contracts".
 */
class AutoNewIssueCommitIssue {
  /**
   * @param {import('../../context/RepoContext.js').default} repoContext -
   *   the target repo's context (provides `repoPath`).
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Function} [deps.execFileAsync] - promisified `execFile`
   *   (`options.input`-capable, see `defaultExecFileAsync`).
   * @param {ConfigChain} [deps.configChain] - 3-tier config reader,
   *   reused as-is (already the native counterpart of
   *   `config_chain_read`) rather than re-derived.
   * @param {AgentEmail} [deps.agentEmail] - the shared agent-email
   *   resolver (defaults to one built on `configChain`).
   * @param {CoauthorTrailers} [deps.coauthorTrailers] - the shared
   *   `Co-Authored-By` trailer builder (defaults to one built on
   *   `configChain`/`agentEmail`).
   */
  constructor(repoContext, {
    execFileAsync = defaultExecFileAsync,
    configChain = new ConfigChain(),
    agentEmail = new AgentEmail({ configChain }),
    coauthorTrailers = new CoauthorTrailers({ configChain, agentEmail })
  } = {}) {
    this._repoContext = repoContext;
    this._execFileAsync = execFileAsync;
    this._configChain = configChain;
    this._agentEmail = agentEmail;
    this._coauthorTrailers = coauthorTrailers;
  }

  /**
   * Native implementation of the `auto-new-issue-commit-issue` migrated
   * entrypoint — byte-identical stdout/exit-code counterpart to
   * `commit_issue_shell.sh`. Validates that all other arguments are
   * present (usage message on the first missing/empty one, propagated
   * uncaught so the caller exits 1), and that `filePath` exists on disk
   * and is a file; stages `filePath` itself, mirroring
   * `commit_issue_shell.sh`'s own `git add "$FILE_PATH"`.
   * @param {string} filePath - the issue file to stage and commit.
   * @param {string} id - the issue's numeric id.
   * @param {string} modelName - the acting model's display name, used in
   *   the model's own `Co-Authored-By` trailer.
   * @param {string} modelEmail - the acting model's email, used in the
   *   model's own `Co-Authored-By` trailer and as the `"architect"`
   *   agent email fallback.
   * @returns {Promise<string>} `git commit`'s own stdout (its `[branch
   *   hash] subject` summary block) followed by `git push -u`'s own
   *   stdout — the shell counterpart never redirects either call's
   *   stdout, so the native side relays both verbatim, in order, for
   *   byte-identical parity.
   */
  async run(filePath, id, modelName, modelEmail) {
    const repoPath = this._repoContext.repoPath;

    if (!repoPath || !filePath || !id || !modelName || !modelEmail) {
      throw new Error(USAGE);
    }

    if (!(await this._isFile(filePath))) {
      throw new Error(`Error: file not found: ${filePath}`);
    }

    await this._execFileAsync('git', ['add', filePath], { cwd: repoPath });

    const message = await this._buildMessage(repoPath, id, modelName, modelEmail);

    const commitStdout = await this._commit(repoPath, message);
    const pushStdout = await this._pushCurrentBranch(repoPath);

    return commitStdout + pushStdout;
  }

  /**
   * Build the commit message exactly as `commit_issue_shell.sh` does:
   * subject line, then — only when `CoauthorTrailers` yields any — a
   * blank line and the fixed `"architect"` agent's `Co-Authored-By`
   * trailer lines.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} id - the issue's numeric id.
   * @param {string} modelName - the acting model's display name.
   * @param {string} modelEmail - the acting model's email.
   * @returns {Promise<string>} the assembled commit message.
   */
  async _buildMessage(repoPath, id, modelName, modelEmail) {
    const trailers = await this._coauthorTrailers.lines(repoPath, AGENT, modelName, modelEmail);
    const lines = [`docs(issue): add issue file (issue #${id})`];

    if (trailers.length > 0) {
      lines.push('', ...trailers);
    }

    return lines.join('\n');
  }

  /**
   * @param {string} filePath - the path to check.
   * @returns {Promise<boolean>} whether `filePath` exists and is a
   *   regular file.
   */
  async _isFile(filePath) {
    try {
      const stats = await stat(filePath);

      return stats.isFile();
    } catch {
      return false;
    }
  }

  /**
   * Commits whatever is already staged with `message`, mirroring
   * `commit_issue_shell.sh`'s inline `git commit -F -` pipeline — `git
   * commit`'s own stdout is left unredirected in the shell script, so
   * it's relayed here too.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} message - the assembled commit message.
   * @returns {Promise<string>} `git commit`'s own stdout.
   */
  async _commit(repoPath, message) {
    const { stdout } = await this._execFileAsync('git', ['commit', '-F', '-'], {
      cwd: repoPath,
      input: message
    });

    return stdout;
  }

  /**
   * Native re-derivation of `arcanum/_lib/push.sh`'s
   * `push_current_branch` for this entrypoint's own use only: resolves
   * the current branch, then pushes it to `origin` with upstream
   * tracking. `git push -u`'s own stdout is left unredirected in the
   * shell script, so it's relayed here too.
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<string>} `git push`'s own stdout.
   */
  async _pushCurrentBranch(repoPath) {
    const { stdout: branchStdout } = await this._execFileAsync('git', ['branch', '--show-current'], {
      cwd: repoPath
    });
    const branch = branchStdout.trim();

    const { stdout } = await this._execFileAsync('git', ['push', '-u', 'origin', `${branch}:${branch}`], {
      cwd: repoPath
    });

    return stdout;
  }
}

export default AutoNewIssueCommitIssue;
