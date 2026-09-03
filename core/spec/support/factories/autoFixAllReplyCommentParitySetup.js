import { execFile } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { REPO_ROOT, seedOriginUrl } from '../utils/runCommand.js';

// Shared setup for the "auto-fix-all-reply-comment" migrated entrypoint
// parity specs (issue #256) — see
// docs/agents/architecture/script-engine.md's "output/exit-code
// contract" and
// docs/agents/plans/256-migrate-auto-fix-all-reply-comment-entrypoint-to-native-node-js/plan.md's
// "Shared contracts". Runs auto-fix-all/scripts/reply_comment_shell.sh
// (invoked directly, NOT through the
// auto-fix-all/scripts/reply_comment.sh engine_dispatch shim — so this
// test isn't circular) and `core/bin/arcanum auto-fix-all-reply-comment`
// against equivalent inputs, asserting byte-identical stdout and exit
// code.
//
// Unlike the offline-only precedent set by githubIssueCreateParity_spec.js
// / spawnIssueParity_spec.js, this migrated entrypoint's happy path and
// REST-failure path ARE exercised here too, isolating every real
// gh/network touchpoint instead of skipping them:
//   - `gh` itself is replaced (via a `PATH`-prepended fake binary, see
//     fakeGhBin.js) for both sides — the shell script's `gh pr comment`/
//     `gh auth switch` calls and the native side's `resolve_pr_number.sh`
//     (real, unmodified — shelled out to by both implementations) and
//     `GithubToken#get`'s `gh auth token` call.
//   - the native side's raw `fetch` call to `api.github.com` is replaced
//     by preloading fakeGithubApiFetchPreload.js via `node --import`
//     (monkey-patches the global `fetch` before `core/bin/arcanum` is
//     ever imported).
//   - each fixture repo's `origin` remote is set to a github.com-shaped
//     URL whose actual transport is rewritten (via `git config
//     url.<local-bare-repo>.pushInsteadOf <github-url>`) to the repo's own
//     local bare remote — `git remote get-url origin` still reports the
//     github.com URL (satisfying Origin.js/origin.sh's domain/repo
//     parsing), while `git push`/`git fetch` never leave the filesystem.
//
// None of this touches the real network at any point, per the repo-wide
// "no real network calls in specs" rule.

const execFileAsync = promisify(execFile);

export const SHELL_SCRIPT = path.join(REPO_ROOT, 'auto-fix-all', 'scripts', 'reply_comment_shell.sh');
export const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');
export const FAKE_FETCH_PRELOAD = pathToFileURL(
  path.join(REPO_ROOT, 'core', 'spec', 'support', 'utils', 'fakeGithubApiFetchPreload.js')
).href;

export const ID = '999';
export const ARGS_TAIL = [ID, 'node', 'Node Agent', 'node@example.com', 'a reply'];

/**
 * Run a reply-comment invocation (shell or native) and capture its
 * stdout/stderr/exit code.
 * @param {string[]} commandAndArgs - `[file, ...args]` to `execFile`.
 * @param {string} cwd - the directory to run the command in.
 * @param {object} [env] - the environment to run the command with
 *   (defaults to the current process's own environment).
 * @returns {Promise<{stdout: string, stderr: string, code: number}>} the process result.
 */
export async function runCommand([file, ...args], cwd, env = process.env) {
  try {
    const { stdout, stderr } = await execFileAsync(file, args, { cwd, env });

    return { stdout, stderr, code: 0 };
  } catch (error) {
    return { stdout: error.stdout || '', stderr: error.stderr || '', code: error.code ?? 1 };
  }
}

/**
 * @param {string[]} args - the `git` arguments to run.
 * @param {string} cwd - the directory to run them in.
 * @returns {Promise<{stdout: string}>} the command's stdout.
 */
export async function git(args, cwd) {
  return execFileAsync('git', args, { cwd });
}

/**
 * Rewrites `repo.repoPath`'s `origin` remote to a github.com-shaped URL
 * whose actual PUSH transport is redirected (via
 * `url.<path>.pushInsteadOf` — deliberately not the blanket
 * `insteadOf`, which also rewrites plain `git remote get-url origin`
 * itself) to `repo.remotePath`: `git remote get-url origin` still
 * reports the github.com URL (satisfying `Origin.js`/`origin.sh`'s
 * domain/repo parsing), while `git push` never leaves the filesystem.
 * Both implementations read the same real installed
 * `auto-fix-all/templates/reply.tmpl.md` from the arcanum install (not
 * `repoPath`), so no template copy is seeded here.
 * @param {{repoPath: string, remotePath: string}} repo - the fixture repo.
 * @returns {Promise<void>} resolves once seeded.
 */
export async function seedGithubLikeRepo(repo) {
  const fakeUrl = 'https://github.com/darthjee/arcanum-reply-comment-fixture.git';

  await seedOriginUrl(repo.repoPath, fakeUrl);
  await git(['config', `url.${repo.remotePath}.pushInsteadOf`, fakeUrl], repo.repoPath);
}
