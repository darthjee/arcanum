import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { itRoutesWithInvocationLog } from '../support/sharedExamples/invocationLogRouting.js';
import { REPO_ROOT } from '../support/utils/runCommand.js';

const SCRIPTS_DIR = path.join(REPO_ROOT, 'auto-fix-issue', 'scripts');
const PLAN_DIR = 'docs/plans/12-x';

/**
 * Seeds a plan dir (relative to the repo) with two agent files, the
 * main plan file and two `node` step files.
 * @param {string} repoPath - the fixture repo.
 * @returns {Promise<void>} resolves once written.
 */
async function seedPlan(repoPath) {
  const planDir = path.join(repoPath, PLAN_DIR);

  await mkdir(path.join(planDir, 'node'), { recursive: true });
  for (const file of ['plan.md', 'node.md', 'infra.md', 'node/02-b.md', 'node/01-a.md']) {
    await writeFile(path.join(planDir, file), 'x\n');
  }
}

// Routing spec for the real auto-fix-issue list_plan_agents.sh and
// list_plan_steps.sh engine_dispatch shims (issue #745, docker batch 1),
// under engine.mode=shell, native and docker (a passthrough fake
// `docker`). The plan dir is passed relative to the repo (the shims'
// cwd and repo path), so the docker run needs no extra mount.
describe('auto-fix-issue list-plan engine_dispatch routing (via the real shims)', () => {
  itRoutesWithInvocationLog('list_plan_agents.sh', path.join(SCRIPTS_DIR, 'list_plan_agents.sh'), {
    command: 'auto-fix-issue-list-plan-agents',
    prepare: async ({ repoPath }) => {
      await seedPlan(repoPath);

      return { args: [PLAN_DIR] };
    },
    check: (result) => {
      expect(result).toEqual({ stdout: 'infra\nnode\n', stderr: '', code: 0 });
    },
    dockerArgs: () => [PLAN_DIR]
  });

  itRoutesWithInvocationLog('list_plan_steps.sh', path.join(SCRIPTS_DIR, 'list_plan_steps.sh'), {
    command: 'auto-fix-issue-list-plan-steps',
    prepare: async ({ repoPath }) => {
      await seedPlan(repoPath);

      return { args: [PLAN_DIR, 'node'] };
    },
    check: (result) => {
      expect(result).toEqual({
        stdout: `${PLAN_DIR}/node/01-a.md\n${PLAN_DIR}/node/02-b.md\n`, stderr: '', code: 0
      });
    },
    dockerArgs: () => [PLAN_DIR, 'node']
  });
});
