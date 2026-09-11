import { access } from 'node:fs/promises';
import { execFile, spawn } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import ConfigChain from '../../utils/config/ConfigChain.js';

const promisifiedExecFile = promisify(execFile);
const USAGE = 'Usage: commit_change.sh <repo_path> <type> <scope> <id> <subject> <agent> <model_name> ' +
  '<model_email> [body] [comment_url]';

/**
 * `execFile`-compatible helper that additionally supports an
 * `options.input` string, piped to the child process's stdin — needed
 * for `git commit -F -`, which the plain (`util.promisify`'d) `execFile`
 * can't feed (it has no `input` option; that's `execFileSync`-only).
 * Delegates straight to the promisified `execFile` whenever `input` is
 * absent, so every other call site is unaffected. Copied from
 * `AutoFixAllCleanupArtifacts.js`, which isn't shared/exported
 * elsewhere yet (see `docs/agents/architecture/script-engine.md`'s "no
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
 * Native equivalent of `auto-fix-issue/scripts/commit_change_shell.sh`:
 * commits changes already staged by a specialist agent, using a
 * per-agent commit message built from the repo's commit message
 * template shape, then pushes the current branch. See
 * docs/agents/plans/428-migrate-auto-fix-issue-commit-change-entrypoint-to-native-node-js/node.md's
 * "Shared contracts".
 */
class AutoFixIssueCommitChange {
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
   * Native implementation of the `auto-fix-issue-commit-change` migrated
   * entrypoint — byte-identical stdout/exit-code counterpart to
   * `commit_change_shell.sh`. Validates that all other arguments are
   * present (usage message on the first missing/empty one, propagated
   * uncaught so the caller exits 1); does NOT stage anything itself —
   * the caller is expected to have already staged the files it wants
   * committed.
   * @param {string} type - the commit type (e.g. `fix`, `feat`).
   * @param {string} scope - the commit scope.
   * @param {string} id - the issue's numeric id.
   * @param {string} subject - the commit subject line's text.
   * @param {string} agent - the acting specialist agent's name, used in
   *   the commit's own `Co-Authored-By` trailer and to resolve its
   *   commit-author email.
   * @param {string} modelName - the acting model's display name, used
   *   in the model's own `Co-Authored-By` trailer.
   * @param {string} modelEmail - the acting model's email, used in the
   *   model's own `Co-Authored-By` trailer and as the agent email
   *   fallback.
   * @param {string} [body] - optional commit body text.
   * @param {string} [commentUrl] - optional PR review/comment URL this
   *   commit addresses, added as an `Addresses-Comment:` trailer.
   * @returns {Promise<string>} `git commit`'s own stdout (its `[branch
   *   hash] subject` summary block) followed by `git push -u`'s own
   *   stdout — the shell counterpart never redirects either call's
   *   stdout, so the native side relays both verbatim, in order, for
   *   byte-identical parity.
   */
  async run(type, scope, id, subject, agent, modelName, modelEmail, body, commentUrl) {
    const repoPath = this._repoContext.repoPath;

    if (!repoPath || !type || !scope || !id || !subject || !agent || !modelName || !modelEmail) {
      throw new Error(USAGE);
    }

    const message = await this._buildMessage(repoPath, type, scope, id, subject, agent, modelName, modelEmail,
      body, commentUrl);

    const commitStdout = await this._commit(repoPath, message);
    const pushStdout = await this._pushCurrentBranch(repoPath);

    return commitStdout + pushStdout;
  }

  /**
   * Build the commit message exactly as `commit_change_shell.sh` does:
   * subject line, then optionally the body (blank line + body), then
   * optionally an `Addresses-Comment:` trailer (blank line + line),
   * then a blank line, then the model's `Co-Authored-By` trailer
   * (unless `omit_model_coauthor` is set), then the agent's own
   * `Co-Authored-By` trailer.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} type - the commit type.
   * @param {string} scope - the commit scope.
   * @param {string} id - the issue's numeric id.
   * @param {string} subject - the commit subject line's text.
   * @param {string} agent - the acting specialist agent's name.
   * @param {string} modelName - the acting model's display name.
   * @param {string} modelEmail - the acting model's email.
   * @param {string} [body] - optional commit body text.
   * @param {string} [commentUrl] - optional PR review/comment URL.
   * @returns {Promise<string>} the assembled commit message.
   */
  async _buildMessage(repoPath, type, scope, id, subject, agent, modelName, modelEmail, body, commentUrl) {
    const templateEngine = await this._commitTemplateEngineGet(repoPath);
    const agentEmail = templateEngine === 'new'
      ? await this._agentEmailGet(repoPath, agent, modelEmail)
      : modelEmail;
    const omitModelCoauthor = await this._modelCoauthorOmitted(repoPath);

    const lines = [`${type}(${scope}): ${subject} (issue #${id})`];

    if (body) {
      lines.push('', body);
    }

    if (commentUrl) {
      lines.push('', `Addresses-Comment: ${commentUrl}`);
    }

    lines.push('');

    if (!omitModelCoauthor) {
      lines.push(`Co-Authored-By: ${modelName} <${modelEmail}>`);
    }

    lines.push(`Co-Authored-By: ${agent} agent <${agentEmail}>`);

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
   * `agent_email_get`, for this entrypoint's own use only.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} agent - the acting specialist agent's name.
   * @param {string} modelEmail - the acting model's email, used as the
   *   fallback when no config value resolves.
   * @returns {Promise<string>} the resolved commit-author email for
   *   `agent`, with any `{agent}` placeholder substituted.
   */
  async _agentEmailGet(repoPath, agent, modelEmail) {
    const value = await this._configChain.read(repoPath, 'git', `agents.${agent}`, 'email');

    if (value === undefined || value === null) {
      return modelEmail;
    }

    return String(value).replaceAll('{agent}', agent);
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
      await access(filePath);

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Commits whatever is already staged with `message`, mirroring
   * `commit_change_shell.sh`'s inline `git commit -F -` pipeline —
   * `git commit`'s own stdout is left unredirected in the shell script,
   * so it's relayed here too.
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

export default AutoFixIssueCommitChange;
