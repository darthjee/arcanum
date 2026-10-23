import { run } from '../../lib/main.js';
import { fakeIo } from './fakeIo.js';

/**
 * Runs the CLI in-process against fake targets.
 * @param {string[]} argv - the CLI arguments.
 * @param {object} options - the invocation.
 * @param {string} options.cwd - the working directory.
 * @param {object} [options.env] - the environment (never the real one).
 * @param {object} [options.migrationVersions] - the per-scope migration versions.
 * @param {string} [options.version] - the CLI version.
 * @param {object} [options.deps] - injected collaborators.
 * @param {object} [options.io] - `fakeIo` options (`stdin`, `tty`).
 * @returns {Promise<{code: number, out: string, err: string, json: () => object}>} the outcome.
 */
export async function runCli(argv, { cwd, env = {}, migrationVersions, version, deps, io: ioOptions } = {}) {
  const io = fakeIo(ioOptions);
  const code = await run(argv, { io, cwd, env, migrationVersions, version, deps });

  return { code, out: io.out(), err: io.err(), json: () => JSON.parse(io.out()) };
}
