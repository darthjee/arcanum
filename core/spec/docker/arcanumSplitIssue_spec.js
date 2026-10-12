import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { MARK_TRANSITIONS } from '../../lib/commands/shared/GithubIssueMark.js';
import { TAG_TO_LABEL } from '../../lib/utils/issue/Tags.js';
import { itMatchesNativeInDockerWithGh } from '../support/factories/dockerGhParitySetup.js';
import {
  describeParityRepos, itMatchesNativeInDocker, nativeWrites, seedRepoFile
} from '../support/factories/dockerParitySetup.js';
import { requireParityImage } from '../support/utils/dockerParity.js';
import { REPO_ROOT } from '../support/utils/runCommand.js';

const COMMAND = 'arcanum-split-issue-create-sub-issue-file';
const SHELL_SCRIPT = path.join(REPO_ROOT, 'arcanum-split-issue', 'scripts', 'create_sub_issue_file_shell.sh');

/**
 * The real create_sub_issue_file.sh `engine_dispatch` call
 * (`--path-arg=4:ro`).
 * @param {string} repoPath - the repo.
 * @param {...string} args - the shim's arguments after `<repo_path>`.
 * @returns {string[]} `engine_dispatch`'s arguments.
 */
function dispatch(repoPath, ...args) {
  return [repoPath, COMMAND, SHELL_SCRIPT, '--path-arg=4:ro', '--', repoPath, ...args];
}

// Local-only parity cases for arcanum-split-issue-create-sub-issue-file
// (docker batch 2, #746): a <body_file> outside the repo reaches the
// container through its own `:ro` mount.
describe('arcanum-split-issue docker parity', () => {
  requireParityImage();

  describeParityRepos('create-sub-issue-file', (getWorld) => {
    itMatchesNativeInDocker('writes the sub-issue from a body file outside the repo', getWorld, {
      command: COMMAND,
      seed: (_repoPath, { outsideDir }) => writeFile(path.join(outsideDir, 'body.md'), 'body content\n'),
      dispatchArgs: (repoPath, { outsideDir }) => dispatch(
        repoPath, '999', 'Hello, World! Foo-Bar', path.join(outsideDir, 'body.md')
      ),
      watchOutside: true,
      check: (parity, repoPath) => {
        expect(parity.native).toEqual({
          stdout: 'FILE=docs/agents/issues/999_01_hello_world_foo_bar.md\n', stderr: '', code: 0
        });
        expect(nativeWrites(parity, repoPath)).toEqual(['docs/agents/issues/999_01_hello_world_foo_bar.md']);
      }
    });

    itMatchesNativeInDocker('fails the same way for a missing body file outside the repo', getWorld, {
      command: COMMAND,
      dispatchArgs: (repoPath, { outsideDir }) => dispatch(repoPath, '999', 'Title', path.join(outsideDir, 'missing.md')),
      watchOutside: true,
      check: ({ native }) => expect(native.code).toEqual(1)
    });

    itMatchesNativeInDocker('fails the same way without a body file (usage error)', getWorld, {
      command: COMMAND,
      dispatchArgs: (repoPath) => dispatch(repoPath, '999', 'Title'),
      check: ({ native }) => {
        expect(native.stdout).toEqual('');
        expect(native.code).not.toEqual(0);
      }
    });
  }, { worktree: true });

  // arcanum-split-issue-finish (docker batch 4, #748): opt-in only, since
  // it relabels the parent issue on GitHub (mark-split) before it
  // deletes the working files and fetches `origin` (the sandbox's https
  // URL, through the `remote` need's gh credential helper). The fixture
  // issue starts with the labels mark-split removes, and its labels are
  // restored before each run and at the end.
  describeParityRepos('arcanum-split-issue-finish (gh, label mutations)', (getWorld) => {
    const labelOf = new Map(Object.entries(TAG_TO_LABEL));

    itMatchesNativeInDockerWithGh('finish relabels the issue, deletes its files and fetches origin', getWorld, {
      command: 'arcanum-split-issue-finish',
      needs: ['issue'],
      mutatesLabels: true,
      startLabels: MARK_TRANSITIONS.split.removes.map((tag) => labelOf.get(tag)),
      seed: (repoPath, { issue }) => seedRepoFile(repoPath, `docs/agents/issues/${issue}-parent.md`, '# Parent\n'),
      dispatchArgs: (repoPath, { issue }) => [
        repoPath, 'arcanum-split-issue-finish', path.join(REPO_ROOT, 'arcanum-split-issue', 'scripts', 'finish_shell.sh'),
        '--needs=global-config,gitconfig,gh,remote', 'HOME', '--', repoPath, issue
      ],
      check: ({ native }, repoPath, { issue }) => {
        expect(native.code).toEqual(0);
        expect(native.stdout).toContain(`Deleted:\n  docs/agents/issues/${issue}-parent.md\n`);
      }
    });
  });
});
