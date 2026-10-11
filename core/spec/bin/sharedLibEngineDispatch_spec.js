import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  GH_NEEDS_ENV_NAMES, HTTPS_NOT_ALLOWED, SPEC_GH_TOKEN, expectGhNeedsRun, expectRunWith, nativeCommandFailed, runCalls
} from '../support/factories/engineDispatchDockerSetup.js';
import { itRoutesGhEngineDispatch } from '../support/sharedExamples/ghEngineDispatchRouting.js';
import { itRoutesWithInvocationLog } from '../support/sharedExamples/invocationLogRouting.js';
import { itRoutesRemoteEngineDispatch } from '../support/sharedExamples/remoteEngineDispatchRouting.js';
import { seedEngineMode } from '../support/utils/engineMode.js';
import { FAKE_SSH_ERROR, SSH_REMOTE_FAILURE, createFakeSshBin } from '../support/utils/fakeSshBin.js';
import { REPO_ROOT, runCommand, seedOriginUrl } from '../support/utils/runCommand.js';
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
  // and env (resolve_and_fetch.sh's `remote` need adds nothing without
  // an `origin`; see the ssh-origin case below); spawn_issue.sh's
  // <body_file> (`--path-arg=4:ro`) adds a read-only file mount only
  // when it sits outside the repo.
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
  // resolve_and_fetch.sh's `remote` need (issue #747), with an ssh
  // `origin`: checkout-safe-branch's `git fetch -p` goes through a fake
  // `ssh` (first on PATH; it logs its argv and exits 255), so the fetch
  // fails offline in every mode. HOME is a temp dir holding
  // `.ssh/known_hosts` and SSH_AUTH_SOCK is seeded, so the docker run's
  // remote additions are deterministic on both platforms: the agent
  // socket mount (Darwin: Docker Desktop's fixed
  // /run/host-services/ssh-auth.sock; Linux: the host socket onto
  // /run/arcanum/ssh-agent.sock), the known_hosts `:ro` mount, and
  // `-e SSH_AUTH_SOCK` / `-e GIT_SSH_COMMAND` — the latter proven to be
  // what the in-"container" git actually ran.
  describe('gh commands (ssh origin)', () => {
    const SSH_ORIGIN = 'git@github.com:darthjee/arcanum.git';
    let repoPath;
    let homeDir;
    let fakeSsh;

    itRoutesGhEngineDispatch(
      'resolve_and_fetch.sh',
      path.join(LIB_DIR, 'resolve_and_fetch.sh'),
      async (repo, mode) => {
        repoPath = repo.repoPath;
        homeDir = await realpath(await createTempDir('arcanum-core-ssh-home-'));
        fakeSsh = await createFakeSshBin();
        await mkdir(path.join(homeDir, '.ssh'));
        await writeFile(path.join(homeDir, '.ssh', 'known_hosts'), '');
        await seedOriginUrl(repo.repoPath, SSH_ORIGIN);
        await seedEngineMode(repo, mode);

        const env = { ...process.env };

        ['GIT_SSH', 'GIT_SSH_COMMAND', 'GIT_CONFIG_GLOBAL', 'XDG_CONFIG_HOME'].forEach((name) => delete env[name]);

        return {
          args: [repo.repoPath, 'docs/agents/issues', '#42'],
          env: {
            ...env,
            HOME: homeDir,
            SSH_AUTH_SOCK: path.join(homeDir, 'agent.sock'),
            PATH: `${fakeSsh.binDir}${path.delimiter}${process.env.PATH}`
          },
          cleanup: async () => {
            await fakeSsh.cleanup();
            await removeTempDir(homeDir);
          }
        };
      },
      {
        shell: (result) => {
          expect(result).toEqual({ stdout: '', stderr: SSH_REMOTE_FAILURE, code: 128 });
        },
        native: (result) => {
          expect(result.code).toEqual(1);
          expect(result.stdout).toEqual('');
          expect(result.stderr).toContain('arcanum: Command failed: git fetch -p\n');
          expect(result.stderr).toContain(FAKE_SSH_ERROR);
        },
        docker: async (result, calls, world) => {
          const knownHosts = path.join(homeDir, '.ssh', 'known_hosts');
          const containerSock = process.platform === 'darwin'
            ? '/run/host-services/ssh-auth.sock'
            : '/run/arcanum/ssh-agent.sock';
          const hostSock = process.platform === 'darwin' ? containerSock : path.join(homeDir, 'agent.sock');
          const sshCommand = `ssh -o UserKnownHostsFile=${knownHosts} -o StrictHostKeyChecking=yes`;
          const sshCalls = await fakeSsh.readCalls();

          expect(result.code).toEqual(1);
          expect(result.stdout).toEqual('');
          expect(result.stderr).toContain('arcanum: Command failed: git fetch -p\n');
          expectRunWith(calls, repoPath, ['resolve-and-fetch', repoPath, 'docs/agents/issues', '#42'], {
            mounts: [...world.mounts, `${hostSock}:${containerSock}`, `${knownHosts}:${knownHosts}:ro`],
            envNames: [...GH_NEEDS_ENV_NAMES, 'SSH_AUTH_SOCK', 'GIT_SSH_COMMAND']
          });

          const [run] = runCalls(calls);

          expect(run.env.SSH_AUTH_SOCK).toEqual(containerSock);
          expect(run.env.GIT_SSH_COMMAND).toEqual(sshCommand);
          expect(run.env.GH_TOKEN).toEqual(SPEC_GH_TOKEN);
          expect(sshCalls.length).toEqual(1);
          expect(sshCalls[0].argv.slice(0, 4))
            .toEqual(['-o', `UserKnownHostsFile=${knownHosts}`, '-o', 'StrictHostKeyChecking=yes']);
          expect(sshCalls[0].sshAuthSock).toEqual(containerSock);
        }
      }
    );
  });

  // Docker batch 4 (issue #748): checkout_safe_branch.sh declares
  // `--needs=gitconfig,remote` (no HOME in its allowlist). Its
  // `git fetch -p` goes through the world's fake `ssh` (ssh origin) or
  // is refused by `protocol.https.allow=never` (https origin), so every
  // mode fails offline.
  itRoutesRemoteEngineDispatch('checkout_safe_branch.sh', path.join(LIB_DIR, 'checkout_safe_branch.sh'), {
    command: 'checkout-safe-branch',
    needs: ['gitconfig', 'remote'],
    reachesRemote: true,
    prepare: async (repo) => ({ args: [repo.repoPath] }),
    shell: (result) => {
      expect(result).toEqual({ stdout: '', stderr: SSH_REMOTE_FAILURE, code: 128 });
    },
    native: (result) => {
      expect(result).toEqual({ stdout: '', stderr: nativeCommandFailed('git fetch -p', SSH_REMOTE_FAILURE), code: 1 });
    },
    docker: (result) => {
      expect(result).toEqual({ stdout: '', stderr: nativeCommandFailed('git fetch -p', SSH_REMOTE_FAILURE), code: 1 });
    },
    https: (result) => {
      expect(result).toEqual({ stdout: '', stderr: nativeCommandFailed('git fetch -p', HTTPS_NOT_ALLOWED), code: 1 });
    }
  });
});
