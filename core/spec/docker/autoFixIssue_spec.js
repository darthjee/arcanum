import path from 'node:path';
import { itMatchesNativeInDockerWithGh } from '../support/factories/dockerGhParitySetup.js';
import {
  describeParityRepos, itMatchesNativeInDocker, seedRepoFile
} from '../support/factories/dockerParitySetup.js';
import { requireParityImage } from '../support/utils/dockerParity.js';
import { REPO_ROOT, seedOriginUrl } from '../support/utils/runCommand.js';

const SCRIPTS_DIR = path.join(REPO_ROOT, 'auto-fix-issue', 'scripts');
const PLAN_DIR = 'docs/plans/12-x';

/**
 * Seeds a plan dir with two agent files, the main plan and two `node` steps.
 * @param {string} repoPath - the repo.
 * @returns {Promise<void>} resolves once written.
 */
async function seedPlan(repoPath) {
  for (const file of ['plan.md', 'node.md', 'infra.md', 'node/02-b.md', 'node/01-a.md']) {
    await seedRepoFile(repoPath, path.join(PLAN_DIR, file), 'x\n');
  }
}

// Local-only parity cases for auto-fix-issue-github-info and
// auto-fix-issue-list-plan-{agents,steps} (docker batch 1, #745), with
// each shim's real `engine_dispatch` call (the list-plan shims dispatch
// with the repo toplevel; the plan dir is passed repo-relative).
describe('auto-fix-issue docker parity', () => {
  requireParityImage();

  describeParityRepos('github info', (getWorld) => {
    itMatchesNativeInDocker('prints DOMAIN and REPO from origin', getWorld, {
      command: 'auto-fix-issue-github-info',
      dispatchArgs: (repoPath) => [
        repoPath, 'auto-fix-issue-github-info', path.join(SCRIPTS_DIR, 'github_shell_info.sh'), '--', repoPath
      ],
      seed: (repoPath) => seedOriginUrl(repoPath, 'https://github.com/darthjee/arcanum-github-fixture.git'),
      check: ({ native }) => expect(native).toEqual({
        stdout: 'DOMAIN=github.com\nREPO=darthjee/arcanum-github-fixture\n', stderr: '', code: 0
      })
    });
  }, { worktree: true });

  describeParityRepos('list-plan-agents and list-plan-steps', (getWorld) => {
    itMatchesNativeInDocker('list-plan-agents lists the agent files', getWorld, {
      command: 'auto-fix-issue-list-plan-agents',
      dispatchArgs: (repoPath) => [
        repoPath, 'auto-fix-issue-list-plan-agents', path.join(SCRIPTS_DIR, 'list_plan_agents_shell.sh'),
        '--', PLAN_DIR
      ],
      seed: seedPlan,
      check: ({ native }) => expect(native.stdout).toEqual('infra\nnode\n')
    });

    itMatchesNativeInDocker('list-plan-steps lists an agent\'s steps in order', getWorld, {
      command: 'auto-fix-issue-list-plan-steps',
      dispatchArgs: (repoPath) => [
        repoPath, 'auto-fix-issue-list-plan-steps', path.join(SCRIPTS_DIR, 'list_plan_steps_shell.sh'),
        '--', PLAN_DIR, 'node'
      ],
      seed: seedPlan,
      check: ({ native }) => expect(native.stdout).toEqual(`${PLAN_DIR}/node/01-a.md\n${PLAN_DIR}/node/02-b.md\n`)
    });

    itMatchesNativeInDocker('list-plan-steps fails for a missing agent dir', getWorld, {
      command: 'auto-fix-issue-list-plan-steps',
      dispatchArgs: (repoPath) => [
        repoPath, 'auto-fix-issue-list-plan-steps', path.join(SCRIPTS_DIR, 'list_plan_steps_shell.sh'),
        '--', PLAN_DIR, 'nobody'
      ],
      seed: seedPlan
    });
  });

  // Opt-in gh case (docker batch 3, #747): pending unless
  // ARCANUM_DOCKER_PARITY_GH=1 and the sandbox vars are set. pr-create
  // and pr-ready have no case (they create or change a PR).
  describeParityRepos('github pr-view (gh)', (getWorld) => {
    itMatchesNativeInDockerWithGh('pr-view prints the fixture PR URL and draft flag', getWorld, {
      command: 'auto-fix-issue-github-pr-view',
      needs: ['pr', 'prBranch'],
      dispatchArgs: (repoPath) => [
        repoPath, 'auto-fix-issue-github-pr-view', path.join(SCRIPTS_DIR, 'github_shell_pr_view.sh'),
        '--needs=global-config,gitconfig,gh', 'HOME', '--', repoPath
      ],
      check: ({ native }, repoPath, { repo, pr }) => {
        expect(native.code).toEqual(0);
        const prefix = `URL=https://github.com/${repo}/pull/${pr}\nIS_DRAFT=`;

        expect([`${prefix}true\n`, `${prefix}false\n`]).toContain(native.stdout);
      }
    });
  }, { worktree: true });
});
