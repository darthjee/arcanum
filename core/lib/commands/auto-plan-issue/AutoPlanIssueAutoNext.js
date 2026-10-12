import { execFile, spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import NextStepPrompt from '../shared/NextStepPrompt.js';
import DispatchFailure from '../../utils/errors/DispatchFailure.js';

const USAGE = 'Usage: auto_next.sh <repo_path> <id>';
const AUTO_KEY = 'auto-plan-issue';

/**
 * Runs `git` with an argument array, never through a shell.
 * @param {string[]} args - the git arguments.
 * @param {object} [options] - behavior.
 * @param {boolean} [options.capture] - capture stdout (discarding
 *   stderr, like `2>/dev/null`) instead of sending all of git's output
 *   to this process's stderr.
 * @returns {Promise<{code: number, stdout: string}>} the exit code and
 *   captured stdout; never rejects.
 */
function runGit(args, { capture = false } = {}) {
  if (capture) {
    return new Promise((resolve) => {
      execFile('git', args, (error, stdout) => {
        resolve({ code: error ? 1 : 0, stdout: error ? '' : stdout });
      });
    });
  }

  return new Promise((resolve) => {
    const child = spawn('git', args, { stdio: ['inherit', 2, 2] });

    child.on('error', () => resolve({ code: 1, stdout: '' }));
    child.on('close', (code) => resolve({ code: code ?? 1, stdout: '' }));
  });
}

/**
 * Native `auto-plan-issue-auto-next` (`auto-plan-issue/scripts/auto_next.sh`):
 * the top-level chain decision for `/auto-plan-issue`. Byte-for-byte port
 * of `auto_next_shell.sh` — see
 * docs/agents/architecture/skill-finish.md#next-step-map. Checks the
 * branch is `issue-<id>`, asks `NextStepPrompt` (in-process, never via
 * the shim) whether `next_step.auto.auto-plan-issue` is on, then pushes.
 * Prints `CHAIN=yes`, or `CHAIN=no` + `REASON=branch|config|push`, and
 * exits 0; usage errors and a failed prompt exit 1 with nothing on
 * stdout. Status `host-only`, so the push uses the host's credentials.
 */
class AutoPlanIssueAutoNext {
  /**
   * @param {import('../../context/RepoContext.js').default} repoContext -
   *   the target repo's context (only `repoPath` is used; it need not be
   *   a git repo).
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {NextStepPrompt} [deps.nextStepPrompt] - the next-step offer.
   * @param {typeof runGit} [deps.git] - the git runner.
   * @param {{write: (chunk: string) => boolean}} [deps.stderr] - where the
   *   stderr lines go.
   */
  constructor(repoContext, {
    nextStepPrompt = new NextStepPrompt(),
    git = runGit,
    stderr = process.stderr
  } = {}) {
    this._repoPath = repoContext.repoPath ?? '';
    this._nextStepPrompt = nextStepPrompt;
    this._git = git;
    this._stderr = stderr;
  }

  /**
   * @param {string} [id] - the issue id.
   * @returns {Promise<string>} the `CHAIN=`/`REASON=` lines (exit `0`).
   * @throws {DispatchFailure} exit `1` with empty stdout on a usage error
   *   or a failed next-step prompt (the message goes to stderr).
   */
  async run(id = '') {
    await this.validate(id);

    if (await this.currentBranch() !== `issue-${id}`) {
      return this.chainNo('branch');
    }

    if (!(await this.autoEnabled(id))) {
      return this.chainNo('config');
    }

    const { code } = await this._git(['-C', this._repoPath, 'push']);

    return code === 0 ? 'CHAIN=yes\n' : this.chainNo('push');
  }

  /**
   * @param {string} id - the issue id.
   * @returns {Promise<void>} resolves when the arguments are valid.
   * @throws {DispatchFailure} exit `1` on a missing argument or a
   *   non-directory `<repo_path>`.
   */
  async validate(id) {
    if (!this._repoPath || !id) {
      this.fail(USAGE);
    }

    if (!(await this.isDirectory(this._repoPath))) {
      this.fail(`Error: repo path '${this._repoPath}' is not a directory`);
    }
  }

  /**
   * @param {string} target - a path.
   * @returns {Promise<boolean>} whether it is (or links to) a directory.
   */
  async isDirectory(target) {
    try {
      return (await stat(target)).isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * @returns {Promise<string>} HEAD's abbreviated name, or `''` when git
   *   fails (e.g. not a repo, or an unborn branch).
   */
  async currentBranch() {
    const { code, stdout } = await this._git(['-C', this._repoPath, 'rev-parse', '--abbrev-ref', 'HEAD'], {
      capture: true
    });

    return code === 0 ? stdout.replace(/\n+$/, '') : '';
  }

  /**
   * Asks `NextStepPrompt` (in-process, `--no-prompt`) whether
   * `next_step.auto.auto-plan-issue` is on, passing its stderr notice
   * through.
   * @param {string} id - the issue id.
   * @returns {Promise<boolean>} whether it answered `CHOICE=yes`.
   * @throws {DispatchFailure} exit `1` when the prompt fails.
   */
  async autoEnabled(id) {
    const { stdout, stderr, exitCode } = await this._nextStepPrompt.evaluate([
      '--repo', this._repoPath,
      '--command', `/loop /auto-resolve-issue ${id}`,
      '--auto-key', AUTO_KEY,
      '--no-prompt'
    ]);

    if (stderr) {
      this._stderr.write(stderr);
    }

    if (exitCode !== 0) {
      this.fail(`Error: next_step_prompt.sh failed for auto key '${AUTO_KEY}'`);
    }

    const choice = stdout.split('\n').find((line) => line.startsWith('CHOICE='));

    return choice === 'CHOICE=yes';
  }

  /**
   * @param {string} reason - `branch`, `config` or `push`.
   * @returns {string} the `CHAIN=no`/`REASON=` lines.
   */
  chainNo(reason) {
    return `CHAIN=no\nREASON=${reason}\n`;
  }

  /**
   * @param {string} message - the stderr line.
   * @returns {never} always throws.
   * @throws {DispatchFailure} exit `1` with empty stdout.
   */
  fail(message) {
    this._stderr.write(`${message}\n`);
    throw new DispatchFailure('', 1);
  }
}

export default AutoPlanIssueAutoNext;
