import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import DispatchFailure from '../../utils/errors/DispatchFailure.js';

const USAGE = 'Usage: run_checks.sh <agent>';

/**
 * Native equivalent of `auto-fix-issue/scripts/run_checks_shell.sh`: runs
 * the check script for a given agent, if one exists. See
 * docs/agents/plans/434-migrate-auto-fix-issue-run-checks-entrypoint-to-native-node-js/node.md.
 *
 * Like `AutoFixIssueListPlanAgents`/`AutoFixIssueListPlanSteps`, this
 * entrypoint does not take a `repoPath` — the check script is resolved
 * relative to the caller's cwd, mirroring the shell script's own
 * cwd-relative `$CHECK_SCRIPT` lookup exactly.
 */
class AutoFixIssueRunChecks {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Function} [deps.existsSync] - `fs`-compatible synchronous
   *   existence check.
   * @param {Function} [deps.spawnFn] - `child_process.spawn`-compatible
   *   implementation, used to run the check script.
   */
  constructor({ existsSync: existsSyncFn = existsSync, spawnFn = spawn } = {}) {
    this._existsSync = existsSyncFn;
    this._spawn = spawnFn;
  }

  /**
   * Native implementation of the `auto-fix-issue-run-checks` migrated
   * entrypoint — byte-identical stdout/exit-code counterpart to
   * `run_checks_shell.sh`. Validates that `agent` is present (usage
   * message otherwise, propagated uncaught so the caller exits 1), then
   * runs `.claude/scripts/check_<agent>.sh` (relative to `process.cwd()`)
   * if it exists, streaming its stdout/stderr live.
   * @param {string} agent - the agent name to run checks for.
   * @returns {Promise<string>} `` `No checks configured for agent
   *   '${agent}' — skipping.\n` `` when no check script exists for
   *   `agent`; `''` when the check script exists and exits 0.
   * @throws {DispatchFailure} empty stdout payload with the check
   *   script's own exit code, when it exits nonzero.
   */
  async run(agent) {
    if (!agent) {
      throw new Error(USAGE);
    }

    const checkScript = path.join(process.cwd(), '.claude', 'scripts', `check_${agent}.sh`);

    if (!this._existsSync(checkScript)) {
      return `No checks configured for agent '${agent}' — skipping.\n`;
    }

    const code = await this._runCheckScript(checkScript);

    if (code !== 0) {
      throw new DispatchFailure('', code);
    }

    return '';
  }

  /**
   * Runs `bash <checkScript>` with its stdout/stderr streamed live (not
   * captured/suppressed).
   * @param {string} checkScript - the check script's path.
   * @returns {Promise<number>} the child process's exit code.
   */
  _runCheckScript(checkScript) {
    return new Promise((resolve, reject) => {
      const child = this._spawn('bash', [checkScript], { stdio: 'inherit' });

      child.on('error', reject);
      child.on('close', (code) => {
        resolve(code);
      });
    });
  }
}

export default AutoFixIssueRunChecks;
