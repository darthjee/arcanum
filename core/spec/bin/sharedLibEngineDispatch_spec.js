import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { itRoutesWithInvocationLog } from '../support/sharedExamples/invocationLogRouting.js';
import { REPO_ROOT } from '../support/utils/runCommand.js';

const LIB_DIR = path.join(REPO_ROOT, 'arcanum', '_lib');

/**
 * Writes `content` to `file` under `repoPath`, creating its parents.
 * @param {string} repoPath - the fixture repo.
 * @param {string} file - the repo-relative path.
 * @param {string} content - the content.
 * @returns {Promise<void>} resolves once written.
 */
async function seedFile(repoPath, file, content) {
  await mkdir(path.dirname(path.join(repoPath, file)), { recursive: true });
  await writeFile(path.join(repoPath, file), content);
}

// Routing spec for the real arcanum/_lib engine_dispatch shims of
// docker batch 1 (issue #745): finish_report.sh, issue_state.sh,
// list_agents.sh, resolve_id_and_file.sh and resolve_plan_paths.sh,
// under engine.mode=shell, native and docker (a passthrough fake
// `docker`). Both implementations are byte-identical, so the routing is
// proven through core/bin/arcanum's invocation log; the docker case
// also checks the `docker run` carries only the repo mount and no
// extra env.
describe('arcanum/_lib engine_dispatch routing (via the real shims)', () => {
  itRoutesWithInvocationLog('finish_report.sh', path.join(LIB_DIR, 'finish_report.sh'), {
    command: 'finish-report',
    prepare: async ({ repoPath }) => ({
      args: [repoPath, '--skill', 'demo', '--status', 'success', '--summary', 'Done']
    }),
    check: (result) => {
      expect(result).toEqual({ stdout: '== demo: SUCCESS ==\nDone\n', stderr: '', code: 0 });
    },
    dockerArgs: ({ repoPath }) => [repoPath, '--skill', 'demo', '--status', 'success', '--summary', 'Done']
  });

  itRoutesWithInvocationLog('issue_state.sh set', path.join(LIB_DIR, 'issue_state.sh'), {
    command: 'issue-state',
    prepare: async ({ repoPath }) => {
      await seedFile(repoPath, '.claude/state/issue-12.json', '{"status":"new"}');

      return { args: [repoPath, 'set', '12', 'status', 'planned'] };
    },
    check: async (result, { repoPath }) => {
      const state = JSON.parse(await readFile(path.join(repoPath, '.claude', 'state', 'issue-12.json'), 'utf8'));

      expect(result).toEqual({ stdout: '', stderr: '', code: 0 });
      expect(state).toEqual({ status: 'planned' });
    },
    dockerArgs: ({ repoPath }) => [repoPath, 'set', '12', 'status', 'planned']
  });

  itRoutesWithInvocationLog('list_agents.sh', path.join(LIB_DIR, 'list_agents.sh'), {
    command: 'list-agents',
    prepare: async ({ repoPath }) => {
      await seedFile(repoPath, '.claude/agents/alpha.md', '---\nname: alpha\ndescription: Alpha agent\n---\nbody\n');

      return { args: [repoPath] };
    },
    check: (result) => {
      expect(result).toEqual({ stdout: 'alpha|Alpha agent\n', stderr: '', code: 0 });
    },
    dockerArgs: ({ repoPath }) => [repoPath]
  });

  itRoutesWithInvocationLog('resolve_id_and_file.sh', path.join(LIB_DIR, 'resolve_id_and_file.sh'), {
    command: 'resolve-id-and-file',
    prepare: async ({ repoPath }) => {
      await seedFile(repoPath, 'docs/issues/12-fix-it.md', '# Issue 12: Fix it\n');

      return { args: [repoPath, 'docs/issues', '#12'] };
    },
    check: (result) => {
      expect(result).toEqual({
        stdout: 'SCENARIO=C\nID=12\nTITLE=Fix It\nFILE=docs/issues/12-fix-it.md\nSTATUS=existing\n',
        stderr: '',
        code: 0
      });
    },
    dockerArgs: ({ repoPath }) => [repoPath, 'docs/issues', '#12']
  });

  itRoutesWithInvocationLog('resolve_plan_paths.sh', path.join(LIB_DIR, 'resolve_plan_paths.sh'), {
    command: 'resolve-plan-paths',
    prepare: async ({ repoPath }) => {
      await seedFile(repoPath, 'docs/issues/12-fix-it.md', '# Issue 12: Fix it\n');

      return { args: [repoPath, 'docs/issues', 'docs/plans', '12'] };
    },
    check: (result) => {
      expect(result).toEqual({
        stdout: 'ISSUE_FILE=docs/issues/12-fix-it.md\nPLAN_DIR=docs/plans/12-fix-it\n' +
          'PLAN_FILE=docs/plans/12-fix-it/plan.md\nPLAN_EXISTS=false\n',
        stderr: '',
        code: 0
      });
    },
    dockerArgs: ({ repoPath }) => [repoPath, 'docs/issues', 'docs/plans', '12']
  });
});
