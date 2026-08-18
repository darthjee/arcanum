import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

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
 * @returns {Promise<{stdout: string, stderr: string, code: number}>} the process result.
 */
async function runArcanum(args) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [binPath, ...args]);

    return { stdout, stderr, code: 0 };
  } catch (error) {
    return { stdout: error.stdout, stderr: error.stderr, code: error.code };
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
});
