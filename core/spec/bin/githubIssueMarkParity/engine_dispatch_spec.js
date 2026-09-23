import path from 'node:path';
import { MARK_TRANSITIONS } from '../../../lib/commands/shared/GithubIssueMark.js';
import { itRoutesEngineDispatch } from '../../support/sharedExamples/engineDispatchRouting.js';
import { seedEngineMode } from '../../support/utils/engineMode.js';
import { createGitFixtureRepo } from '../../support/utils/gitFixtureRepo.js';
import { REPO_ROOT, runCommand } from '../../support/utils/runCommand.js';

const SHIM_SCRIPT = path.join(REPO_ROOT, 'arcanum', '_lib', 'github_issue.sh');

// Routing test for the real arcanum/_lib/github_issue.sh engine_dispatch
// shim's `mark-*` branches (issue #589) — unlike the sibling
// <name>_spec.js parity specs (which bypass the shim, running
// github_issue_shell.sh directly), this file exercises the shim itself.
//
// Once native mode routes through the shim, `env -i` strips this
// process's own `ARCANUM_TEST_FAKE_FETCH`/`FAKE_FETCH_*` env vars, and
// the shim invokes `core/bin/arcanum` with no `--import` fake-fetch
// preload — so the scenario is built to fail before any API call: a git
// repo with no `origin` remote. Both engines then fail with
// `_load_origin`'s/`Origin#resolve`'s message and exit 1, but only
// `core/bin/arcanum` prefixes it with `arcanum: `, which proves which
// implementation actually ran.

/**
 * @param {{repoPath: string}} repo - the fixture repo.
 * @returns {Promise<void>} resolves once its `origin` remote is removed.
 */
async function removeOrigin(repo) {
  await runCommand(['git', '-C', repo.repoPath, 'remote', 'remove', 'origin'], repo.repoPath);
}

describe('github-issue mark-* engine_dispatch routing (via the real github_issue.sh shim)', () => {
  Object.keys(MARK_TRANSITIONS).forEach((name) => {
    let repoPath;

    itRoutesEngineDispatch(
      `mark-${name}`,
      SHIM_SCRIPT,
      async (repo, mode) => {
        repoPath = repo.repoPath;
        await removeOrigin(repo);
        await seedEngineMode(repo, mode);

        return { args: [`mark-${name}`, repo.repoPath, '42'] };
      },
      {
        shell: (result) => {
          expect(result.code).toEqual(1);
          expect(result.stdout).toEqual('');
          expect(result.stderr).toEqual(
            `Error: '${repoPath}' is not a git repository or has no 'origin' remote\n`
          );
        },
        native: (result) => {
          expect(result.code).toEqual(1);
          expect(result.stdout).toEqual('');
          expect(result.stderr).toEqual(
            `arcanum: Error: '${repoPath}' is not a git repository or has no 'origin' remote\n`
          );
        }
      }
    );

    it(`prints mark-${name}'s usage and exits 1 when <id> is missing`, async () => {
      const repo = await createGitFixtureRepo();

      try {
        const result = await runCommand([SHIM_SCRIPT, `mark-${name}`, repo.repoPath], repo.repoPath);

        expect(result.code).toEqual(1);
        expect(result.stdout).toEqual('');
        expect(result.stderr).toEqual(`Usage: ${SHIM_SCRIPT} mark-${name} <repo_path> <id>\n`);
      } finally {
        await repo.cleanup();
      }
    });
  });

  it('prints the usage block, listing every mark-* subcommand, and exits 1 for an unknown subcommand', async () => {
    const repo = await createGitFixtureRepo();

    try {
      const result = await runCommand([SHIM_SCRIPT, 'mark-bogus', repo.repoPath, '42'], repo.repoPath);

      expect(result.code).toEqual(1);
      expect(result.stdout).toEqual('');
      expect(result.stderr.startsWith(`Usage: ${SHIM_SCRIPT} <command> [args]\nCommands:\n`)).toBeTrue();
      Object.keys(MARK_TRANSITIONS).forEach((name) => {
        expect(result.stderr).toContain(`  mark-${name} <repo_path> <id>`);
      });
    } finally {
      await repo.cleanup();
    }
  });
});
