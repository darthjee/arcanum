import path from 'node:path';
import { describeParityRepos, itMatchesNativeInDocker } from '../support/factories/dockerParitySetup.js';
import { requireParityImage } from '../support/utils/dockerParity.js';
import { REPO_ROOT } from '../support/utils/runCommand.js';

const SHELL_SCRIPT = path.join(REPO_ROOT, 'discuss-issue', 'scripts', 'confirm_shell.sh');

// Local-only parity cases for discuss-issue-confirm (docker batch 1,
// #745), with the real confirm.sh `engine_dispatch` call.
describe('discuss-issue-confirm docker parity', () => {
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
});
