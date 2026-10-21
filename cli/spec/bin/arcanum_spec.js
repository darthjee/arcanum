import { execFile } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CLI_DIR } from '../support/paths.js';

const GATE = path.join(CLI_DIR, 'bin', 'arcanum');

/**
 * @param {string} found - the Node.js version to fake.
 * @returns {string} a `data:` module that makes `process.versions.node` report it.
 */
function fakeNodeVersion(found) {
  const source =
    `Object.defineProperty(process, 'versions', { value: { ...process.versions, node: '${found}' } });`;

  return `data:text/javascript,${encodeURIComponent(source)}`;
}

/**
 * Runs a script with the current Node binary, never through a shell.
 * @param {string[]} args - node's arguments.
 * @returns {Promise<{code: number, stdout: string, stderr: string}>} the outcome.
 */
function runNode(args) {
  return new Promise((resolve) => {
    execFile(process.execPath, args, (error, stdout, stderr) => {
      resolve({ code: error ? error.code : 0, stdout, stderr });
    });
  });
}

describe('bin/arcanum (Node-floor gate)', () => {
  ['22.12.9', '20.18.0', '18.0.0', '21.99.99'].forEach((found) => {
    it(`exits 1 with the required version on Node ${found}`, async () => {
      const result = await runNode(['--import', fakeNodeVersion(found), GATE, '--version']);

      expect(result.code).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe(`Node.js >= 22.13.0 required, found ${found}\n`);
    });
  });

  describe('at or above the floor', () => {
    let tmp;

    beforeEach(async () => {
      tmp = await mkdtemp(path.join(os.tmpdir(), 'arcanum-cli-gate-'));
      await mkdir(path.join(tmp, 'bin'));
      await copyFile(GATE, path.join(tmp, 'bin', 'arcanum'));
    });

    afterEach(async () => {
      await rm(tmp, { recursive: true, force: true });
    });

    ['22.13.0', '22.14.0', '23.0.0'].forEach((found) => {
      it(`passes the gate on Node ${found} and imports the bundle next to it`, async () => {
        const result = await runNode(['--import', fakeNodeVersion(found), path.join(tmp, 'bin', 'arcanum')]);

        expect(result.code).toBe(1);
        expect(result.stderr).not.toContain('required');
        expect(result.stderr).toContain(path.join(tmp, 'dist', 'arcanum.mjs'));
      });
    });
  });
});
