import path from 'node:path';
import { expectGhNeedsRun } from '../support/factories/engineDispatchDockerSetup.js';
import { itRoutesGhEngineDispatch } from '../support/sharedExamples/ghEngineDispatchRouting.js';
import { seedEngineMode } from '../support/utils/engineMode.js';
import { REPO_ROOT, runCommand } from '../support/utils/runCommand.js';

const SHIM_SCRIPT = path.join(REPO_ROOT, 'auto-monitor-issue-pr', 'scripts', 'resolve_pr_number.sh');

// Routing spec for the real auto-monitor-issue-pr resolve_pr_number.sh
// engine_dispatch shim (docker batch 3, issue #747), under
// engine.mode=shell, native and docker (a passthrough fake `docker`).
// The case runs in a repo with no `origin`, so every mode fails before
// any GitHub call — core/bin/arcanum (native, and the fake `docker`'s
// "container") with its own `arcanum: ` prefix, which proves which
// implementation ran. The docker run carries the
// `--needs=global-config,gitconfig,gh` mounts and env (GH_TOKEN by name
// only).
describe('auto-monitor-issue-pr-resolve-pr-number engine_dispatch routing (via the real shim)', () => {
  let repoPath;
  const noOrigin = () => `Error: '${repoPath}' is not a git repository or has no 'origin' remote\n`;

  itRoutesGhEngineDispatch(
    'resolve_pr_number.sh (no origin)',
    SHIM_SCRIPT,
    async (repo, mode) => {
      repoPath = repo.repoPath;
      await runCommand(['git', '-C', repo.repoPath, 'remote', 'remove', 'origin'], repo.repoPath);
      await seedEngineMode(repo, mode);

      return { args: [repo.repoPath, '42'] };
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
        expectGhNeedsRun(calls, repoPath, ['auto-monitor-issue-pr-resolve-pr-number', repoPath, '42'], world);
      }
    }
  );
});
