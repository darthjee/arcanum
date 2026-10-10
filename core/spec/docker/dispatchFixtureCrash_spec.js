import { SHELL_TWIN } from '../support/factories/engineDispatchDockerSetup.js';
import { describeParityRepos, itMatchesNativeInDocker } from '../support/factories/dockerParitySetup.js';
import { requireParityImage } from '../support/utils/dockerParity.js';

const COMMAND = 'dispatch-fixture-crash';

// Local-only parity case for the dispatch-fixture-crash test fixture
// (docker batch 1, #745). It has no shim, so it calls engine_dispatch
// directly, as the dispatch-level specs do: the native crash must fail
// loud with the same exit code and stderr in the container.
describe('dispatch-fixture-crash docker parity', () => {
  requireParityImage();

  describeParityRepos('crash', (getWorld) => {
    itMatchesNativeInDocker('fails loud with the same exit code and stderr', getWorld, {
      command: COMMAND,
      dispatchArgs: (repoPath) => [repoPath, COMMAND, SHELL_TWIN, '--', repoPath, 'auto_merge'],
      check: ({ native }) => expect(native).toEqual({
        stdout: '', stderr: 'arcanum: dispatch-fixture: simulated native crash\n', code: 1
      })
    });
  });
});
