import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { seedGithubLikeRepo } from '../../support/factories/autoFixIssueGithubParitySetup.js';
import { itRoutesEngineDispatch } from '../../support/sharedExamples/engineDispatchRouting.js';
import { seedEngineMode } from '../../support/utils/engineMode.js';
import { createFakeGhBin } from '../../support/utils/fakeGhBin.js';
import { createGitFixtureRepo } from '../../support/utils/gitFixtureRepo.js';
import { REPO_ROOT, runCommand } from '../../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../../support/utils/tempDir.js';

const SHIM_SCRIPT = path.join(REPO_ROOT, 'auto-fix-issue', 'scripts', 'github.sh');
const REPO_REF = 'darthjee/arcanum-github-fixture';

// Parity/routing test for the real auto-fix-issue/scripts/github.sh
// engine_dispatch router (issue #430) — unlike the sibling
// info/pr_create/pr_view/pr_ready specs in this directory (which all
// bypass the shim, running github_shell.sh directly), this file
// exercises the real, rewritten github.sh shim itself, proving it
// correctly resolves each subcommand's own migration-status.json/
// COMMANDS key and routes accordingly — see
// docs/agents/plans/430-migrate-auto-fix-issue-github-entrypoint-to-native-node-js/node/04-parity-tests.md.
//
// Once native mode routes through the shim, `env -i` strips this
// process's own ambient environment (only PATH, ARCANUM_REPO_PATH, and
// — for pr-create/pr-view/pr-ready only, per github.sh's own header
// comment — HOME survive), and the shim invokes `core/bin/arcanum` as a
// plain argv call, with no `--import` flag to preload the fake-fetch
// monkey-patch. `info` never calls `gh`/`fetch` (git-only), so both
// modes are exercised directly against a real successful outcome,
// proving the wiring end-to-end. `pr-create`/`pr-view`/`pr-ready` all
// resolve a GitHub token via `GithubToken#get` (`gh auth token`) before
// ever reaching a REST call — mirroring
// autoFixAllWaitCiParity/engine_dispatch_spec.js's own technique, a
// fake `gh` whose `auth token` unconditionally fails (baked in via
// `createFakeGhBin({ authTokenAlwaysFails: true })`, so it survives
// `env -i`) forces a native-only failure at that very first step, well
// before any real network call — while the shell side's own `gh pr
// create`/`gh pr view`/`gh pr ready` calls never consult `gh auth
// token` themselves (our fake `gh` answers those subcommands
// unconditionally), so the SAME scenario succeeds on the shell side.
// That success-vs-failure split proves which implementation actually
// ran.
describe('auto-fix-issue-github engine_dispatch routing (via the real github.sh shim)', () => {
  itRoutesEngineDispatch(
    'info',
    SHIM_SCRIPT,
    async (repo, mode) => {
      await seedGithubLikeRepo(repo);
      await seedEngineMode(repo, mode);

      return { args: ['info', repo.repoPath] };
    },
    {
      shell: (result) => {
        expect(result.code).toEqual(0);
        expect(result.stdout).toEqual(`DOMAIN=github.com\nREPO=${REPO_REF}\n`);
      },
      native: (result) => {
        expect(result.code).toEqual(0);
        expect(result.stdout).toEqual(`DOMAIN=github.com\nREPO=${REPO_REF}\n`);
      }
    }
  );

  describe('info (engine.mode unset)', () => {
    it('defaults to the shell implementation when engine.mode is unset', async () => {
      const repo = await createGitFixtureRepo();
      // Neutralizes this machine's own ambient global
      // ~/.claude/arcanum-config.json (config_chain.sh's outermost
      // tier, consulted whenever the repo-local tier is silent) by
      // pointing CLAUDE_CONFIG_DIR at an empty directory, so this case
      // genuinely exercises config_chain_read's hardcoded "shell"
      // fallback rather than whatever engine.mode this developer's own
      // machine happens to have configured globally.
      const emptyConfigDir = await createTempDir('arcanum-core-afigh-dispatch-config-');

      try {
        await seedGithubLikeRepo(repo);

        const env = { ...process.env, CLAUDE_CONFIG_DIR: emptyConfigDir };
        const result = await runCommand([SHIM_SCRIPT, 'info', repo.repoPath], repo.repoPath, env);

        expect(result.code).toEqual(0);
        expect(result.stdout).toEqual(`DOMAIN=github.com\nREPO=${REPO_REF}\n`);
      } finally {
        await Promise.all([repo.cleanup(), removeTempDir(emptyConfigDir)]);
      }
    });
  });

  itRoutesEngineDispatch(
    'pr-create',
    SHIM_SCRIPT,
    async (repo, mode) => {
      const fakeGh = await createFakeGhBin(mode === 'native' ? { authTokenAlwaysFails: true } : undefined);
      const file = path.join(repo.repoPath, 'body.md');

      await seedGithubLikeRepo(repo);
      await seedEngineMode(repo, mode);
      await writeFile(file, 'body text\n');

      const env = {
        ...process.env,
        PATH: `${fakeGh.binDir}:${process.env.PATH}`,
        FAKE_GH_PR_CREATE_URL: 'https://github.com/example/repo/pull/77'
      };

      return { args: ['pr-create', repo.repoPath, 'My PR', file], env, cleanup: fakeGh.cleanup };
    },
    {
      shell: (result) => {
        expect(result.code).toEqual(0);
        expect(result.stdout).toEqual('https://github.com/example/repo/pull/77\n');
      },
      native: (result) => {
        expect(result.code).not.toEqual(0);
        expect(result.stdout).toEqual('');
        expect(result.stderr).toContain(`Error: could not create PR on ${REPO_REF}`);
      }
    }
  );

  itRoutesEngineDispatch(
    'pr-view',
    SHIM_SCRIPT,
    async (repo, mode) => {
      const fakeGh = await createFakeGhBin(mode === 'native' ? { authTokenAlwaysFails: true } : undefined);

      await seedGithubLikeRepo(repo);
      await seedEngineMode(repo, mode);

      const env = {
        ...process.env,
        PATH: `${fakeGh.binDir}:${process.env.PATH}`,
        FAKE_GH_PR_NUMBER: '42',
        FAKE_GH_PR_URL: 'https://github.com/example/repo/pull/42'
      };

      return { args: ['pr-view', repo.repoPath], env, cleanup: fakeGh.cleanup };
    },
    {
      shell: (result) => {
        expect(result.code).toEqual(0);
        expect(result.stdout).toEqual('URL=https://github.com/example/repo/pull/42\nIS_DRAFT=false\n');
      },
      native: (result) => {
        expect(result.code).not.toEqual(0);
        expect(result.stdout).toEqual('');
        expect(result.stderr).toEqual('');
      }
    }
  );

  itRoutesEngineDispatch(
    'pr-ready',
    SHIM_SCRIPT,
    async (repo, mode) => {
      const fakeGh = await createFakeGhBin(mode === 'native' ? { authTokenAlwaysFails: true } : undefined);

      await seedGithubLikeRepo(repo);
      await seedEngineMode(repo, mode);

      const env = { ...process.env, PATH: `${fakeGh.binDir}:${process.env.PATH}` };

      return { args: ['pr-ready', repo.repoPath], env, cleanup: fakeGh.cleanup };
    },
    {
      shell: (result) => {
        expect(result.code).toEqual(0);
        expect(result.stdout).toEqual('OK\n');
      },
      native: (result) => {
        expect(result.code).not.toEqual(0);
        expect(result.stdout).toEqual('');
        expect(result.stderr).toContain(`Error: could not mark PR ready on ${REPO_REF}`);
      }
    }
  );
});
