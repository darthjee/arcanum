import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expectGhNeedsRun } from '../support/factories/engineDispatchDockerSetup.js';
import { itRoutesGhEngineDispatch } from '../support/sharedExamples/ghEngineDispatchRouting.js';
import { itRoutesWithInvocationLog } from '../support/sharedExamples/invocationLogRouting.js';
import { seedEngineMode } from '../support/utils/engineMode.js';
import { REPO_ROOT, runCommand } from '../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

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

/**
 * @param {{repoPath: string}} repo - the fixture repo.
 * @returns {Promise<void>} resolves once its `origin` remote is removed.
 */
async function removeOrigin(repo) {
  await runCommand(['git', '-C', repo.repoPath, 'remote', 'remove', 'origin'], repo.repoPath);
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

  // Docker batch 3 (issue #747): resolve_and_fetch.sh and spawn_issue.sh
  // need GitHub, so their cases run in a repo with no `origin` and fail
  // before any GitHub call — core/bin/arcanum (native, and the
  // passthrough fake `docker`) with its own `arcanum: ` prefix. Their
  // docker run carries the `--needs=global-config,gitconfig,gh` mounts
  // and env; spawn_issue.sh's <body_file> (`--path-arg=4:ro`) adds a
  // read-only file mount only when it sits outside the repo.
  describe('gh commands (no origin)', () => {
    let repoPath;
    let bodyFile;

    itRoutesGhEngineDispatch(
      'resolve_and_fetch.sh',
      path.join(LIB_DIR, 'resolve_and_fetch.sh'),
      async (repo, mode) => {
        repoPath = repo.repoPath;
        await removeOrigin(repo);
        await seedEngineMode(repo, mode);

        return { args: [repo.repoPath, 'docs/agents/issues', '#42'] };
      },
      {
        shell: (result) => {
          expect(result).toEqual({
            stdout: '',
            stderr: 'error: pathspec \'origin/main\' did not match any file(s) known to git\n',
            code: 1
          });
        },
        native: (result) => {
          expect(result.code).toEqual(1);
          expect(result.stdout).toEqual('');
          expect(result.stderr).toContain('arcanum: Command failed: git checkout origin/main\n');
        },
        docker: (result, calls, world) => {
          expect(result.code).toEqual(1);
          expect(result.stdout).toEqual('');
          expect(result.stderr).toContain('arcanum: Command failed: git checkout origin/main\n');
          expectGhNeedsRun(
            calls, repoPath, ['resolve-and-fetch', repoPath, 'docs/agents/issues', '#42'], world
          );
        }
      }
    );

    [
      { label: 'inside the repo', outside: false, mounts: () => [] },
      { label: 'outside the repo', outside: true, mounts: () => [`${bodyFile}:${bodyFile}:ro`] }
    ].forEach(({ label, outside, mounts }) => {
      const noOrigin = () => `Error: '${repoPath}' is not a git repository or has no 'origin' remote\n`;

      itRoutesGhEngineDispatch(
        `spawn_issue.sh with a body file ${label}`,
        path.join(LIB_DIR, 'spawn_issue.sh'),
        async (repo, mode) => {
          const bodyDir = outside ? await realpath(await createTempDir('arcanum-core-spawn-issue-body-')) : repo.repoPath;

          repoPath = repo.repoPath;
          bodyFile = path.join(bodyDir, 'body.md');
          await removeOrigin(repo);
          await seedEngineMode(repo, mode);
          await writeFile(bodyFile, 'body\n');

          return {
            args: [repo.repoPath, '7', 'Child title', bodyFile],
            cleanup: async () => {
              if (outside) await removeTempDir(bodyDir);
            }
          };
        },
        {
          shell: (result) => {
            expect(result).toEqual({ stdout: '', stderr: noOrigin(), code: 1 });
          },
          native: (result) => {
            expect(result).toEqual({ stdout: '', stderr: `arcanum: ${noOrigin()}`, code: 1 });
          },
          docker: (result, calls, world) => {
            expect(result).toEqual({ stdout: '', stderr: `arcanum: ${noOrigin()}`, code: 1 });
            expectGhNeedsRun(
              calls, repoPath, ['spawn-issue', repoPath, '7', 'Child title', bodyFile], world, mounts()
            );
          }
        }
      );
    });
  });
});
