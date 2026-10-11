import path from 'node:path';
import { MARK_TRANSITIONS } from '../../lib/commands/shared/GithubIssueMark.js';
import { TAG_TO_LABEL } from '../../lib/utils/issue/Tags.js';
import { itMatchesNativeInDockerWithGh } from '../support/factories/dockerGhParitySetup.js';
import {
  describeParityRepos, itMatchesNativeInDocker, nativeWrites, seedRepoFile
} from '../support/factories/dockerParitySetup.js';
import { requireParityImage } from '../support/utils/dockerParity.js';
import { REPO_ROOT } from '../support/utils/runCommand.js';

const LIB_DIR = path.join(REPO_ROOT, 'arcanum', '_lib');
const ISSUE_FILE = 'docs/issues/12-fix-it.md';
const STATE_FILE = '.claude/state/issue-12.json';

/**
 * The real arcanum/_lib shims' `engine_dispatch` call: every one passes
 * `"$@"` (starting with `<repo_path>`) to its command.
 * @param {string} command - the dispatched command.
 * @param {string} shellScript - the shell twin's file name under arcanum/_lib.
 * @param {...string} args - the args after `<repo_path>`.
 * @returns {(repoPath: string) => string[]} `engine_dispatch`'s arguments.
 */
function libDispatch(command, shellScript, ...args) {
  return (repoPath) => [repoPath, command, path.join(LIB_DIR, shellScript), '--', repoPath, ...args];
}

/** The `--needs` every batch-3 (gh) shim declares. */
const GH_NEEDS = '--needs=global-config,gitconfig,gh';

/**
 * resolve_and_fetch.sh's `--needs`: the gh ones plus `remote`, since its
 * checkout-safe-branch step runs `git fetch` (with the sandbox's https
 * `origin`, the gh credential helper is forwarded).
 */
const GH_REMOTE_NEEDS = `${GH_NEEDS},remote`;

/**
 * The real github_issue.sh / resolve_and_fetch.sh `engine_dispatch` call
 * for a batch-3 command: its `--needs` (`--needs=global-config,gitconfig,gh`
 * by default), `HOME` allowlisted, `"$@"` (starting with `<repo_path>`)
 * passed on.
 * @param {string} command - the dispatched command.
 * @param {string} shellScript - the shell twin's file name under arcanum/_lib.
 * @param {(sandbox: object) => string[]} args - the args after `<repo_path>`.
 * @param {string} [needs] - the shim's `--needs=...` flag.
 * @returns {(repoPath: string, sandbox: object) => string[]} `engine_dispatch`'s arguments.
 */
function ghLibDispatch(command, shellScript, args, needs = GH_NEEDS) {
  return (repoPath, sandbox) => [
    repoPath, command, path.join(LIB_DIR, shellScript), needs, 'HOME', '--', repoPath, ...args(sandbox)
  ];
}

/**
 * @param {string} repoPath - the repo.
 * @returns {Promise<void>} seeds issue 12's file.
 */
function seedIssue(repoPath) {
  return seedRepoFile(repoPath, ISSUE_FILE, '# Issue 12: Fix it\n');
}

// Local-only parity cases for finish-report, issue-state, list-agents,
// resolve-id-and-file and resolve-plan-paths (docker batch 1, #745).
describe('arcanum/_lib commands docker parity', () => {
  requireParityImage();

  describeParityRepos('issue-state', (getWorld) => {
    itMatchesNativeInDocker('set writes the state file', getWorld, {
      command: 'issue-state',
      dispatchArgs: libDispatch('issue-state', 'issue_state_shell.sh', 'set', '12', 'status', 'planned'),
      check: (parity, repoPath) => {
        expect(parity.native.code).toEqual(0);
        expect(nativeWrites(parity, repoPath)).toContain(STATE_FILE);
      }
    });

    itMatchesNativeInDocker('append-json appends to an array field', getWorld, {
      command: 'issue-state',
      dispatchArgs: libDispatch('issue-state', 'issue_state_shell.sh', 'append-json', '12', 'prs', '{"n":1}'),
      seed: (repoPath) => seedRepoFile(repoPath, STATE_FILE, '{"prs":[{"n":0}]}'),
      check: (parity, repoPath) => expect(nativeWrites(parity, repoPath)).toContain(STATE_FILE)
    });

    itMatchesNativeInDocker('get prints a field', getWorld, {
      command: 'issue-state',
      dispatchArgs: libDispatch('issue-state', 'issue_state_shell.sh', 'get', '12', 'status'),
      seed: (repoPath) => seedRepoFile(repoPath, STATE_FILE, '{"status":"new"}'),
      check: ({ native }) => expect(native.stdout).toEqual('new\n')
    });
  }, { worktree: true });

  describeParityRepos('finish-report, list-agents, resolve-id-and-file and resolve-plan-paths', (getWorld) => {
    itMatchesNativeInDocker('finish-report renders the report', getWorld, {
      command: 'finish-report',
      dispatchArgs: libDispatch(
        'finish-report', 'finish_report_shell.sh',
        '--skill', 'demo', '--status', 'success', '--summary', 'Done', '--next', '/next-thing'
      ),
      check: ({ native }) => expect(native.code).toEqual(0)
    });

    itMatchesNativeInDocker('finish-report rejects a bad status', getWorld, {
      command: 'finish-report',
      dispatchArgs: libDispatch(
        'finish-report', 'finish_report_shell.sh', '--skill', 'demo', '--status', 'meh', '--summary', 'Done'
      ),
      check: ({ native }) => expect(native.code).not.toEqual(0)
    });

    itMatchesNativeInDocker('list-agents lists the agents', getWorld, {
      command: 'list-agents',
      dispatchArgs: libDispatch('list-agents', 'list_agents_shell.sh'),
      seed: (repoPath) => seedRepoFile(
        repoPath, '.claude/agents/alpha.md', '---\nname: alpha\ndescription: Alpha agent\n---\nbody\n'
      ),
      check: ({ native }) => expect(native.stdout).toEqual('alpha|Alpha agent\n')
    });

    itMatchesNativeInDocker('resolve-id-and-file finds an existing issue', getWorld, {
      command: 'resolve-id-and-file',
      dispatchArgs: libDispatch('resolve-id-and-file', 'resolve_id_and_file_shell.sh', 'docs/issues', '#12'),
      seed: seedIssue,
      check: ({ native }) => expect(native.stdout).toContain(`FILE=${ISSUE_FILE}\nSTATUS=existing\n`)
    });

    itMatchesNativeInDocker('resolve-id-and-file rejects a non-numeric id', getWorld, {
      command: 'resolve-id-and-file',
      dispatchArgs: libDispatch('resolve-id-and-file', 'resolve_id_and_file_shell.sh', 'docs/issues', '#abc'),
      check: ({ native }) => expect(native.code).toEqual(1)
    });

    itMatchesNativeInDocker('resolve-plan-paths resolves the plan paths', getWorld, {
      command: 'resolve-plan-paths',
      dispatchArgs: libDispatch('resolve-plan-paths', 'resolve_plan_paths_shell.sh', 'docs/issues', 'docs/plans', '12'),
      seed: seedIssue,
      check: ({ native }) => expect(native.stdout).toContain('PLAN_FILE=docs/plans/12-fix-it/plan.md\n')
    });
  });

  // Opt-in gh cases (docker batch 3, #747): real GitHub calls against the
  // ARCANUM_DOCKER_PARITY_GH_* sandbox, pending unless
  // ARCANUM_DOCKER_PARITY_GH=1 and the vars each case needs are set.
  describeParityRepos('github-issue info and fetch (gh)', (getWorld) => {
    itMatchesNativeInDockerWithGh('github-issue-info prints the sandbox DOMAIN and REPO', getWorld, {
      command: 'github-issue-info',
      needs: ['repo'],
      dispatchArgs: ghLibDispatch('github-issue-info', 'github_issue_info_shell.sh', () => []),
      check: ({ native }, repoPath, sandbox) => {
        expect(native).toEqual({ stdout: `DOMAIN=github.com\nREPO=${sandbox.repo}\n`, stderr: '', code: 0 });
      }
    });

    itMatchesNativeInDockerWithGh('github-issue-fetch saves the fixture issue', getWorld, {
      command: 'github-issue-fetch',
      needs: ['issue'],
      dispatchArgs: ghLibDispatch('github-issue-fetch', 'github_issue_fetch_shell.sh', ({ issue }) => [issue]),
      check: (parity, repoPath, { issue }) => {
        expect(parity.native.code).toEqual(0);
        expect(nativeWrites(parity, repoPath).some((file) => file.startsWith(`docs/agents/issues/${issue}`)))
          .withContext('the fetched issue file').toBeTrue();
      }
    });
  }, { worktree: true });

  describeParityRepos('resolve-and-fetch (gh)', (getWorld) => {
    itMatchesNativeInDockerWithGh('resolve-and-fetch resolves the fixture issue', getWorld, {
      command: 'resolve-and-fetch',
      needs: ['issue'],
      dispatchArgs: ghLibDispatch(
        'resolve-and-fetch', 'resolve_and_fetch_shell.sh', ({ issue }) => ['docs/agents/issues', `#${issue}`],
        GH_REMOTE_NEEDS
      ),
      check: ({ native }, repoPath, { issue }) => {
        expect(native.code).toEqual(0);
        expect(native.stdout).toContain(`STATUS=ok\nID=${issue}\n`);
      }
    });
  });

  describeParityRepos('github-issue mark-* (gh, label mutations)', (getWorld) => {
    Object.keys(MARK_TRANSITIONS).forEach((name) => {
      itMatchesNativeInDockerWithGh(`github-issue-mark-${name} relabels the fixture issue`, getWorld, {
        command: `github-issue-mark-${name}`,
        needs: ['issue'],
        mutatesLabels: true,
        // Start from the labels the transition removes, so it has some.
        startLabels: MARK_TRANSITIONS[name].removes.map((tag) => TAG_TO_LABEL[tag]),
        dispatchArgs: ghLibDispatch(
          `github-issue-mark-${name}`, `github_issue_mark_${name}_shell.sh`, ({ issue }) => [issue]
        ),
        check: ({ native }) => expect(native.code).toEqual(0)
      });
    });
  });
});
