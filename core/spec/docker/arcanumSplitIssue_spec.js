import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  describeParityRepos, itMatchesNativeInDocker, nativeWrites
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
describe('arcanum-split-issue-create-sub-issue-file docker parity', () => {
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
});
