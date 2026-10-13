import path from 'node:path';
import { itRoutesRemoteEngineDispatch } from '../support/sharedExamples/remoteEngineDispatchRouting.js';
import { createFakeGhBin } from '../support/utils/fakeGhBin.js';
import { REPO_ROOT } from '../support/utils/runCommand.js';

const SHIM_SCRIPT = path.join(REPO_ROOT, 'auto-monitor-pr', 'scripts', 'monitor_pr.sh');
const PENDING = { stdout: 'pending\n', stderr: '', code: 0 };

/**
 * @param {object} result - the shim's result.
 * @returns {void}
 */
function expectPending(result) {
  expect(result).toEqual(PENDING);
}

// Routing spec for the real auto-monitor-pr/scripts/monitor_pr.sh
// engine_dispatch shim (docker batch 4, issue #748), under
// engine.mode=shell, native and docker (a passthrough fake `docker`).
// The shim declares `--needs=global-config,gitconfig,gh,remote`. A fake
// `gh` (whose `auth token` always fails, and which knows no PR) answers
// every GitHub call, and the best-effort push fails offline, so every
// mode reports `pending`; the docker case proves the remote wiring.
describe('auto-monitor-pr monitor_pr.sh engine_dispatch routing (via the real shim)', () => {
  itRoutesRemoteEngineDispatch('monitor_pr.sh', SHIM_SCRIPT, {
    command: 'auto-monitor-pr-monitor-pr',
    needs: ['global-config', 'gitconfig', 'gh', 'remote'],
    reachesRemote: true,
    prepare: async ({ repoPath }, mode, world) => {
      const fakeGh = await createFakeGhBin({ authTokenAlwaysFails: true });

      return {
        args: [repoPath, '--pr-number', '42'],
        env: { PATH: `${fakeGh.binDir}${path.delimiter}${world.env.PATH}` },
        cleanup: fakeGh.cleanup
      };
    },
    shell: expectPending,
    native: expectPending,
    docker: expectPending,
    https: expectPending
  });
});
