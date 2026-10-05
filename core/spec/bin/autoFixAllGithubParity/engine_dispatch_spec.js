import path from 'node:path';
import { seedGithubLikeRepo } from '../../support/factories/githubParitySetup.js';
import { itRoutesEngineDispatch } from '../../support/sharedExamples/engineDispatchRouting.js';
import { seedEngineMode } from '../../support/utils/engineMode.js';
import { createFakeGhBin } from '../../support/utils/fakeGhBin.js';
import { createGitFixtureRepo } from '../../support/utils/gitFixtureRepo.js';
import { REPO_ROOT, runCommand } from '../../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../../support/utils/tempDir.js';

const SHIM_SCRIPT = path.join(REPO_ROOT, 'auto-fix-all', 'scripts', 'github.sh');
const NATIVE_TOKEN_FAILURE = 'could not obtain GitHub token via gh auth token';

// Routing test for the real auto-fix-all/scripts/github.sh
// engine_dispatch router (issue #656) — unlike the sibling
// pr_number/pr_state/pr_merge/cleanup_branch/has_label/add_tag/
// remove_tag specs in this directory (which all bypass the shim, running
// github_shell.sh directly), this file exercises the real github.sh shim
// itself, proving it resolves each subcommand's own
// migration-status.json/COMMANDS key (`auto-fix-all-github-<subcommand>`)
// and routes accordingly — see
// docs/agents/plans/656-route-auto-fix-all-scripts-github-sh-through-engine-dispatch-native-counterparts-unreachable/plan.md.
//
// Once native mode routes through the shim, `env -i` strips this
// process's own ambient environment (only PATH, ARCANUM_REPO_PATH, and
// HOME survive — see github.sh's own header comment), and the shim
// invokes `core/bin/arcanum` as a plain argv call, with no `--import`
// flag to preload the fake-fetch monkey-patch. `pr-state` resolves a
// GitHub token via `GithubToken#get` (`gh auth token`) before any REST
// call on the native side, so a fake `gh` whose `auth token`
// unconditionally fails (baked in via
// `createFakeGhBin({ authTokenAlwaysFails: true })`, so it survives
// `env -i`) forces a native-only failure at that very first step, well
// before any real network call. The shell side's own `gh pr view` never
// consults `gh auth token` (our fake `gh` answers it unconditionally),
// so the SAME fake `gh` lets the shell side succeed. That
// success-vs-failure split proves which implementation actually ran.
//
// This file tests routing, not output parity.
describe('auto-fix-all-github engine_dispatch routing (via the real github.sh shim)', () => {
  /**
   * Builds a github.com-shaped fixture repo's pr-state invocation, with a
   * fake `gh` whose `auth token` always fails, on `PATH`.
   * @param {{repoPath: string}} repo - the fixture repo.
   * @param {object} [extraEnv] - additional environment overrides.
   * @returns {Promise<{args: string[], env: object, cleanup: () => Promise<void>}>}
   *   the shim arguments, environment, and fake-`gh` teardown.
   */
  async function preparePrState(repo, extraEnv = {}) {
    const fakeGh = await createFakeGhBin({ authTokenAlwaysFails: true });

    await seedGithubLikeRepo(repo);

    const env = {
      ...process.env,
      ...extraEnv,
      PATH: `${fakeGh.binDir}:${process.env.PATH}`,
      FAKE_GH_PR_NUMBER: '42',
      FAKE_GH_PR_STATE: 'MERGED'
    };

    return { args: ['pr-state', repo.repoPath], env, cleanup: fakeGh.cleanup };
  }

  itRoutesEngineDispatch(
    'pr-state',
    SHIM_SCRIPT,
    async (repo, mode) => {
      await seedEngineMode(repo, mode);

      return preparePrState(repo);
    },
    {
      shell: (result) => {
        expect(result.code).toEqual(0);
        expect(result.stdout).toEqual('STATE=MERGED\n');
      },
      native: (result) => {
        expect(result.code).toEqual(1);
        expect(result.stdout).toEqual('');
        expect(result.stderr).toContain(NATIVE_TOKEN_FAILURE);
        expect(result.stderr).not.toContain('no native implementation');
      }
    }
  );

  describe('pr-state (engine.mode unset)', () => {
    it('defaults to the shell implementation when engine.mode is unset', async () => {
      const repo = await createGitFixtureRepo();
      // Neutralizes this machine's own ambient global
      // ~/.claude/arcanum-config.json (config_chain.sh's outermost
      // tier, consulted whenever the repo-local tier is silent) by
      // pointing CLAUDE_CONFIG_DIR at an empty directory, so this case
      // genuinely exercises config_chain_read's hardcoded "shell"
      // fallback rather than whatever engine.mode this developer's own
      // machine happens to have configured globally.
      const emptyConfigDir = await createTempDir('arcanum-core-afagh-dispatch-config-');
      let cleanup;

      try {
        const prepared = await preparePrState(repo, { CLAUDE_CONFIG_DIR: emptyConfigDir });

        cleanup = prepared.cleanup;

        const result = await runCommand([SHIM_SCRIPT, ...prepared.args], repo.repoPath, prepared.env);

        expect(result.code).toEqual(0);
        expect(result.stdout).toEqual('STATE=MERGED\n');
        expect(result.stderr).not.toContain(NATIVE_TOKEN_FAILURE);
      } finally {
        await Promise.all([repo.cleanup(), removeTempDir(emptyConfigDir), cleanup?.()]);
      }
    });
  });

  // `has-label` and its `has-shipit-label` alias (issue #692) share the
  // single `auto-fix-all-github-has-label` key: in native mode both must
  // reach `AutoFixAllGithub#hasLabel`, which fails at token resolution
  // and (by contract, issue #715: labels could not be determined) exits 2
  // silently — whereas the shell side, with the
  // same fake `gh` labels, would exit 0. An empty stderr also rules out
  // engine_dispatch's "no native implementation" error.
  describe('has-label / has-shipit-label (engine.mode=native)', () => {
    [
      { subcommand: 'has-label', args: ['5', 'Epic'] },
      { subcommand: 'has-shipit-label', args: ['5'] }
    ].forEach(({ subcommand, args }) => {
      it(`routes ${subcommand} to the native has-label command`, async () => {
        const repo = await createGitFixtureRepo();
        const fakeGh = await createFakeGhBin({ authTokenAlwaysFails: true });

        try {
          await seedGithubLikeRepo(repo);
          await seedEngineMode(repo, 'native');

          const result = await runCommand(
            [SHIM_SCRIPT, subcommand, repo.repoPath, ...args],
            repo.repoPath,
            { ...process.env, PATH: `${fakeGh.binDir}:${process.env.PATH}`, FAKE_GH_ISSUE_LABELS: 'Epic\nshipit' }
          );

          expect(result.code).toEqual(2);
          expect(result.stdout).toEqual('');
          expect(result.stderr).toEqual('');
        } finally {
          await Promise.all([repo.cleanup(), fakeGh.cleanup()]);
        }
      });
    });
  });

  describe('unknown or missing subcommand', () => {
    ['shell', 'native'].forEach((mode) => {
      [
        { label: 'an unknown subcommand', args: (repoPath) => ['bogus', repoPath] },
        { label: 'no subcommand at all', args: () => [] }
      ].forEach(({ label, args }) => {
        it(`prints the usage to stderr and exits 1 for ${label} (engine.mode=${mode})`, async () => {
          const repo = await createGitFixtureRepo();

          try {
            await seedGithubLikeRepo(repo);
            await seedEngineMode(repo, mode);

            const result = await runCommand([SHIM_SCRIPT, ...args(repo.repoPath)], repo.repoPath);

            expect(result.code).toEqual(1);
            expect(result.stdout).toEqual('');
            // `$0` in the usage line proves the shim itself printed it,
            // not a fallthrough into github_shell.sh.
            expect(result.stderr).toContain(`Usage: ${SHIM_SCRIPT} <command> <repo_path> [args]`);
            expect(result.stderr).not.toContain('github_shell');
            expect(result.stderr).not.toContain('unknown command');
            expect(result.stderr).not.toContain('no native implementation');
          } finally {
            await repo.cleanup();
          }
        });
      });
    });
  });
});
