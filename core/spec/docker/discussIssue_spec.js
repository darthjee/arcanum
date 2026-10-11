import path from 'node:path';
import {
  describeParityRepos, itMatchesNativeInDocker, nativeOutsideWrites, nativeWrites
} from '../support/factories/dockerParitySetup.js';
import { requireParityImage } from '../support/utils/dockerParity.js';
import { REPO_ROOT } from '../support/utils/runCommand.js';

const SHELL_SCRIPT = path.join(REPO_ROOT, 'discuss-issue', 'scripts', 'confirm_shell.sh');
const RENDER_SHELL_SCRIPT = path.join(REPO_ROOT, 'discuss-issue', 'scripts', 'render_issue_shell.sh');
const RENDER = 'discuss-issue-render-issue';
const SECTIONS = ['Something broke', '## Description\nDesc text', '', '## Expected Behavior\nExp text'];

/**
 * The real render_issue.sh `engine_dispatch` call
 * (`--prepend-repo-path --path-arg=1:rw`).
 * @param {string} repoPath - the repo.
 * @param {string} outputFile - the <output_file> argument.
 * @returns {string[]} `engine_dispatch`'s arguments.
 */
function renderDispatch(repoPath, outputFile) {
  return [
    repoPath, RENDER, RENDER_SHELL_SCRIPT, '--prepend-repo-path', '--path-arg=1:rw', '--', outputFile, ...SECTIONS
  ];
}

// Local-only parity cases for discuss-issue-confirm (docker batch 1,
// #745) and discuss-issue-render-issue (docker batch 2, #746), with the
// real shims' `engine_dispatch` calls.
describe('discuss-issue docker parity', () => {
  requireParityImage();

  describeParityRepos('confirm', (getWorld) => {
    [['yes', 0], ['no', 1]].forEach(([reply, code]) => {
      itMatchesNativeInDocker(`exits ${code} for "${reply}"`, getWorld, {
        command: 'discuss-issue-confirm',
        dispatchArgs: (repoPath) => [repoPath, 'discuss-issue-confirm', SHELL_SCRIPT, '--', reply],
        check: ({ native }) => expect(native).toEqual({ stdout: '', stderr: '', code })
      });
    });
  }, { worktree: true });

  describeParityRepos('render-issue', (getWorld) => {
    itMatchesNativeInDocker('writes a new output file in a directory outside the repo', getWorld, {
      command: RENDER,
      dispatchArgs: (repoPath, { outsideDir }) => renderDispatch(repoPath, path.join(outsideDir, 'issue.md')),
      watchOutside: true,
      check: (parity, repoPath, { outsideDir }) => {
        expect(parity.native).toEqual({ stdout: '', stderr: '', code: 0 });
        expect(nativeOutsideWrites(parity, outsideDir)).toEqual(['issue.md']);
        expect(nativeWrites(parity, repoPath)).toEqual([]);
      }
    });

    itMatchesNativeInDocker('writes a relative output file inside the repo', getWorld, {
      command: RENDER,
      dispatchArgs: (repoPath) => renderDispatch(repoPath, 'issue.md'),
      check: (parity, repoPath) => {
        expect(parity.native).toEqual({ stdout: '', stderr: '', code: 0 });
        expect(nativeWrites(parity, repoPath)).toEqual(['issue.md']);
      }
    });
  }, { worktree: true });
});
