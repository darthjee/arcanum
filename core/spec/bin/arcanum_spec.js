import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createGitFixtureRepo } from '../support/utils/gitFixtureRepo.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

const execFileAsync = promisify(execFile);
const binPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'bin',
  'arcanum'
);

/**
 * Invoke `core/bin/arcanum` with the given arguments as a plain argv
 * call, mirroring how `arcanum/_lib/engine_dispatch.sh` invokes it.
 * @param {string[]} args - the CLI arguments to pass.
 * @param {object} [env] - environment overrides on top of `process.env`
 *   (e.g. `ARCANUM_REPO_PATH`). When omitted, `process.env` is inherited
 *   as-is (no `ARCANUM_REPO_PATH`, unless already set in the test's own
 *   environment).
 * @returns {Promise<{stdout: string, stderr: string, code: number}>} the process result.
 */
async function runArcanum(args, env) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [binPath, ...args], {
      env: env ? { ...process.env, ...env } : process.env
    });

    return { stdout, stderr, code: 0 };
  } catch (error) {
    return { stdout: error.stdout, stderr: error.stderr, code: error.code };
  }
}

/**
 * Write `.claude/state/arcanum-config.json` under `repoPath` with
 * `engine.log.location` set to `logDir` — the shape `config_chain_read`
 * expects for its local-state tier.
 * @param {string} repoPath - the repo directory to configure.
 * @param {string} logDir - the `engine.log.location` value.
 * @returns {Promise<void>} resolves once written.
 */
async function configureLogLocation(repoPath, logDir) {
  const stateDir = path.join(repoPath, '.claude', 'state');

  await mkdir(stateDir, { recursive: true });
  await writeFile(
    path.join(stateDir, 'arcanum-config.json'),
    JSON.stringify({ engine: { log: { location: logDir } } })
  );
}

/**
 * @param {string} logDir - the configured `engine.log.location`.
 * @param {string} repoPath - the repo path used as `ARCANUM_REPO_PATH`.
 * @returns {string} the expected log file path.
 */
function logFilePath(logDir, repoPath) {
  return path.join(logDir, `arcanum-${path.basename(repoPath)}-log.txt`);
}

/**
 * @param {string} filePath - the file to read.
 * @returns {Promise<?string>} the file's content, or `null` if missing.
 */
async function readFileIfExists(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

describe('bin/arcanum', () => {
  describe('a known command (dispatch-fixture)', () => {
    it('routes to DispatchFixture and prints its success output on stdout only', async () => {
      const { stdout, stderr, code } = await runArcanum(['dispatch-fixture']);

      expect(stdout).toEqual('dispatch-fixture: ok\n');
      expect(stderr).toEqual('');
      expect(code).toEqual(0);
    });
  });

  describe('a known command that crashes (dispatch-fixture-crash)', () => {
    it('exits non-zero and prints nothing to stdout, with no fallback output', async () => {
      const { stdout, code } = await runArcanum(['dispatch-fixture-crash']);

      expect(code).not.toEqual(0);
      expect(stdout).toEqual('');
    });
  });

  describe('an unknown command', () => {
    it('fails clearly with a non-zero exit code and a stderr message', async () => {
      const { stdout, stderr, code } = await runArcanum(['not-a-real-command']);

      expect(code).not.toEqual(0);
      expect(stdout).toEqual('');
      expect(stderr).toContain('not-a-real-command');
    });
  });

  // Invocation logging (issue #244) — temporary, debug-only
  // instrumentation. See core/lib/InvocationLog.js and
  // docs/agents/plans/244-add-logs-to-native-nodejs-calls/node.md.
  describe('invocation logging', () => {
    let repo;
    let logDir;

    beforeEach(async () => {
      repo = await createGitFixtureRepo();
      logDir = await createTempDir('arcanum-core-invocation-log-');
    });

    afterEach(async () => {
      await repo.cleanup();
      await removeTempDir(logDir);
    });

    describe('a dev/proof command excluded from logging (dispatch-fixture)', () => {
      it('leaves the log file untouched even with engine.log.location configured', async () => {
        await configureLogLocation(repo.repoPath, logDir);

        const { stdout, code } = await runArcanum(['dispatch-fixture'], {
          ARCANUM_REPO_PATH: repo.repoPath
        });

        expect(stdout).toEqual('dispatch-fixture: ok\n');
        expect(code).toEqual(0);
        expect(await readFileIfExists(logFilePath(logDir, repo.repoPath))).toBeNull();
      });
    });

    describe('a real migrated command (list-agents) with engine.log.location configured', () => {
      it('appends exactly one log line matching the documented format', async () => {
        await configureLogLocation(repo.repoPath, logDir);

        const { stdout, code } = await runArcanum(['list-agents', repo.repoPath], {
          ARCANUM_REPO_PATH: repo.repoPath
        });

        expect(stdout).toEqual('');
        expect(code).toEqual(0);

        const content = await readFileIfExists(logFilePath(logDir, repo.repoPath));

        expect(content).not.toBeNull();
        const lines = content.split('\n').filter((line) => line.length > 0);

        expect(lines.length).toEqual(1);
        expect(lines[0]).toMatch(/^command list-agents invoked at \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      });
    });

    describe('the same command with ARCANUM_REPO_PATH unset', () => {
      it('creates no log file and leaves stdout/exit code unchanged from the unlogged baseline', async () => {
        await configureLogLocation(repo.repoPath, logDir);

        const env = { ...process.env };
        delete env.ARCANUM_REPO_PATH;

        const { stdout, code } = await execFileAsync(process.execPath, [binPath, 'list-agents', repo.repoPath], {
          env
        }).then(
          (result) => ({ stdout: result.stdout, code: 0 }),
          (error) => ({ stdout: error.stdout, code: error.code })
        );

        expect(stdout).toEqual('');
        expect(code).toEqual(0);
        expect(await readFileIfExists(logFilePath(logDir, repo.repoPath))).toBeNull();
      });
    });

    describe('a crashing command (dispatch-fixture-crash) with engine.log.location configured', () => {
      it('leaves exit code non-zero and stdout empty, but still gets logged', async () => {
        await configureLogLocation(repo.repoPath, logDir);

        const { stdout, code } = await runArcanum(['dispatch-fixture-crash'], {
          ARCANUM_REPO_PATH: repo.repoPath
        });

        expect(code).not.toEqual(0);
        expect(stdout).toEqual('');

        const content = await readFileIfExists(logFilePath(logDir, repo.repoPath));

        expect(content).not.toBeNull();
        const lines = content.split('\n').filter((line) => line.length > 0);

        expect(lines.length).toEqual(1);
        expect(lines[0]).toMatch(/^command dispatch-fixture-crash invoked at /);
      });
    });

    describe('engine.log.location pointed at a non-existent/unwritable directory', () => {
      it('leaves exit code and stdout for a normal command unchanged (no error surfaces)', async () => {
        await configureLogLocation(repo.repoPath, path.join(logDir, 'no', 'such', 'nested', 'dir'));

        const { stdout, code } = await runArcanum(['list-agents', repo.repoPath], {
          ARCANUM_REPO_PATH: repo.repoPath
        });

        expect(stdout).toEqual('');
        expect(code).toEqual(0);
      });
    });
  });
});
