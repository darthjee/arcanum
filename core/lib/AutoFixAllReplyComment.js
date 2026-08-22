import { execFile } from 'node:child_process';
import { readFile as defaultReadFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import GithubToken from './GithubToken.js';
import Origin from './Origin.js';

const defaultExecFileAsync = promisify(execFile);
const DEFAULT_TIMEOUT_MS = 30000;
const USAGE = 'Usage: reply_comment.sh <repo_path> <id> <agent> <model_name> <model_email> <reply_body>';
const TEMPLATE_RELATIVE_PATH = 'auto-fix-all/templates/reply.tmpl.md';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
// `auto-monitor-issue-pr/scripts/resolve_pr_number.sh` is explicitly
// out-of-batch for this migration (see the issue) — shelled out to
// exactly like `reply_comment_shell.sh` does, resolved relative to this
// skill repo's own root (two levels up from `core/lib/`), not the
// target `repoPath` being operated on.
const RESOLVE_PR_NUMBER_SCRIPT = path.join(
  MODULE_DIR, '..', '..', 'auto-monitor-issue-pr', 'scripts', 'resolve_pr_number.sh'
);

/**
 * Native equivalent of `auto-fix-all/scripts/reply_comment_shell.sh`:
 * posts an attributed reply comment on the current branch's PR, then
 * pushes the branch. See
 * docs/agents/plans/256-migrate-auto-fix-all-reply-comment-entrypoint-to-native-node-js/plan.md's
 * "Shared contracts".
 */
class AutoFixAllReplyComment {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Origin} [deps.origin] - git-origin resolver.
   * @param {GithubToken} [deps.githubToken] - GitHub token resolver.
   * @param {Function} [deps.execFileAsync] - promisified `execFile`.
   * @param {Function} [deps.fetchFn] - `fetch`-compatible implementation
   *   (global `fetch` by default).
   * @param {number} [deps.timeoutMs] - the REST call's abort timeout,
   *   overridable for tests (defaults to the real 30s protocol value).
   * @param {Function} [deps.readFile] - `node:fs/promises` `readFile`-
   *   compatible implementation, used to read the reply template.
   */
  constructor({
    origin = new Origin(),
    githubToken = new GithubToken(),
    execFileAsync = defaultExecFileAsync,
    fetchFn = fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    readFile = defaultReadFile
  } = {}) {
    this._origin = origin;
    this._githubToken = githubToken;
    this._execFileAsync = execFileAsync;
    this._fetch = fetchFn;
    this._timeoutMs = timeoutMs;
    this._readFile = readFile;
  }

  /**
   * Native implementation of the `auto-fix-all-reply-comment` migrated
   * entrypoint — byte-identical stdout/exit-code counterpart to
   * `reply_comment_shell.sh`. Validates all six arguments, resolves the
   * current branch's PR number, posts the rendered reply template as a
   * PR comment over the GitHub REST API, then pushes the current
   * branch.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} id - the currently checked-out branch's issue id
   *   (a leading `#` is stripped); used only to resolve the PR.
   * @param {string} agent - the acting agent's name, for attribution.
   * @param {string} modelName - the acting model's display name, for
   *   attribution.
   * @param {string} modelEmail - the acting model's email, for
   *   attribution.
   * @param {string} replyBody - the full reply text.
   * @returns {Promise<string>} `git push -u`'s own stdout (its `branch
   *   '<name>' set up to track 'origin/<name>'.` confirmation — its
   *   transfer summary goes to stderr instead) on success: neither
   *   `push_current_branch` (`arcanum/_lib/push.sh`) nor
   *   `reply_comment_shell.sh` redirects that call's stdout, so the
   *   native side relays it too, for byte-identical parity (mirroring
   *   `AutoFixAllCleanupArtifacts.js`'s own `_pushCurrentBranch`). The
   *   `gh pr comment` call's own stdout is not relayed — see this
   *   migration's plan's "Shared contracts": it isn't captured/echoed
   *   by the shell script either.
   */
  async run(repoPath, id, agent, modelName, modelEmail, replyBody) {
    const cleanId = (id || '').replace(/^#/, '');

    if (!repoPath || !/^[0-9]+$/.test(cleanId) || !agent || !modelName || !modelEmail || !replyBody) {
      throw new Error(USAGE);
    }

    const prNumber = await this._resolvePrNumber(repoPath, cleanId);
    const { repo } = await this._origin.resolve(repoPath);
    const token = await this._githubToken.get(repoPath);
    const content = await this._renderTemplate(repoPath, { body: replyBody, agent, modelName, modelEmail });

    await this._postComment(repo, prNumber, token, content);

    return this._pushCurrentBranch(repoPath);
  }

  /**
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} id - the numeric issue id (leading `#` already stripped).
   * @returns {Promise<string>} the current branch's PR number.
   */
  async _resolvePrNumber(repoPath, id) {
    const { stdout } = await this._execFileAsync(RESOLVE_PR_NUMBER_SCRIPT, [repoPath, id]);

    return stdout.trim();
  }

  /**
   * Reads `auto-fix-all/templates/reply.tmpl.md` and substitutes its
   * placeholders, matching bash's `${var/pattern/repl}` (single,
   * first-occurrence substitution per placeholder, no templating
   * library).
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {object} fields - the substitution fields.
   * @param {string} fields.body - replaces `%%BODY%%`.
   * @param {string} fields.agent - replaces `%%AGENT%%`.
   * @param {string} fields.modelName - replaces `%%MODEL_NAME%%`.
   * @param {string} fields.modelEmail - replaces `%%MODEL_EMAIL%%`.
   * @returns {Promise<string>} the rendered reply content.
   */
  async _renderTemplate(repoPath, { body, agent, modelName, modelEmail }) {
    const templatePath = path.join(repoPath, TEMPLATE_RELATIVE_PATH);
    const template = await this._readFile(templatePath, 'utf8');

    let content = template;
    content = this._replaceFirst(content, '%%BODY%%', body);
    content = this._replaceFirst(content, '%%AGENT%%', agent);
    content = this._replaceFirst(content, '%%MODEL_NAME%%', modelName);
    content = this._replaceFirst(content, '%%MODEL_EMAIL%%', modelEmail);

    return content;
  }

  /**
   * Replaces only the first occurrence of `search` in `str` with
   * `replacement`, treating `replacement` as a plain literal string
   * (deliberately not `String#replace`, whose string-`replaceValue`
   * form still honors `$&`/`$\``/`$'`/`$$`/`$<name>` substitution
   * patterns — bash's `${var/pattern/repl}` has no such magic
   * characters, and `replacement` here is untrusted content, e.g. the
   * reply body).
   * @param {string} str - the source string.
   * @param {string} search - the literal substring to replace.
   * @param {string} replacement - the literal replacement text.
   * @returns {string} `str` with the first `search` occurrence replaced.
   */
  _replaceFirst(str, search, replacement) {
    const index = str.indexOf(search);

    if (index === -1) {
      return str;
    }

    return str.slice(0, index) + replacement + str.slice(index + search.length);
  }

  /**
   * Posts `content` as a comment on pull request `prNumber`, mirroring
   * `GithubIssue.js`'s fetch-call shape (error handling,
   * `AbortSignal.timeout`, `response.ok` check). PR comments live under
   * the `issues` REST endpoint.
   * @param {string} repo - the `owner/repo` path.
   * @param {string} prNumber - the target pull request's number.
   * @param {string} token - the GitHub token.
   * @param {string} content - the rendered comment body.
   * @returns {Promise<void>} resolves once the comment is posted.
   */
  async _postComment(repo, prNumber, token, content) {
    let response;

    try {
      response = await this._fetch(`https://api.github.com/repos/${repo}/issues/${prNumber}/comments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ body: content }),
        signal: AbortSignal.timeout(this._timeoutMs)
      });
    } catch {
      throw new Error(`Error: could not post comment on pull request #${prNumber} in ${repo}`);
    }

    if (!response.ok) {
      throw new Error(`Error: could not post comment on pull request #${prNumber} in ${repo}`);
    }
  }

  /**
   * Native re-derivation of `arcanum/_lib/push.sh`'s
   * `push_current_branch` for this entrypoint's own use only (per
   * `script-engine.md`'s "No standalone, wholesale `_lib` migration"
   * rule): resolves the current branch, then pushes it to `origin` with
   * upstream tracking. `git push`'s own stdout — its `branch '<name>'
   * set up to track 'origin/<name>'.` confirmation, printed on every
   * successful `-u` push regardless of whether the branch was already
   * tracked (its transfer summary goes to stderr instead) — is left
   * unredirected by `push.sh`, so it's relayed here too.
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<string>} `git push`'s own stdout.
   */
  async _pushCurrentBranch(repoPath) {
    const { stdout: branchStdout } = await this._execFileAsync(
      'git', ['-C', repoPath, 'branch', '--show-current']
    );
    const branch = branchStdout.trim();

    const { stdout } = await this._execFileAsync(
      'git', ['-C', repoPath, 'push', '-u', 'origin', `${branch}:${branch}`]
    );

    return stdout;
  }
}

export default AutoFixAllReplyComment;
