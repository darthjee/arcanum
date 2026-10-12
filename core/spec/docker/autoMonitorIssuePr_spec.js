import path from 'node:path';
import { itMatchesNativeInDockerWithGh } from '../support/factories/dockerGhParitySetup.js';
import { describeParityRepos } from '../support/factories/dockerParitySetup.js';
import { requireParityImage } from '../support/utils/dockerParity.js';
import { REPO_ROOT } from '../support/utils/runCommand.js';

const SHELL_SCRIPT = path.join(REPO_ROOT, 'auto-monitor-issue-pr', 'scripts', 'resolve_pr_number_shell.sh');

// Local-only, opt-in gh parity case for
// auto-monitor-issue-pr-resolve-pr-number (docker batch 3, #747), with
// the real resolve_pr_number.sh `engine_dispatch` call: no cached
// `pr_id` in the issue state, so both runs look the PR up on GitHub by
// the current branch (a local branch named after the fixture PR's head
// branch). Pending unless ARCANUM_DOCKER_PARITY_GH=1 and the sandbox
// vars are set.
describe('auto-monitor-issue-pr docker parity (gh)', () => {
  requireParityImage();

  describeParityRepos('resolve-pr-number', (getWorld) => {
    itMatchesNativeInDockerWithGh('resolves the fixture PR from the current branch', getWorld, {
      command: 'auto-monitor-issue-pr-resolve-pr-number',
      needs: ['issue', 'pr', 'prBranch'],
      dispatchArgs: (repoPath, { issue }) => [
        repoPath, 'auto-monitor-issue-pr-resolve-pr-number', SHELL_SCRIPT,
        '--needs=global-config,gitconfig,gh', 'HOME', '--', repoPath, issue
      ],
      check: ({ native }, repoPath, { pr }) => expect(native).toEqual({ stdout: `${pr}\n`, stderr: '', code: 0 })
    });
  }, { worktree: true });
});
