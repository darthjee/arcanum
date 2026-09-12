import { stat } from 'node:fs/promises';
import { execFile, spawn } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import ConfigChain from '../../utils/config/ConfigChain.js';

const promisifiedExecFile = promisify(execFile);
const USAGE = 'Usage: commit_plan.sh <repo_path> <plan_dir> <id> <model_name> <model_email>';
const AGENT = 'architect';

/**
 * `execFile`-compatible helper that additionally supports an
 * `options.input` string, piped to the child process's stdin — needed
 * for `git commit -F -`, which the plain (`util.promisify`'d) `execFile`
 * can't feed (it has no `input` option; that's `execFileSync`-only).
 * Delegates straight to the promisified `execFile` whenever `input` is
 * absent, so every other call site is unaffected. Copied from
 * `AutoFixIssueCommitChange.js`, which isn't shared/exported elsewhere
 * yet (see `docs/agents/architecture/script-engine.md`'s "no
 * standalone, wholesale `_lib` migration" rule).
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
 * Native equivalent of `auto-plan-issue/scripts/commit_plan_shell.sh`:
 * stages and commits the implementation plan directory created by the
 * auto-plan-issue skill, always on behalf of the `"architect"` agent,
 * using a commit message built from the repo's commit message template
 * shape, then pushes the current branch. See
 * docs/agents/plans/449-migrate-auto-plan-issue-commit-plan-entrypoint-to-native-node-js/node.md's
 * "Shared contracts".
 */
class AutoPlanIssueCommitPlan {
  /**
   * @param {import('../../context/RepoContext.js').default} repoContext -
   *   the target repo's context (provides `repoPath`).
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Function} [deps.execFileAsync] - promisified `execFile`
   *   (`options.input`-capable, see `defaultExecFileAsync`).
   * @param {ConfigChain} [deps.configChain] - 3-tier config reader,
   *   reused as-is (already the native counterpart of
   *   `config_chain_read`) rather than re-derived.
   */
  constructor(repoContext, { execFileAsync = defaultExecFileAsync, configChain = new ConfigChain() } = {}) {
    this._repoContext = repoContext;
    this._execFileAsync = execFileAsync;
    this._configChain = configChain;
  }

  /**
   * Native implementation of the `auto-plan-issue-commit-plan` migrated
   * entrypoint — byte-identical stdout/exit-code counterpart to
   * `commit_plan_shell.sh`. Validates that all other arguments are
   * present (usage message on the first missing/empty one, propagated
   * uncaught so the caller exits 1), and that `planDir` exists on disk;
   * stages `planDir` itself (unlike `AutoFixIssueCommitChange`, whose
   * caller stages beforehand).
   * @param {string} planDir - the implementation plan directory to stage
   *   and commit.
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
  async run(planDir, id, modelName, modelEmail) {
    const repoPath = this._repoContext.repoPath;

    if (!repoPath || !planDir || !id || !modelName || !modelEmail) {
      throw new Error(USAGE);
    }

    if (!(await this._isDirectory(planDir))) {
      throw new Error(`Error: directory not found: ${planDir}`);
    }

    await this._execFileAsync('git', ['add', planDir], { cwd: repoPath });

    const message = await this._buildMessage(repoPath, id, modelName, modelEmail);

    const commitStdout = await this._commit(repoPath, message);
    const pushStdout = await this._pushCurrentBranch(repoPath);

    return commitStdout + pushStdout;
  }

  /**
   * Build the commit message exactly as `commit_plan_shell.sh` does:
   * subject line, blank line, then the model's `Co-Authored-By` trailer
   * (unless `omit_model_coauthor` is set), then the fixed `"architect"`
   * agent's own `Co-Authored-By` trailer.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} id - the issue's numeric id.
   * @param {string} modelName - the acting model's display name.
   * @param {string} modelEmail - the acting model's email.
   * @returns {Promise<string>} the assembled commit message.
   */
  async _buildMessage(repoPath, id, modelName, modelEmail) {
    const templateEngine = await this._commitTemplateEngineGet(repoPath);
    const agentEmail = templateEngine === 'new'
      ? await this._agentEmailGet(repoPath, modelEmail)
      : modelEmail;
    const omitModelCoauthor = await this._modelCoauthorOmitted(repoPath);

    const lines = [`docs(plan): add implementation plan (issue #${id})`, ''];

    if (!omitModelCoauthor) {
      lines.push(`Co-Authored-By: ${modelName} <${modelEmail}>`);
    }

    lines.push(`Co-Authored-By: ${AGENT} agent <${agentEmail}>`);

    return lines.join('\n');
  }

  /**
   * Native re-derivation of `arcanum/_lib/commit_template.sh`'s
   * `commit_template_engine_get`, for this entrypoint's own use only
   * (per `script-engine.md`'s "no standalone, wholesale `_lib`
   * migration" rule).
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<'new'|'old'>} `"new"` when
   *   `.github/commit_message_template-2.0.md` exists, `"old"` when
   *   only `.github/commit_message_template.md` exists, `"new"` when
   *   neither does.
   */
  async _commitTemplateEngineGet(repoPath) {
    if (await this._fileExists(path.join(repoPath, '.github', 'commit_message_template-2.0.md'))) {
      return 'new';
    }

    if (await this._fileExists(path.join(repoPath, '.github', 'commit_message_template.md'))) {
      return 'old';
    }

    return 'new';
  }

  /**
   * Native re-derivation of `arcanum/_lib/agent_email.sh`'s
   * `agent_email_get`, for this entrypoint's own use only. The agent is
   * always the fixed literal `"architect"` — never caller-supplied.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} modelEmail - the acting model's email, used as the
   *   fallback when no config value resolves.
   * @returns {Promise<string>} the resolved commit-author email for the
   *   `"architect"` agent, with any `{agent}` placeholder substituted.
   */
  async _agentEmailGet(repoPath, modelEmail) {
    const value = await this._configChain.read(repoPath, 'git', `agents.${AGENT}`, 'email');

    if (value === undefined || value === null) {
      return modelEmail;
    }

    return String(value).replaceAll('{agent}', AGENT);
  }

  /**
   * Native re-derivation of `arcanum/_lib/agent_email.sh`'s
   * `model_coauthor_omitted`, for this entrypoint's own use only.
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<boolean>} `true` only when the resolved
   *   `git.omit_model_coauthor` config value is the literal string or
   *   boolean `true`, `false` otherwise (including absent).
   */
  async _modelCoauthorOmitted(repoPath) {
    const value = await this._configChain.read(repoPath, 'git', 'omit_model_coauthor');

    return value === true || value === 'true';
  }

  /**
   * @param {string} filePath - the path to check.
   * @returns {Promise<boolean>} whether `filePath` exists.
   */
  async _fileExists(filePath) {
    try {
      await stat(filePath);

      return true;
    } catch {
      return false;
    }
  }

  /**
   * @param {string} dirPath - the path to check.
   * @returns {Promise<boolean>} whether `dirPath` exists and is a
   *   directory.
   */
  async _isDirectory(dirPath) {
    try {
      const stats = await stat(dirPath);

      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Commits whatever is already staged with `message`, mirroring
   * `commit_plan_shell.sh`'s inline `git commit -F -` pipeline — `git
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

export default AutoPlanIssueCommitPlan;
