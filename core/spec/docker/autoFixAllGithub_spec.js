import path from 'node:path';
import { itMatchesNativeInDockerWithGh } from '../support/factories/dockerGhParitySetup.js';
import { describeParityRepos } from '../support/factories/dockerParitySetup.js';
import { requireParityImage } from '../support/utils/dockerParity.js';
import { REPO_ROOT } from '../support/utils/runCommand.js';

const SCRIPTS_DIR = path.join(REPO_ROOT, 'auto-fix-all', 'scripts');

/**
 * The real auto-fix-all/scripts/github.sh `engine_dispatch` call for a
 * batch-3 subcommand: `--needs=global-config,gitconfig,gh`, `HOME`
 * allowlisted, then everything after the subcommand (`<repo_path>` and
 * its args).
 * @param {string} command - the dispatched command.
 * @param {string} shellScript - the shell twin's file name.
 * @param {(sandbox: object) => string[]} [args] - the args after `<repo_path>`.
 * @returns {(repoPath: string, sandbox: object) => string[]} `engine_dispatch`'s arguments.
 */
function githubDispatch(command, shellScript, args = () => []) {
  return (repoPath, sandbox) => [
    repoPath, command, path.join(SCRIPTS_DIR, shellScript),
    '--needs=global-config,gitconfig,gh', 'HOME', '--', repoPath, ...args(sandbox)
  ];
}

// Local-only, opt-in gh parity cases for auto-fix-all-github-{has-label,
// pr-number,pr-state,add-tag,remove-tag} (docker batch 3, #747): real
// GitHub calls against the ARCANUM_DOCKER_PARITY_GH_* sandbox, pending
// unless ARCANUM_DOCKER_PARITY_GH=1 and the vars each case needs are
// set. The PR lookups run on a local branch named after the fixture
// PR's head branch; add-tag/remove-tag toggle the fixture issue's
// labels (remove-tag starts from `Enqueued` added), restored between and
// after the runs. pr-merge and
// cleanup-branch have no case (irreversible / not batch 3).
describe('auto-fix-all-github docker parity (gh)', () => {
  requireParityImage();

  describeParityRepos('read-only', (getWorld) => {
    itMatchesNativeInDockerWithGh('pr-number prints the fixture PR number', getWorld, {
      command: 'auto-fix-all-github-pr-number',
      needs: ['pr', 'prBranch'],
      dispatchArgs: githubDispatch('auto-fix-all-github-pr-number', 'github_shell_pr_number.sh'),
      check: ({ native }, repoPath, { pr }) => expect(native).toEqual({ stdout: `${pr}\n`, stderr: '', code: 0 })
    });

    itMatchesNativeInDockerWithGh('pr-state prints the fixture PR state', getWorld, {
      command: 'auto-fix-all-github-pr-state',
      needs: ['prBranch'],
      dispatchArgs: githubDispatch('auto-fix-all-github-pr-state', 'github_shell_pr_state.sh'),
      check: ({ native }) => expect(native.stdout).toMatch(/^STATE=(OPEN|MERGED|CLOSED)\n$/)
    });

    itMatchesNativeInDockerWithGh('has-label checks a label on the fixture issue', getWorld, {
      command: 'auto-fix-all-github-has-label',
      needs: ['issue'],
      dispatchArgs: githubDispatch(
        'auto-fix-all-github-has-label', 'github_shell_has_label.sh', ({ issue }) => [issue, 'Enqueued']
      ),
      check: ({ native }) => expect([0, 1]).toContain(native.code)
    });

    itMatchesNativeInDockerWithGh('has-shipit-label checks shipit on the fixture issue', getWorld, {
      command: 'auto-fix-all-github-has-label',
      needs: ['issue'],
      dispatchArgs: githubDispatch(
        'auto-fix-all-github-has-label', 'github_shell_has_label.sh', ({ issue }) => [issue, 'shipit']
      ),
      check: ({ native }) => expect([0, 1]).toContain(native.code)
    });
  }, { worktree: true });

  describeParityRepos('label mutations', (getWorld) => {
    itMatchesNativeInDockerWithGh('add-tag tags the fixture issue', getWorld, {
      command: 'auto-fix-all-github-add-tag',
      needs: ['issue'],
      mutatesLabels: true,
      dispatchArgs: githubDispatch(
        'auto-fix-all-github-add-tag', 'github_shell_add_tag.sh', ({ issue }) => [issue, 'enqueued']
      ),
      check: ({ native }) => expect(native.code).toEqual(0)
    });

    itMatchesNativeInDockerWithGh('remove-tag untags the fixture issue', getWorld, {
      command: 'auto-fix-all-github-remove-tag',
      needs: ['issue'],
      mutatesLabels: true,
      dispatchArgs: githubDispatch(
        'auto-fix-all-github-remove-tag', 'github_shell_remove_tag.sh', ({ issue }) => [issue, 'enqueued']
      ),
      startLabels: ['Enqueued'],
      check: ({ native }) => expect(native.code).toEqual(0)
    });
  });
});
