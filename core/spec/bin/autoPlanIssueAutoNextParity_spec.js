import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { createGitFixtureRepo } from '../support/utils/gitFixtureRepo.js';
import { NATIVE_BIN, REPO_ROOT, expectParity, runCommand } from '../support/utils/runCommand.js';

// Parity spec for the "auto-plan-issue-auto-next" dispatched command
// (issue #760, originally the #715 contract spec for
// auto-plan-issue/scripts/auto_next.sh). Every case builds two identical
// worlds (a git fixture repo with a local bare origin plus an isolated
// global config dir) and runs auto-plan-issue/scripts/auto_next_shell.sh
// directly in one (NOT through the auto_next.sh engine_dispatch shim) and
// `core/bin/arcanum auto-plan-issue-auto-next` in the other, with the
// same arguments, asserting identical stdout and exit code — and
// identical stderr wherever it carries no world-specific path or git push
// output (the `Usage:` line's script name is normalized, since the shell
// prints its own `$0`).
//
// The contract (docs/agents/architecture/skill-finish.md#next-step-map):
// usage errors exit 1 with empty stdout; a HEAD other than `issue-<id>`
// answers CHAIN=no/REASON=branch without reading config; an absent/false
// `next_step.auto.auto-plan-issue` answers CHAIN=no/REASON=config; a true
// key pushes the plan commit and answers CHAIN=yes (or
// CHAIN=no/REASON=push when the push fails). When
// `next_step.clear.auto-plan-issue` is also true (issue #796), CHAIN=yes
// is followed by CLEAR=true; CLEAR never follows CHAIN=no. stdout only
// ever carries those key=value lines.
//
// Every run isolates the global config (CLAUDE_CONFIG_DIR/HOME and git's
// global/system config) and points ARCANUM_TTY_DEVICE at a missing path:
// were the TTY ever probed, the prompt would answer FALLBACK=chat (exit 4)
// and the command would fail with exit 1, so the CHAIN=no/config and
// CHAIN=yes cases prove the TTY is never touched.

const execFileAsync = promisify(execFile);

const SHELL_SCRIPT = path.join(REPO_ROOT, 'auto-plan-issue', 'scripts', 'auto_next_shell.sh');

const ID = '715';
const BRANCH = `issue-${ID}`;
const AUTO_KEY = 'auto-plan-issue';
const NOTICE = `auto-continuing: /loop /auto-resolve-issue ${ID} (next_step.auto.${AUTO_KEY}=true)\n`;
const CLEAR_NOTICE = `auto-continuing: /loop /auto-resolve-issue ${ID} ` +
  `(next_step.auto.${AUTO_KEY}=true, next_step.clear.${AUTO_KEY}=true)\n`;
const GIT_IDENTITY = {
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 't@example.com',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 't@example.com'
};

/**
 * Replaces the script name on `Usage:` lines, which the shell takes from
 * its own `$0`.
 * @param {string} stderr - a side's stderr.
 * @returns {string} the normalized stderr.
 */
function normalizeUsage(stderr) {
  return stderr.replace(/^Usage: \S+ /gm, 'Usage: <script> ');
}

/**
 * One isolated world: a git fixture repo with a local bare origin, an
 * isolated global config dir and the env every run uses.
 */
class World {
  /**
   * @returns {Promise<World>} the world, ready to use.
   */
  static async create() {
    const world = new World();

    world.fixture = await createGitFixtureRepo();
    world.repo = world.fixture.repoPath;
    world.configDir = path.join(path.dirname(world.repo), 'global-config');
    await mkdir(world.configDir, { recursive: true });
    world.env = {
      ...process.env,
      ...GIT_IDENTITY,
      CLAUDE_CONFIG_DIR: world.configDir,
      HOME: world.configDir,
      XDG_CONFIG_HOME: world.configDir,
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_NOSYSTEM: '1',
      ARCANUM_TTY_DEVICE: path.join(world.configDir, 'missing-tty')
    };
    await world.git(['config', 'commit.gpgsign', 'false']);

    return world;
  }

  /**
   * Run a git command in the world's repo.
   * @param {string[]} args - the git arguments.
   * @param {string} [cwd] - where to run it (defaults to the repo).
   * @returns {Promise<string>} the trimmed stdout.
   */
  async git(args, cwd = this.repo) {
    const { stdout } = await execFileAsync('git', args, { cwd, env: this.env });

    return stdout.trim();
  }

  /**
   * Write `next_step.auto.auto-plan-issue` to the repo config tier.
   * @param {boolean} value - the value to store.
   * @returns {Promise<void>} resolves once written.
   */
  async writeAutoKey(value) {
    await this.writeNextStep({ auto: { [AUTO_KEY]: value } });
  }

  /**
   * Write `next_step.auto.auto-plan-issue` and
   * `next_step.clear.auto-plan-issue` to the repo config tier.
   * @param {boolean} auto - the auto key's value.
   * @param {boolean} clear - the clear key's value.
   * @returns {Promise<void>} resolves once written.
   */
  async writeAutoAndClearKeys(auto, clear) {
    await this.writeNextStep({ auto: { [AUTO_KEY]: auto }, clear: { [AUTO_KEY]: clear } });
  }

  /**
   * Write the `next_step` section of the repo config tier.
   * @param {object} nextStep - the section's content.
   * @returns {Promise<void>} resolves once written.
   */
  async writeNextStep(nextStep) {
    const file = path.join(this.repo, '.claude', 'configuration', 'arcanum-repo-config.json');

    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify({ next_step: nextStep })}\n`);
  }

  /**
   * Check out `issue-<id>` tracking `origin`, then add an unpushed plan
   * commit on top of it.
   * @returns {Promise<string>} the plan commit's sha.
   */
  async preparePlanCommit() {
    await this.git(['checkout', '--quiet', '-b', BRANCH]);
    await this.git(['push', '--quiet', '-u', 'origin', BRANCH]);
    await mkdir(path.join(this.repo, 'docs'), { recursive: true });
    await writeFile(path.join(this.repo, 'docs', 'plan.md'), '# plan\n');
    await this.git(['add', 'docs/plan.md']);
    await this.git(['commit', '--quiet', '-m', 'docs(plan): add plan']);

    return this.git(['rev-parse', 'HEAD']);
  }

  /**
   * @returns {Promise<string>} the remote's `issue-<id>` sha.
   */
  remoteSha() {
    return this.git(['rev-parse', `refs/heads/${BRANCH}`], this.fixture.remotePath);
  }

  /**
   * @param {string[]} command - `[file, ...args]` to run from the config
   *   dir (a cwd outside the repo).
   * @returns {Promise<{stdout: string, stderr: string, code: number}>} the result.
   */
  run(command) {
    return runCommand(command, this.configDir, this.env);
  }
}

describe('auto-plan-issue-auto-next parity (shell vs. native)', () => {
  let shellWorld;
  let nativeWorld;

  beforeEach(async () => {
    shellWorld = await World.create();
    nativeWorld = await World.create();
  });

  afterEach(async () => {
    await shellWorld.fixture.cleanup();
    await nativeWorld.fixture.cleanup();
  });

  /**
   * Run `setup` in both worlds.
   * @param {(world: World) => Promise<(string|void)>} setup - the per-world setup.
   * @returns {Promise<Array<(string|void)>>} the shell and native worlds' results.
   */
  function inBoth(setup) {
    return Promise.all([setup(shellWorld), setup(nativeWorld)]);
  }

  /**
   * Run both sides, each in its own world, and assert stdout/exit-code
   * parity.
   * @param {(world: World) => string[]} buildArgs - the arguments for a
   *   world.
   * @param {object} [options] - behavior.
   * @param {boolean} [options.sameStderr] - also assert identical
   *   (usage-normalized) stderr.
   * @returns {Promise<{shell: object, native: object}>} both results.
   */
  async function runBoth(buildArgs, { sameStderr = true } = {}) {
    const shell = await shellWorld.run([SHELL_SCRIPT, ...buildArgs(shellWorld)]);
    const native = await nativeWorld.run([
      process.execPath, NATIVE_BIN, 'auto-plan-issue-auto-next', ...buildArgs(nativeWorld)
    ]);

    expectParity(shell, native);

    if (sameStderr) {
      expect(normalizeUsage(native.stderr)).toEqual(normalizeUsage(shell.stderr));
    }

    return { shell, native };
  }

  describe('usage errors', () => {
    const usageCases = {
      'when <id> is missing': (world) => [world.repo],
      'when no argument is given': () => [],
      'when <repo_path> is empty': () => ['', ID]
    };

    Object.entries(usageCases).forEach(([label, buildArgs]) => {
      it(`exits 1 with empty stdout ${label}`, async () => {
        const { shell } = await runBoth(buildArgs);

        expect(shell.code).toBe(1);
        expect(shell.stdout).toBe('');
        expect(normalizeUsage(shell.stderr)).toBe('Usage: <script> <repo_path> <id>\n');
      });
    });

    it('exits 1 with empty stdout when <repo_path> is not a directory', async () => {
      const notADir = path.join(shellWorld.configDir, 'a-file');

      await writeFile(notADir, 'not a directory\n');

      const { shell } = await runBoth(() => [notADir, ID]);

      expect(shell.code).toBe(1);
      expect(shell.stdout).toBe('');
      expect(shell.stderr).toBe(`Error: repo path '${notADir}' is not a directory\n`);
    });
  });

  describe('when HEAD is not issue-<id>', () => {
    beforeEach(async () => {
      await inBoth((world) => world.writeAutoKey(true));
    });

    it('answers CHAIN=no / REASON=branch without reading config', async () => {
      const { shell } = await runBoth((world) => [world.repo, ID]);

      expect(shell).toEqual({ stdout: 'CHAIN=no\nREASON=branch\n', stderr: '', code: 0 });
    });

    it('answers CHAIN=no / REASON=branch on another issue branch', async () => {
      await inBoth((world) => world.git(['checkout', '--quiet', '-b', 'issue-7150']));

      const { shell } = await runBoth((world) => [world.repo, ID]);

      expect(shell).toEqual({ stdout: 'CHAIN=no\nREASON=branch\n', stderr: '', code: 0 });
    });

    it('answers CHAIN=no / REASON=branch on a directory that is not a git repo', async () => {
      const { shell } = await runBoth((world) => [world.configDir, ID]);

      expect(shell).toEqual({ stdout: 'CHAIN=no\nREASON=branch\n', stderr: '', code: 0 });
    });
  });

  describe('when the auto key is not enabled', () => {
    let planShas;

    beforeEach(async () => {
      planShas = await inBoth((world) => world.preparePlanCommit());
    });

    it('answers CHAIN=no / REASON=config when the key is absent', async () => {
      const { shell } = await runBoth((world) => [world.repo, ID]);

      expect(shell).toEqual({ stdout: 'CHAIN=no\nREASON=config\n', stderr: '', code: 0 });
    });

    it('answers CHAIN=no / REASON=config and does not push when the key is false', async () => {
      await inBoth((world) => world.writeAutoKey(false));

      const { shell } = await runBoth((world) => [world.repo, ID]);

      expect(shell.stdout).toBe('CHAIN=no\nREASON=config\n');
      expect(await shellWorld.remoteSha()).not.toEqual(planShas[0]);
      expect(await nativeWorld.remoteSha()).not.toEqual(planShas[1]);
    });
  });

  describe('when the auto key is true', () => {
    let planShas;

    beforeEach(async () => {
      planShas = await inBoth((world) => world.preparePlanCommit());
      await inBoth((world) => world.writeAutoKey(true));
    });

    it('pushes the plan commit and answers CHAIN=yes with the notice on stderr', async () => {
      const { shell, native } = await runBoth((world) => [world.repo, ID], { sameStderr: false });

      expect(shell.code).toBe(0);
      expect(shell.stdout).toBe('CHAIN=yes\n');
      expect(shell.stderr).toContain(NOTICE);
      expect(native.stderr).toContain(NOTICE);
      expect(await shellWorld.remoteSha()).toEqual(planShas[0]);
      expect(await nativeWorld.remoteSha()).toEqual(planShas[1]);
    });

    it('answers CHAIN=no / REASON=push when the push fails', async () => {
      await inBoth((world) => world.git(['remote', 'set-url', 'origin', path.join(world.configDir, 'missing.git')]));

      const { shell, native } = await runBoth((world) => [world.repo, ID], { sameStderr: false });

      expect(shell.code).toBe(0);
      expect(shell.stdout).toBe('CHAIN=no\nREASON=push\n');
      expect(native.stderr.startsWith(NOTICE)).toBeTrue();
      expect(native.stderr.length).toBeGreaterThan(NOTICE.length);
    });
  });

  describe('when the auto and clear keys are true (issue #796)', () => {
    let planShas;

    beforeEach(async () => {
      planShas = await inBoth((world) => world.preparePlanCommit());
      await inBoth((world) => world.writeAutoAndClearKeys(true, true));
    });

    it('pushes and answers CHAIN=yes + CLEAR=true with the two-key notice', async () => {
      const { shell, native } = await runBoth((world) => [world.repo, ID], { sameStderr: false });

      expect(shell.code).toBe(0);
      expect(shell.stdout).toBe('CHAIN=yes\nCLEAR=true\n');
      expect(shell.stderr).toContain(CLEAR_NOTICE);
      expect(native.stderr).toContain(CLEAR_NOTICE);
      expect(await shellWorld.remoteSha()).toEqual(planShas[0]);
      expect(await nativeWorld.remoteSha()).toEqual(planShas[1]);
    });

    it('answers CHAIN=no / REASON=push without CLEAR when the push fails', async () => {
      await inBoth((world) => world.git(['remote', 'set-url', 'origin', path.join(world.configDir, 'missing.git')]));

      const { shell, native } = await runBoth((world) => [world.repo, ID], { sameStderr: false });

      expect(shell.code).toBe(0);
      expect(shell.stdout).toBe('CHAIN=no\nREASON=push\n');
      expect(native.stderr.startsWith(CLEAR_NOTICE)).toBeTrue();
    });

    it('answers CHAIN=no / REASON=branch without CLEAR on another branch', async () => {
      await inBoth((world) => world.git(['checkout', '--quiet', '-b', 'issue-7150']));

      const { shell } = await runBoth((world) => [world.repo, ID]);

      expect(shell).toEqual({ stdout: 'CHAIN=no\nREASON=branch\n', stderr: '', code: 0 });
    });
  });

  describe('when the clear key is true but the auto key is not (issue #796)', () => {
    beforeEach(async () => {
      await inBoth((world) => world.preparePlanCommit());
      await inBoth((world) => world.writeAutoAndClearKeys(false, true));
    });

    it('answers CHAIN=no / REASON=config without CLEAR', async () => {
      const { shell } = await runBoth((world) => [world.repo, ID]);

      expect(shell).toEqual({ stdout: 'CHAIN=no\nREASON=config\n', stderr: '', code: 0 });
    });
  });

  describe('when the auto key is true and the clear key false (issue #796)', () => {
    beforeEach(async () => {
      await inBoth((world) => world.preparePlanCommit());
      await inBoth((world) => world.writeAutoAndClearKeys(true, false));
    });

    it('answers a plain CHAIN=yes with the one-key notice', async () => {
      const { shell, native } = await runBoth((world) => [world.repo, ID], { sameStderr: false });

      expect(shell.stdout).toBe('CHAIN=yes\n');
      expect(shell.stderr).toContain(NOTICE);
      expect(native.stderr).toContain(NOTICE);
    });
  });
});
