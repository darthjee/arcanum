import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  commitThenPushAssertions, itRoutesRemoteEngineDispatch
} from '../support/sharedExamples/remoteEngineDispatchRouting.js';
import { REPO_ROOT } from '../support/utils/runCommand.js';

const SHIM_SCRIPT = path.join(REPO_ROOT, 'auto-plan-issue', 'scripts', 'commit_plan.sh');
const PLAN_DIR = 'docs/agents/plans/7-add-change';

// Routing spec for the real auto-plan-issue/scripts/commit_plan.sh
// engine_dispatch shim (docker batch 4, issue #748), under
// engine.mode=shell, native and docker (a passthrough fake `docker`).
// The shim declares `--needs=global-config,gitconfig,remote` and no
// `--path-arg` (<plan_dir> is inside the repo): every mode commits the
// plan dir and fails the push offline.
describe('auto-plan-issue commit_plan.sh engine_dispatch routing (via the real shim)', () => {
  itRoutesRemoteEngineDispatch('commit_plan.sh', SHIM_SCRIPT, {
    command: 'auto-plan-issue-commit-plan',
    needs: ['global-config', 'gitconfig', 'remote'],
    reachesRemote: true,
    prepare: async ({ repoPath }) => {
      await mkdir(path.join(repoPath, PLAN_DIR), { recursive: true });
      await writeFile(path.join(repoPath, PLAN_DIR, 'plan.md'), '# Plan\n');

      return { args: [repoPath, PLAN_DIR, '7', 'Spec Model', 'model@example.com'] };
    },
    ...commitThenPushAssertions('docs(plan): add implementation plan (issue #7)')
  });
});
