import { chmod, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createTempDir, removeTempDir } from './tempDir.js';

// An `ssh` stand-in for specs whose git fixture repo has an ssh-shaped
// `origin` (e.g. `git@github.com:...`), built like `fakeGhBin.js`: an
// executable `ssh` in a fresh temp dir the spec puts first on `PATH`,
// so `git fetch` never reaches a real host — per the repo-wide "no real
// network calls in specs" rule. Every invocation appends one JSON line
// `{"argv": [...], "sshAuthSock": <$SSH_AUTH_SOCK or null>}` to
// `<binDir>/calls.log`, prints `FAKE_SSH_ERROR` on stderr and exits 255
// (ssh's own connection-failure code), so the fetch fails offline and
// deterministically.

/** The stderr line the fake `ssh` prints on every invocation. */
export const FAKE_SSH_ERROR = 'fake ssh: connection refused\n';

/**
 * Build a fake `ssh` binary in a fresh temp dir.
 * @returns {Promise<{binDir: string, readCalls: () => Promise<object[]>, cleanup: () => Promise<void>}>}
 *   the fake's directory (put it first on `PATH`), a reader returning the
 *   logged `{ argv, sshAuthSock }` calls in order, and a cleanup callback.
 */
export async function createFakeSshBin() {
  const binDir = await createTempDir('arcanum-core-fake-ssh-');
  const logFile = path.join(binDir, 'calls.log');
  const sshPath = path.join(binDir, 'ssh');

  await writeFile(logFile, '');
  await writeFile(sshPath, `#!${process.execPath}
const { appendFileSync } = require('node:fs');

appendFileSync(${JSON.stringify(logFile)}, JSON.stringify({
  argv: process.argv.slice(2),
  sshAuthSock: process.env.SSH_AUTH_SOCK ?? null
}) + '\\n');
process.stderr.write(${JSON.stringify(FAKE_SSH_ERROR)});
process.exitCode = 255;
`);
  await chmod(sshPath, 0o755);

  return {
    binDir,
    readCalls: async () => (await readFile(logFile, 'utf8'))
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line)),
    cleanup: () => removeTempDir(binDir)
  };
}

/**
 * What `git` prints on stderr when a fetch/push over an ssh `origin`
 * goes through the fake `ssh`: the fake's own line, then git's.
 */
export const SSH_REMOTE_FAILURE = `${FAKE_SSH_ERROR}fatal: Could not read from remote repository.\n\n` +
  'Please make sure you have the correct access rights\nand the repository exists.\n';
