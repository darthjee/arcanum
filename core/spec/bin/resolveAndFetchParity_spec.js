import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createGitFixtureRepo } from '../support/utils/gitFixtureRepo.js';

// Parity test for the "resolve-and-fetch" migrated entrypoint (issue
// #193) — see docs/agents/architecture/script-engine.md's "output/
// exit-code contract" and
// docs/agents/plans/193-migrate-resolve-and-fetch-sh-to-a-native--node-js--implementation/plan.md's
// "Shared contracts". Runs arcanum/_lib/resolve_and_fetch_shell.sh
// (invoked directly, NOT through the arcanum/_lib/resolve_and_fetch.sh
// engine_dispatch shim — so this test isn't circular) and
// `core/bin/arcanum resolve-and-fetch` against identical inputs/repo
// state, asserting byte-identical stdout and exit code.
//
// Coverage note: node/04's own scenario list includes "a fresh GitHub
// fetch (success case)" and "a GitHub fetch failure" against a real
// non-2xx response. Neither is reachable here without a real network
// call: arcanum/_lib/github_issue.sh hardcodes
// `https://api.github.com` with no override hook (out of this agent's
// scope to change), and actually hitting it — even to observe a
// deliberate failure — would violate the repo-wide "no real network
// calls in specs" rule this same plan's own Testing section states.
// Instead, this spec exercises the shared "no local file -> attempt to
// fetch from GitHub -> STATUS=error" code path via a failure that's
// reachable fully offline and deterministically: `_load_origin`/
// `Origin#resolve` rejecting the fixture repo's non-GitHub-shaped
// (local filesystem path) origin URL, on both sides, before any HTTP
// call is ever attempted. The native module's own success-fetch
// behavior (labels, DOMAIN/REPO, file write, state write) is already
// covered by GithubIssue_spec.js's fixture-mocked `fetch`.

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SHELL_SCRIPT = path.join(REPO_ROOT, 'arcanum', '_lib', 'resolve_and_fetch_shell.sh');
const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');
const ISSUES_FOLDER = 'docs/agents/issues';

/**
 * Run a resolve-and-fetch invocation (shell or native) and capture its
 * stdout/exit code (stderr is intentionally not compared — see
 * plan.md's "Shared contracts": only stdout/exit code are part of the
 * byte-identical contract). Runs with `cwd` set to the target repo:
 * `resolve_and_fetch_shell.sh` never `cd`s itself (only
 * `checkout_safe_branch.sh`'s own child process does, which doesn't
 * affect its parent's cwd), so its `issues_folder` argument resolves
 * against the caller's ambient cwd — matching how it's actually
 * invoked in practice (a skill's Bash tool call already parked at
 * `$REPO_PATH`, per docs/agents/architecture/repo-path-threading.md).
 * @param {string[]} commandAndArgs - `[file, ...args]` to `execFile`.
 * @param {string} cwd - the directory to run the command in.
 * @returns {Promise<{stdout: string, code: number}>} the process result.
 */
async function runCommand([file, ...args], cwd) {
  try {
    const { stdout } = await execFileAsync(file, args, { cwd });

    return { stdout, code: 0 };
  } catch (error) {
    return { stdout: error.stdout || '', code: error.code ?? 1 };
  }
}

describe('resolve-and-fetch parity (shell vs. native)', () => {
  let repo;

  beforeEach(async () => {
    repo = await createGitFixtureRepo();
    await mkdir(path.join(repo.repoPath, ISSUES_FOLDER), { recursive: true });
  });

  afterEach(async () => {
    await repo.cleanup();
  });

  /**
   * @param {string} argString - the raw resolve-and-fetch input.
   * @returns {Promise<void>} resolves once both sides have been asserted equal.
   */
  async function assertParity(argString) {
    const shell = await runCommand(
      ['bash', SHELL_SCRIPT, repo.repoPath, ISSUES_FOLDER, argString],
      repo.repoPath
    );
    const native = await runCommand(
      [process.execPath, NATIVE_BIN, 'resolve-and-fetch', repo.repoPath, ISSUES_FOLDER, argString],
      repo.repoPath
    );

    expect(native.stdout).toEqual(shell.stdout);
    expect(native.code).toEqual(shell.code);
  }

  describe('a valid #<id> matching an existing local file', () => {
    it('matches shell output byte-for-byte (no GitHub fetch attempted)', async () => {
      await writeFile(path.join(repo.repoPath, ISSUES_FOLDER, '42-existing-issue.md'), 'content\n');

      await assertParity('#42');
    });

    it('matches shell output for an underscore-separated existing filename', async () => {
      await writeFile(path.join(repo.repoPath, ISSUES_FOLDER, '43_my_cool_issue.md'), 'content\n');

      await assertParity('#43');
    });
  });

  describe('malformed input variants', () => {
    const cases = ['', '   ', '#abc', '#193 - title', 'bare title', '#', '193', '# 1'];

    cases.forEach((argString) => {
      it(`matches shell output for '${argString}'`, async () => {
        await assertParity(argString);
      });
    });
  });

  describe('no existing file — an attempted GitHub fetch fails (offline, deterministic)', () => {
    it('matches shell output byte-for-byte', async () => {
      await assertParity('#999999');
    });

    it('matches shell output for whitespace-trimmed valid input too', async () => {
      await assertParity('  #999998  ');
    });
  });
});
