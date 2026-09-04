import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { seedOriginUrl } from '../utils/runCommand.js';

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
export const SHELL_SCRIPT = path.join(REPO_ROOT, 'arcanum-split-issue', 'scripts', 'push_sub_issues_shell.sh');
export const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');

export const ISSUE_ID = '999';

/**
 * Run an arcanum-split-issue-push-sub-issues invocation (shell or native)
 * and capture its stdout/stderr/exit code.
 * @param {string[]} commandAndArgs - `[file, ...args]` to `execFile`.
 * @param {string} cwd - the directory to run the command in.
 * @returns {Promise<{stdout: string, stderr: string, code: number}>} the process result.
 */
export async function runCommand([file, ...args], cwd) {
  try {
    const { stdout, stderr } = await execFileAsync(file, args, { cwd });

    return { stdout, stderr, code: 0 };
  } catch (error) {
    return { stdout: error.stdout || '', stderr: error.stderr || '', code: error.code ?? 1 };
  }
}

/**
 * @param {string[]} args - the `<repo_path> <issue_id>` arguments to pass
 *   to both sides.
 * @param {string} cwd - the directory to run both commands in.
 * @returns {Promise<{shell: object, native: object}>} both sides' results.
 */
export async function runBoth(args, cwd) {
  const shell = await runCommand([SHELL_SCRIPT, ...args], cwd);
  const native = await runCommand(
    [process.execPath, NATIVE_BIN, 'arcanum-split-issue-push-sub-issues', ...args],
    cwd
  );

  return { shell, native };
}

/**
 * Writes a sub-issue draft file at
 * `<repoPath>/docs/agents/issues/<issueId>_<count>_<slug>.md` and returns
 * its `docs/agents/issues/...`-relative path.
 * @param {string} repoPath - the target repo's local checkout path.
 * @param {string} issueId - the parent issue's numeric id.
 * @param {string} count - the zero-padded count segment (e.g. `'01'`).
 * @param {string} slug - the filename slug.
 * @param {string} content - the draft file's full contents.
 * @returns {Promise<string>} the written file's `docs/agents/issues/...`
 *   relative path.
 */
export async function writeSubIssueFile(repoPath, issueId, count, slug, content) {
  const issuesDir = path.join(repoPath, 'docs', 'agents', 'issues');

  await mkdir(issuesDir, { recursive: true });

  const fileName = `${issueId}_${count}_${slug}.md`;

  await writeFile(path.join(issuesDir, fileName), content);

  return path.posix.join('docs', 'agents', 'issues', fileName);
}

/**
 * Sets `origin` to a github.com-shaped URL (satisfying Origin.js's/
 * origin.sh's domain/repo parsing — no real network involved, nothing
 * ever pushes/fetches against it in this flow) and writes a
 * `plan-issues.max-retry-count: 0` repo-local config, so SpawnIssue's
 * retry loop (shell or native) is skipped entirely, never touching
 * gh/curl/fetch.
 * @param {string} repoPath - the target repo's local checkout path.
 * @returns {Promise<void>} resolves once seeded.
 */
export async function seedZeroRetryRepo(repoPath) {
  await seedOriginUrl(repoPath, 'https://github.com/darthjee/arcanum-pssi-fixture.git');

  const stateDir = path.join(repoPath, '.claude', 'state');

  await mkdir(stateDir, { recursive: true });
  await writeFile(
    path.join(stateDir, 'arcanum-config.json'),
    JSON.stringify({ 'plan-issues': { 'max-retry-count': 0 } })
  );
}
