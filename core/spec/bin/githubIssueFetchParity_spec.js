import path from 'node:path';
import { REPO_ROOT, NATIVE_BIN, expectInvalidRepoPathParity, expectParity, git, runCommand } from '../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Parity test for the "github-issue-fetch" migrated entrypoint (issue
// #588) — see docs/agents/architecture/script-engine.md's "output/
// exit-code contract" and
// docs/agents/plans/588-migrate-github-issue-fetch-and-update-subcommands-to-native-node-js/node.md's
// "Shared contracts". Runs arcanum/_lib/github_issue_shell.sh (invoked
// directly, NOT through the arcanum/_lib/github_issue.sh engine_dispatch
// shim — so this test isn't circular) and `core/bin/arcanum
// github-issue-fetch` against identical inputs, asserting byte-identical
// stdout and exit code.
//
// Coverage note: specs never make real network calls, and `fetch` hits
// the GitHub REST API once the origin is resolved — so only the
// offline-reachable failure paths are covered here. The success path and
// post-network failures are covered by GithubIssueFetchIssue_spec.js /
// GithubIssueFetch_spec.js's mocked-`fetchFn` unit tests.

const SHELL_SCRIPT = path.join(REPO_ROOT, 'arcanum', '_lib', 'github_issue_shell.sh');

describe('github-issue-fetch parity (shell vs. native)', () => {
  it('matches shell for a missing repo_path and a non-git repo_path', async () => {
    await expectInvalidRepoPathParity('fetch', 'github-issue-fetch', ['5'], SHELL_SCRIPT);
  });

  describe('a git repo_path with no origin remote', () => {
    it('matches shell exit code, stdout, and stderr message', async () => {
      const repoPath = await createTempDir('arcanum-core-gif-parity-');

      try {
        await git(['init', '--quiet', '-b', 'main', repoPath], repoPath);

        const shell = await runCommand([SHELL_SCRIPT, 'fetch', repoPath, '5'], repoPath);
        const native = await runCommand(
          [process.execPath, NATIVE_BIN, 'github-issue-fetch', repoPath, '5'], repoPath
        );
        const message = `Error: '${repoPath}' is not a git repository or has no 'origin' remote`;

        expectParity(shell, native);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
        expect(shell.stderr.trim()).toEqual(message);
        expect(native.stderr.trim()).toContain(message);
      } finally {
        await removeTempDir(repoPath);
      }
    });
  });
});
