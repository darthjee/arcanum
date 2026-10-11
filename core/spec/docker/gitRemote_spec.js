import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describeParityRepos, seedRepoFile } from '../support/factories/dockerParitySetup.js';
import {
  itMatchesNativeInDockerWithRemote, itMatchesNativeInDockerWithSsh
} from '../support/factories/dockerRemoteParitySetup.js';
import { requireParityImage } from '../support/utils/dockerParity.js';
import { REPO_ROOT, git } from '../support/utils/runCommand.js';

const LIB_DIR = path.join(REPO_ROOT, 'arcanum', '_lib');
const AUTO_FIX_ALL_DIR = path.join(REPO_ROOT, 'auto-fix-all', 'scripts');

/** `--needs` of checkout-safe-branch and auto-fix-all-checkout-from-main (no HOME allowlisted). */
const CHECKOUT_NEEDS = '--needs=gitconfig,remote';

/** `--needs` of the commit/cleanup commands (HOME allowlisted). */
const COMMIT_NEEDS = '--needs=global-config,gitconfig,remote';

/** `--needs` of the batch-4 commands that also call GitHub (HOME allowlisted). */
const GH_REMOTE_NEEDS = '--needs=global-config,gitconfig,gh,remote';

const MODEL = ['Parity Model', 'model@example.com'];
const ISSUE_FILE = 'docs/agents/issues/7-add-change.md';
const PLAN_DIR = 'docs/agents/plans/7-add-change';

/**
 * A batch-4 shim's real `engine_dispatch` call: its `--needs`, `HOME`
 * allowlisted unless `home` is false, and `"$@"` (starting with
 * `<repo_path>`) passed on.
 * @param {string} command - the dispatched command.
 * @param {string} shellScript - the shell twin's path.
 * @param {string} needs - the shim's `--needs=...` flag.
 * @param {string[]} args - the args after `<repo_path>`.
 * @param {object} [opts] - options.
 * @param {boolean} [opts.home] - whether the shim allowlists `HOME`.
 * @returns {(repoPath: string) => string[]} `engine_dispatch`'s arguments.
 */
function remoteDispatch(command, shellScript, needs, args, { home = true } = {}) {
  return (repoPath) => [repoPath, command, shellScript, needs, ...(home ? ['HOME'] : []), '--', repoPath, ...args];
}

/**
 * Commits `file` (with `content`) on top of the current branch and
 * pushes it to `origin` as `branch`, then puts the local branch back,
 * so `origin/<branch>` is one commit ahead of what the repo has.
 * @param {string} repoPath - the fixture repo.
 * @param {string} branch - the remote branch to push.
 * @param {string} file - the file to commit.
 * @returns {Promise<void>} resolves once pushed.
 */
async function pushAheadCommit(repoPath, branch, file) {
  await writeFile(path.join(repoPath, file), `${file}\n`);
  await git(['add', file], repoPath);
  await git(['commit', '--quiet', '-m', `add ${file}`], repoPath);
  await git(['push', '--quiet', 'origin', `HEAD:refs/heads/${branch}`], repoPath);
  await git(['reset', '--quiet', '--hard', 'HEAD~1'], repoPath);
}

/**
 * Seeds the planning artifacts cleanup-artifacts removes, committed and
 * pushed to `origin/main`.
 * @param {string} repoPath - the fixture repo.
 * @returns {Promise<void>} resolves once committed.
 */
async function seedArtifacts(repoPath) {
  await seedRepoFile(repoPath, ISSUE_FILE, '# Issue 7: Add change\n');
  await seedRepoFile(repoPath, path.join(PLAN_DIR, 'plan.md'), '# Plan\n');
  await git(['add', 'docs'], repoPath);
  await git(['commit', '--quiet', '-m', 'seed planning artifacts'], repoPath);
  await git(['push', '--quiet', 'origin', 'main'], repoPath);
}

// Local-only parity cases for the git remote commands (docker batch 4,
// #748). Every default case runs against a credential-free `file://`
// origin kept inside the fixture's git dir (`seedLocalOrigin`), so real
// fetch/push behavior is compared on every `make docker-parity` run:
// stdout, exit code, stderr, files and the origin's branches after each
// run. The real ssh transport is opt-in (`ARCANUM_DOCKER_PARITY_SSH=1`).
//
// auto-fix-all-reply-comment has no case: its success path posts a PR
// comment on GitHub (an irreversible remote side effect).
// arcanum-split-issue-finish has none either: it relabels the parent
// issue on GitHub first and stops when that fails, so it can't reach
// its fetch without a sandbox; see the opt-in gh case in
// arcanumSplitIssue_spec.js.
describe('git remote commands docker parity', () => {
  requireParityImage();

  describeParityRepos('checkout-safe-branch', (getWorld) => {
    itMatchesNativeInDockerWithRemote('fetches origin and checks out the safe branch', getWorld, {
      command: 'checkout-safe-branch',
      dispatchArgs: remoteDispatch(
        'checkout-safe-branch', path.join(LIB_DIR, 'checkout_safe_branch_shell.sh'), CHECKOUT_NEEDS, [], { home: false }
      ),
      seed: async (repoPath) => {
        await pushAheadCommit(repoPath, 'main', 'AHEAD.md');
        await git(['checkout', '--quiet', '-b', 'feature'], repoPath);
      },
      check: ({ native }) => {
        expect(native.code).toEqual(0);
      }
    });
  }, { worktree: true });

  describeParityRepos('auto-fix-all-checkout-from-main', (getWorld) => {
    const dispatchArgs = remoteDispatch(
      'auto-fix-all-checkout-from-main', path.join(AUTO_FIX_ALL_DIR, 'checkout_from_main_shell.sh'), CHECKOUT_NEEDS,
      ['7'], { home: false }
    );

    itMatchesNativeInDockerWithRemote('creates the issue branch from origin/main', getWorld, {
      command: 'auto-fix-all-checkout-from-main',
      dispatchArgs,
      seed: (repoPath) => pushAheadCommit(repoPath, 'main', 'AHEAD.md'),
      check: ({ native }) => {
        expect(native.code).toEqual(0);
        expect(native.stdout).toContain('BRANCH=issue-7\nSTATUS=ok\n');
      }
    });

    itMatchesNativeInDockerWithRemote('checks out the remote issue branch and merges main', getWorld, {
      command: 'auto-fix-all-checkout-from-main',
      dispatchArgs,
      masksHashes: true,
      seed: async (repoPath) => {
        await pushAheadCommit(repoPath, 'issue-7', 'BRANCH.md');
        await pushAheadCommit(repoPath, 'main', 'AHEAD.md');
      },
      check: ({ native }) => {
        expect(native.code).toEqual(0);
        expect(native.stdout).toContain('BRANCH=issue-7\nSTATUS=ok\n');
      }
    });
  });

  describeParityRepos('auto-fix-all-github-cleanup-branch', (getWorld) => {
    itMatchesNativeInDockerWithRemote('deletes the remote and local issue branch', getWorld, {
      command: 'auto-fix-all-github-cleanup-branch',
      dispatchArgs: remoteDispatch(
        'auto-fix-all-github-cleanup-branch', path.join(AUTO_FIX_ALL_DIR, 'github_shell_cleanup_branch.sh'),
        COMMIT_NEEDS, ['7']
      ),
      masksHashes: true,
      seed: async (repoPath) => {
        await git(['checkout', '--quiet', '-b', 'issue-7'], repoPath);
        await git(['push', '--quiet', 'origin', 'issue-7'], repoPath);
      },
      check: ({ native, nativeInspected }) => {
        expect(native.code).toEqual(0);
        expect(nativeInspected).not.toContain('refs/heads/issue-7');
      }
    });
  });

  describeParityRepos('auto-fix-all-cleanup-artifacts', (getWorld) => {
    itMatchesNativeInDockerWithRemote('removes the artifacts, commits and pushes', getWorld, {
      command: 'auto-fix-all-cleanup-artifacts',
      dispatchArgs: remoteDispatch(
        'auto-fix-all-cleanup-artifacts', path.join(AUTO_FIX_ALL_DIR, 'cleanup_artifacts_shell.sh'), COMMIT_NEEDS,
        [ISSUE_FILE, PLAN_DIR, '7', ...MODEL]
      ),
      masksHashes: true,
      seed: seedArtifacts,
      check: ({ native, nativeInspected }) => {
        expect(native.code).toEqual(0);
        expect(nativeInspected).toContain('refs/heads/main chore(docs): remove planning artifacts (issue #7)\n');
      }
    });
  });

  describeParityRepos('auto-fix-issue-commit-change', (getWorld) => {
    itMatchesNativeInDockerWithRemote('commits the staged change and pushes', getWorld, {
      command: 'auto-fix-issue-commit-change',
      dispatchArgs: remoteDispatch(
        'auto-fix-issue-commit-change', path.join(REPO_ROOT, 'auto-fix-issue', 'scripts', 'commit_change_shell.sh'),
        COMMIT_NEEDS, ['feat', 'node', '7', 'add change', 'node', ...MODEL, 'the body']
      ),
      masksHashes: true,
      seed: async (repoPath) => {
        await writeFile(path.join(repoPath, 'CHANGED.md'), 'changed\n');
        await git(['add', 'CHANGED.md'], repoPath);
      },
      check: ({ native, nativeInspected }) => {
        expect(native.code).toEqual(0);
        expect(nativeInspected).toContain(' feat(node): add change (issue #7)\n');
      }
    });
  }, { worktree: true });

  describeParityRepos('auto-new-issue-commit-issue', (getWorld) => {
    itMatchesNativeInDockerWithRemote('commits the issue file and pushes', getWorld, {
      command: 'auto-new-issue-commit-issue',
      dispatchArgs: remoteDispatch(
        'auto-new-issue-commit-issue', path.join(REPO_ROOT, 'auto-new-issue', 'scripts', 'commit_issue_shell.sh'),
        COMMIT_NEEDS, [ISSUE_FILE, '7', ...MODEL]
      ),
      masksHashes: true,
      seed: (repoPath) => seedRepoFile(repoPath, ISSUE_FILE, '# Issue 7: Add change\n'),
      check: ({ native, nativeInspected }) => {
        expect(native.code).toEqual(0);
        expect(nativeInspected).toContain('refs/heads/main docs(issue): add issue file (issue #7)\n');
      }
    });
  });

  describeParityRepos('auto-plan-issue-commit-plan', (getWorld) => {
    itMatchesNativeInDockerWithRemote('commits the plan dir and pushes', getWorld, {
      command: 'auto-plan-issue-commit-plan',
      dispatchArgs: remoteDispatch(
        'auto-plan-issue-commit-plan', path.join(REPO_ROOT, 'auto-plan-issue', 'scripts', 'commit_plan_shell.sh'),
        COMMIT_NEEDS, [PLAN_DIR, '7', ...MODEL]
      ),
      masksHashes: true,
      seed: async (repoPath) => {
        await mkdir(path.join(repoPath, PLAN_DIR), { recursive: true });
        await writeFile(path.join(repoPath, PLAN_DIR, 'plan.md'), '# Plan\n');
      },
      check: ({ native, nativeInspected }) => {
        expect(native.code).toEqual(0);
        expect(nativeInspected).toContain('refs/heads/main docs(plan): add implementation plan (issue #7)\n');
      }
    });
  });

  describeParityRepos('auto-monitor-pr-monitor-pr', (getWorld) => {
    itMatchesNativeInDockerWithRemote('pushes the current branch before polling', getWorld, {
      command: 'auto-monitor-pr-monitor-pr',
      dispatchArgs: remoteDispatch(
        'auto-monitor-pr-monitor-pr', path.join(REPO_ROOT, 'auto-monitor-pr', 'scripts', 'monitor_pr_shell.sh'),
        GH_REMOTE_NEEDS, ['--pr-number', '42']
      ),
      seed: (repoPath) => git(['checkout', '--quiet', '-b', 'issue-7'], repoPath),
      check: ({ native, nativeInspected }) => {
        expect(native).toEqual({ stdout: 'pending\n', stderr: '', code: 0 });
        expect(nativeInspected).toContain('refs/heads/issue-7 seed\n');
      }
    });
  });

  describeParityRepos('checkout-safe-branch (ssh)', (getWorld) => {
    itMatchesNativeInDockerWithSsh('fetches the ssh origin and checks out the safe branch', getWorld, {
      command: 'checkout-safe-branch',
      dispatchArgs: remoteDispatch(
        'checkout-safe-branch', path.join(LIB_DIR, 'checkout_safe_branch_shell.sh'), CHECKOUT_NEEDS, [], { home: false }
      ),
      check: ({ native }) => {
        expect(native.code).toEqual(0);
      }
    });
  });
});
