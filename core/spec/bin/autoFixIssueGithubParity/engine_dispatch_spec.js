import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { seedGithubLikeRepo } from '../../support/factories/autoFixIssueGithubParitySetup.js';
import { createFakeGhBin } from '../../support/utils/fakeGhBin.js';
import { createGitFixtureRepo } from '../../support/utils/gitFixtureRepo.js';
import { REPO_ROOT, runCommand } from '../../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../../support/utils/tempDir.js';

const SHIM_SCRIPT = path.join(REPO_ROOT, 'auto-fix-issue', 'scripts', 'github.sh');
const REPO_REF = 'darthjee/arcanum-github-fixture';

// KNOWN BUG (out of this plan step's scope — auto-fix-issue/scripts/
// github.sh is owned by the "scripter" agent, not "node"; see this
// plan's node.md "Do not touch" note): every `engine.mode=native`
// branch below is currently blocked by a real defect in the router
// itself, confirmed by direct reproduction (not a flaky/environmental
// issue). `github.sh`'s per-subcommand `case` arms each call
// `engine_dispatch "$REPO_PATH" <command> "$SCRIPT_DIR/github_shell.sh"
// [HOME] -- "$@"`, where `"$@"` is github.sh's OWN full argv —
// `[<subcommand>, <repo_path>, ...]`. `engine_dispatch`'s shell branch
// correctly reuses that array verbatim as `github_shell.sh`'s own argv
// (which legitimately needs `<subcommand>` first), but its native
// branch reuses the SAME array as `core/bin/arcanum <command>`'s
// trailing args too — which must NOT include `<subcommand>` a second
// time, since `<command>` (e.g. `auto-fix-issue-github-info`) already
// encodes it. The result: native invocations receive `<subcommand>`
// (e.g. the literal string `"info"`) as their leading arg instead of
// `<repo_path>` — `Dispatcher#repoContext` binds THAT string as
// `repoPath`, so `RepoContext#validate()` immediately rejects it
// (`Error: not a directory: info`) before the command module ever
// runs. Reproduced directly: `auto-fix-issue/scripts/github.sh info
// <a-valid-repo-path-with-engine.mode=native>` exits 1 with `arcanum:
// Error: not a directory: info` on stderr. This affects all four
// subcommands identically (confirmed for `info`/`pr-create`/`pr-view`/
// `pr-ready`) and needs a fix in `github.sh` (and/or a
// `engine_dispatch.sh` contract change, since a multi-subcommand router
// is the first of its kind to hit this — `arcanum/_lib/engine_dispatch.sh`
// is shared and architect-owned) before these `pending()` specs can be
// turned back into real assertions.
const NATIVE_ROUTING_BUG = 'blocked by a confirmed github.sh engine_dispatch bug — see this file\'s header comment';

/**
 * Seeds `.claude/state/arcanum-config.json`'s `engine.mode` under
 * `repo.repoPath`, the local-state (highest-precedence) tier
 * `config_chain_read`/`engine_dispatch.sh` consult.
 * @param {{repoPath: string}} repo - the fixture repo.
 * @param {string} mode - `"shell"` or `"native"`.
 * @returns {Promise<void>} resolves once written.
 */
async function seedEngineMode(repo, mode) {
  const dir = path.join(repo.repoPath, '.claude', 'state');

  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'arcanum-config.json'), JSON.stringify({ engine: { mode } }));
}

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
  describe('info', () => {
    it('routes to the shell implementation when engine.mode=shell', async () => {
      const repo = await createGitFixtureRepo();

      try {
        await seedGithubLikeRepo(repo);
        await seedEngineMode(repo, 'shell');

        const result = await runCommand([SHIM_SCRIPT, 'info', repo.repoPath], repo.repoPath);

        expect(result.code).toEqual(0);
        expect(result.stdout).toEqual(`DOMAIN=github.com\nREPO=${REPO_REF}\n`);
      } finally {
        await repo.cleanup();
      }
    });

    it('routes to the native implementation when engine.mode=native', async () => {
      pending(NATIVE_ROUTING_BUG);

      const repo = await createGitFixtureRepo();

      try {
        await seedGithubLikeRepo(repo);
        await seedEngineMode(repo, 'native');

        const result = await runCommand([SHIM_SCRIPT, 'info', repo.repoPath], repo.repoPath);

        expect(result.code).toEqual(0);
        expect(result.stdout).toEqual(`DOMAIN=github.com\nREPO=${REPO_REF}\n`);
      } finally {
        await repo.cleanup();
      }
    });

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

  describe('pr-create', () => {
    it('routes to the shell implementation when engine.mode=shell', async () => {
      const fakeGh = await createFakeGhBin();
      const repo = await createGitFixtureRepo();
      const file = path.join(repo.repoPath, 'body.md');

      try {
        await seedGithubLikeRepo(repo);
        await seedEngineMode(repo, 'shell');
        await writeFile(file, 'body text\n');

        const env = {
          ...process.env,
          PATH: `${fakeGh.binDir}:${process.env.PATH}`,
          FAKE_GH_PR_CREATE_URL: 'https://github.com/example/repo/pull/77'
        };
        const result = await runCommand([SHIM_SCRIPT, 'pr-create', repo.repoPath, 'My PR', file], repo.repoPath, env);

        expect(result.code).toEqual(0);
        expect(result.stdout).toEqual('https://github.com/example/repo/pull/77\n');
      } finally {
        await Promise.all([repo.cleanup(), fakeGh.cleanup()]);
      }
    });

    it('routes to the native implementation when engine.mode=native', async () => {
      pending(NATIVE_ROUTING_BUG);

      const fakeGh = await createFakeGhBin({ authTokenAlwaysFails: true });
      const repo = await createGitFixtureRepo();
      const file = path.join(repo.repoPath, 'body.md');

      try {
        await seedGithubLikeRepo(repo);
        await seedEngineMode(repo, 'native');
        await writeFile(file, 'body text\n');

        const env = {
          ...process.env,
          PATH: `${fakeGh.binDir}:${process.env.PATH}`,
          FAKE_GH_PR_CREATE_URL: 'https://github.com/example/repo/pull/77'
        };
        const result = await runCommand([SHIM_SCRIPT, 'pr-create', repo.repoPath, 'My PR', file], repo.repoPath, env);

        expect(result.code).not.toEqual(0);
        expect(result.stdout).toEqual('');
        expect(result.stderr).toContain(`Error: could not create PR on ${REPO_REF}`);
      } finally {
        await Promise.all([repo.cleanup(), fakeGh.cleanup()]);
      }
    });
  });

  describe('pr-view', () => {
    it('routes to the shell implementation when engine.mode=shell', async () => {
      const fakeGh = await createFakeGhBin();
      const repo = await createGitFixtureRepo();

      try {
        await seedGithubLikeRepo(repo);
        await seedEngineMode(repo, 'shell');

        const env = {
          ...process.env,
          PATH: `${fakeGh.binDir}:${process.env.PATH}`,
          FAKE_GH_PR_NUMBER: '42',
          FAKE_GH_PR_URL: 'https://github.com/example/repo/pull/42'
        };
        const result = await runCommand([SHIM_SCRIPT, 'pr-view', repo.repoPath], repo.repoPath, env);

        expect(result.code).toEqual(0);
        expect(result.stdout).toEqual('URL=https://github.com/example/repo/pull/42\nIS_DRAFT=false\n');
      } finally {
        await Promise.all([repo.cleanup(), fakeGh.cleanup()]);
      }
    });

    it('routes to the native implementation when engine.mode=native', async () => {
      pending(NATIVE_ROUTING_BUG);

      const fakeGh = await createFakeGhBin({ authTokenAlwaysFails: true });
      const repo = await createGitFixtureRepo();

      try {
        await seedGithubLikeRepo(repo);
        await seedEngineMode(repo, 'native');

        const env = {
          ...process.env,
          PATH: `${fakeGh.binDir}:${process.env.PATH}`,
          FAKE_GH_PR_NUMBER: '42',
          FAKE_GH_PR_URL: 'https://github.com/example/repo/pull/42'
        };
        const result = await runCommand([SHIM_SCRIPT, 'pr-view', repo.repoPath], repo.repoPath, env);

        expect(result.code).not.toEqual(0);
        expect(result.stdout).toEqual('');
        expect(result.stderr).toEqual('');
      } finally {
        await Promise.all([repo.cleanup(), fakeGh.cleanup()]);
      }
    });
  });

  describe('pr-ready', () => {
    it('routes to the shell implementation when engine.mode=shell', async () => {
      const fakeGh = await createFakeGhBin();
      const repo = await createGitFixtureRepo();

      try {
        await seedGithubLikeRepo(repo);
        await seedEngineMode(repo, 'shell');

        const env = { ...process.env, PATH: `${fakeGh.binDir}:${process.env.PATH}` };
        const result = await runCommand([SHIM_SCRIPT, 'pr-ready', repo.repoPath], repo.repoPath, env);

        expect(result.code).toEqual(0);
        expect(result.stdout).toEqual('OK\n');
      } finally {
        await Promise.all([repo.cleanup(), fakeGh.cleanup()]);
      }
    });

    it('routes to the native implementation when engine.mode=native', async () => {
      pending(NATIVE_ROUTING_BUG);

      const fakeGh = await createFakeGhBin({ authTokenAlwaysFails: true });
      const repo = await createGitFixtureRepo();

      try {
        await seedGithubLikeRepo(repo);
        await seedEngineMode(repo, 'native');

        const env = { ...process.env, PATH: `${fakeGh.binDir}:${process.env.PATH}` };
        const result = await runCommand([SHIM_SCRIPT, 'pr-ready', repo.repoPath], repo.repoPath, env);

        expect(result.code).not.toEqual(0);
        expect(result.stdout).toEqual('');
        expect(result.stderr).toContain(`Error: could not mark PR ready on ${REPO_REF}`);
      } finally {
        await Promise.all([repo.cleanup(), fakeGh.cleanup()]);
      }
    });
  });
});
