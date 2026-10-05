import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createGitFixtureRepo } from '../support/utils/gitFixtureRepo.js';

// Contract spec for auto-plan-issue/scripts/auto_next.sh (issue #715). This
// is NOT a parity spec: the script is plain bash with no native counterpart
// (like arcanum/_lib/next_step_prompt.sh, which it calls). It pins the
// contract from docs/agents/plans/715-auto-next-skill-wiring/plan.md's
// "Shared contracts": usage errors exit 1 with empty stdout; a HEAD other
// than `issue-<id>` answers CHAIN=no/REASON=branch without reading config;
// an absent/false `next_step.auto.auto-plan-issue` answers
// CHAIN=no/REASON=config; a true key pushes the plan commit and answers
// CHAIN=yes (or CHAIN=no/REASON=push when the push fails). stdout only ever
// carries those key=value lines.
//
// Every run isolates the global config (CLAUDE_CONFIG_DIR/HOME and git's
// global/system config) and points ARCANUM_TTY_DEVICE at a missing path:
// were the TTY ever probed, next_step_prompt.sh would answer FALLBACK=chat
// (exit 4) and auto_next.sh would fail with exit 1, so the CHAIN=no/config
// and CHAIN=yes cases prove the TTY is never touched.

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SCRIPT = path.join(REPO_ROOT, 'auto-plan-issue', 'scripts', 'auto_next.sh');

const ID = '715';
const BRANCH = `issue-${ID}`;
const AUTO_KEY = 'auto-plan-issue';
const NOTICE = `auto-continuing: /loop /auto-resolve-issue ${ID} (next_step.auto.${AUTO_KEY}=true)`;
const GIT_IDENTITY = {
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 't@example.com',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 't@example.com'
};

describe('auto-plan-issue/scripts/auto_next.sh', () => {
  let fixture;
  let repo;
  let configDir;
  let env;

  /**
   * Run a git command in the temp repo with the isolated environment.
   * @param {string[]} args - the git arguments.
   * @returns {Promise<string>} the trimmed stdout.
   */
  async function git(args) {
    const { stdout } = await execFileAsync('git', args, { cwd: repo, env });

    return stdout.trim();
  }

  /**
   * Run auto_next.sh with the isolated environment from a cwd outside the
   * repo, and capture its stdout/stderr/exit code.
   * @param {string[]} args - the CLI arguments.
   * @returns {Promise<{stdout: string, stderr: string, code: number}>} the process result.
   */
  async function run(args) {
    try {
      const { stdout, stderr } = await execFileAsync(SCRIPT, args, { cwd: configDir, env });

      return { stdout, stderr, code: 0 };
    } catch (error) {
      return { stdout: error.stdout || '', stderr: error.stderr || '', code: error.code ?? 1 };
    }
  }

  /**
   * Write `next_step.auto.auto-plan-issue` to the repo config tier.
   * @param {boolean} value - the value to store.
   * @returns {Promise<void>} resolves once written.
   */
  async function writeAutoKey(value) {
    const file = path.join(repo, '.claude', 'configuration', 'arcanum-repo-config.json');

    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify({ next_step: { auto: { [AUTO_KEY]: value } } })}\n`);
  }

  /**
   * Check out `issue-<id>` tracking `origin`, then add an unpushed plan
   * commit on top of it.
   * @returns {Promise<string>} the plan commit's sha.
   */
  async function preparePlanCommit() {
    await git(['checkout', '--quiet', '-b', BRANCH]);
    await git(['push', '--quiet', '-u', 'origin', BRANCH]);
    await mkdir(path.join(repo, 'docs'), { recursive: true });
    await writeFile(path.join(repo, 'docs', 'plan.md'), '# plan\n');
    await git(['add', 'docs/plan.md']);
    await git(['commit', '--quiet', '-m', 'docs(plan): add plan']);

    return git(['rev-parse', 'HEAD']);
  }

  /**
   * @returns {Promise<string>} the remote's `issue-<id>` sha.
   */
  function remoteSha() {
    return execFileAsync('git', ['rev-parse', `refs/heads/${BRANCH}`], { cwd: fixture.remotePath, env })
      .then(({ stdout }) => stdout.trim());
  }

  beforeEach(async () => {
    fixture = await createGitFixtureRepo();
    repo = fixture.repoPath;
    configDir = path.join(path.dirname(repo), 'global-config');
    await mkdir(configDir, { recursive: true });

    env = {
      ...process.env,
      ...GIT_IDENTITY,
      CLAUDE_CONFIG_DIR: configDir,
      HOME: configDir,
      XDG_CONFIG_HOME: configDir,
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_NOSYSTEM: '1',
      ARCANUM_TTY_DEVICE: path.join(configDir, 'missing-tty')
    };

    await git(['config', 'commit.gpgsign', 'false']);
  });

  afterEach(async () => {
    await fixture.cleanup();
  });

  describe('usage errors', () => {
    it('exits 1 with empty stdout when <id> is missing', async () => {
      const result = await run([repo]);

      expect(result.code).toBe(1);
      expect(result.stdout).toBe('');
    });

    it('exits 1 with empty stdout when no argument is given', async () => {
      const result = await run([]);

      expect(result.code).toBe(1);
      expect(result.stdout).toBe('');
    });

    it('exits 1 with empty stdout when <repo_path> is not a directory', async () => {
      const notADir = path.join(configDir, 'a-file');

      await writeFile(notADir, 'not a directory\n');

      const result = await run([notADir, ID]);

      expect(result.code).toBe(1);
      expect(result.stdout).toBe('');
    });
  });

  describe('when HEAD is not issue-<id>', () => {
    it('answers CHAIN=no / REASON=branch without reading config', async () => {
      await writeAutoKey(true);

      const result = await run([repo, ID]);

      expect(result.code).toBe(0);
      expect(result.stdout).toBe('CHAIN=no\nREASON=branch\n');
      expect(result.stderr).not.toContain('auto-continuing');
    });

    it('answers CHAIN=no / REASON=branch on another issue branch', async () => {
      await writeAutoKey(true);
      await git(['checkout', '--quiet', '-b', 'issue-7150']);

      const result = await run([repo, ID]);

      expect(result.code).toBe(0);
      expect(result.stdout).toBe('CHAIN=no\nREASON=branch\n');
    });
  });

  describe('when the auto key is not enabled', () => {
    let planSha;

    beforeEach(async () => {
      planSha = await preparePlanCommit();
    });

    it('answers CHAIN=no / REASON=config when the key is absent', async () => {
      const result = await run([repo, ID]);

      expect(result.code).toBe(0);
      expect(result.stdout).toBe('CHAIN=no\nREASON=config\n');
      expect(result.stderr).not.toContain('auto-continuing');
    });

    it('answers CHAIN=no / REASON=config and does not push when the key is false', async () => {
      await writeAutoKey(false);

      const result = await run([repo, ID]);

      expect(result.code).toBe(0);
      expect(result.stdout).toBe('CHAIN=no\nREASON=config\n');
      expect(await remoteSha()).not.toEqual(planSha);
    });
  });

  describe('when the auto key is true', () => {
    let planSha;

    beforeEach(async () => {
      planSha = await preparePlanCommit();
      await writeAutoKey(true);
    });

    it('pushes the plan commit and answers CHAIN=yes with the notice on stderr', async () => {
      const result = await run([repo, ID]);

      expect(result.code).toBe(0);
      expect(result.stdout).toBe('CHAIN=yes\n');
      expect(result.stderr).toContain(NOTICE);
      expect(await remoteSha()).toEqual(planSha);
    });

    it('answers CHAIN=no / REASON=push when the push fails', async () => {
      await git(['remote', 'set-url', 'origin', path.join(configDir, 'missing-remote.git')]);

      const result = await run([repo, ID]);

      expect(result.code).toBe(0);
      expect(result.stdout).toBe('CHAIN=no\nREASON=push\n');
    });
  });
});
