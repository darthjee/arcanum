import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  commitThenPushAssertions, itRoutesRemoteEngineDispatch
} from '../support/sharedExamples/remoteEngineDispatchRouting.js';
import { REPO_ROOT, runCommand } from '../support/utils/runCommand.js';

const SHIM_SCRIPT = path.join(REPO_ROOT, 'auto-fix-issue', 'scripts', 'commit_change.sh');

// Routing spec for the real auto-fix-issue/scripts/commit_change.sh
// engine_dispatch shim (docker batch 4, issue #748), under
// engine.mode=shell, native and docker (a passthrough fake `docker`).
// The shim declares `--needs=global-config,gitconfig,remote`: every
// mode commits the staged file and fails the push offline (fake `ssh`
// for an ssh origin, `protocol.https.allow=never` for an https one).
describe('auto-fix-issue commit_change.sh engine_dispatch routing (via the real shim)', () => {
  itRoutesRemoteEngineDispatch('commit_change.sh', SHIM_SCRIPT, {
    command: 'auto-fix-issue-commit-change',
    needs: ['global-config', 'gitconfig', 'remote'],
    reachesRemote: true,
    prepare: async ({ repoPath }) => {
      await writeFile(path.join(repoPath, 'CHANGED.md'), 'changed\n');
      await runCommand(['git', '-C', repoPath, 'add', 'CHANGED.md'], repoPath);

      return { args: [repoPath, 'feat', 'node', '7', 'add change', 'node', 'Spec Model', 'model@example.com'] };
    },
    ...commitThenPushAssertions('feat(node): add change (issue #7)')
  });
});
