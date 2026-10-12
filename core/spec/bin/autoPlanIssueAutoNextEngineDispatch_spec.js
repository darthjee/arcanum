import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { itRoutesWithInvocationLog } from '../support/sharedExamples/invocationLogRouting.js';
import { REPO_ROOT, git, runCommand } from '../support/utils/runCommand.js';

const SHIM_SCRIPT = path.join(REPO_ROOT, 'auto-plan-issue', 'scripts', 'auto_next.sh');
const ID = '7';
const BRANCH = `issue-${ID}`;

/**
 * Seeds `next_step.auto.auto-plan-issue=true` in the repo config tier.
 * @param {string} repoPath - the fixture repo.
 * @returns {Promise<void>} resolves once written.
 */
async function enableAutoKey(repoPath) {
  const dir = path.join(repoPath, '.claude', 'configuration');

  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, 'arcanum-repo-config.json'),
    JSON.stringify({ next_step: { auto: { 'auto-plan-issue': true } } })
  );
}

/**
 * Checks out `issue-<id>` tracking `origin`, then adds an unpushed commit.
 * @param {string} repoPath - the fixture repo.
 * @returns {Promise<void>} resolves once committed.
 */
async function preparePlanCommit(repoPath) {
  await git(['checkout', '--quiet', '-b', BRANCH], repoPath);
  await git(['push', '--quiet', '-u', 'origin', BRANCH], repoPath);
  await writeFile(path.join(repoPath, 'plan.md'), '# plan\n');
  await git(['add', 'plan.md'], repoPath);
  await git(['commit', '--quiet', '-m', 'docs(plan): add plan'], repoPath);
}

/**
 * @param {string} repoPath - the fixture repo.
 * @param {string} ref - the ref to resolve.
 * @returns {Promise<string>} its sha.
 */
async function sha(repoPath, ref) {
  return (await runCommand(['git', '-C', repoPath, 'rev-parse', ref], repoPath)).stdout.trim();
}

// Routing spec for the real auto-plan-issue/scripts/auto_next.sh
// engine_dispatch shim (issue #760). The command is `host-only`: under
// engine.mode=docker it runs native on the host (logged, no `docker`
// call, no fallback warning), so `git push` uses the host's credentials.
// The native side asks NextStepPrompt in-process, so only
// `auto-plan-issue-auto-next` is ever logged — never `next-step-prompt`.
describe('auto-plan-issue auto_next.sh engine_dispatch routing (via the real shim)', () => {
  itRoutesWithInvocationLog('auto_next.sh (HEAD is not issue-<id>)', SHIM_SCRIPT, {
    command: 'auto-plan-issue-auto-next',
    hostOnly: true,
    prepare: async ({ repoPath }) => ({ args: [repoPath, ID] }),
    check: (result) => {
      expect(result).toEqual({ stdout: 'CHAIN=no\nREASON=branch\n', stderr: '', code: 0 });
    }
  });

  itRoutesWithInvocationLog('auto_next.sh (auto key on, push succeeds)', SHIM_SCRIPT, {
    command: 'auto-plan-issue-auto-next',
    hostOnly: true,
    prepare: async ({ repoPath }) => {
      await preparePlanCommit(repoPath);
      await enableAutoKey(repoPath);

      return {
        args: [repoPath, ID],
        env: { ARCANUM_TTY_DEVICE: path.join(repoPath, 'missing-tty') }
      };
    },
    check: async (result, { repoPath, logFile, mode }) => {
      expect(result.stdout).toEqual('CHAIN=yes\n');
      expect(result.code).toEqual(0);
      expect(result.stderr).toContain(
        `auto-continuing: /loop /auto-resolve-issue ${ID} (next_step.auto.auto-plan-issue=true)\n`
      );
      expect(result.stderr).not.toContain('Warning:');
      expect(await sha(repoPath, `origin/${BRANCH}`)).toEqual(await sha(repoPath, 'HEAD'));

      if (mode !== 'shell') {
        expect(await readFile(logFile, 'utf8')).not.toContain('command next-step-prompt invoked');
      }
    }
  });
});
