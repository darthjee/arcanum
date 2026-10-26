// `arcanum self-update`: updates the global arcanum-cli to the latest
// release (see docs/agents/specs/cli-install/self-update.md and
// docs/agents/architecture/arcanum-cli.md#self-update).
//
// Every module this command needs is imported statically: `npm i -g` may
// replace the running bundle mid-run, so nothing is loaded after it.

import { lstat as fsLstat, readFile as fsReadFile, realpath as fsRealpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CliError, EXIT_OK, InterruptedError, NpmError, TargetUnavailableError, UsageError } from '../exitCodes.js';
import { selfUpdateUsage } from '../help.js';
import { runNpm as defaultRunNpm } from '../npm.js';
import { compareVersions } from '../skew.js';

/** The package `self-update` updates, whatever the fork. */
export const PACKAGE_NAME = 'arcanum-cli';

/** `npm root -g` process timeout, in ms. */
export const ROOT_TIMEOUT = 15000;
/** `npm view` process timeout, in ms (a backstop over `--fetch-timeout`). */
export const VIEW_TIMEOUT = 30000;
/** `npm config get registry` process timeout, in ms (best effort). */
export const REGISTRY_TIMEOUT = 5000;

const FALLBACK_INSTALL = `npm i -g ${PACKAGE_NAME}@latest`;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

/** `self-update` takes no options of its own. */
export const options = {};

/**
 * @param {string} startDir - the directory to start from.
 * @param {(file: string, encoding: string) => Promise<string>} readFile - reads a file.
 * @returns {Promise<(string|null)>} the nearest directory, `startDir` or
 *   above, whose `package.json` is named `arcanum-cli`, or `null`.
 */
export async function findPackageDir(startDir, readFile) {
  let dir = startDir;

  for (;;) {
    try {
      const manifest = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'));

      if (manifest && manifest.name === PACKAGE_NAME) {
        return dir;
      }
    } catch {
      // no (readable) package.json here: keep walking up.
    }

    const parent = path.dirname(dir);

    if (parent === dir) {
      return null;
    }

    dir = parent;
  }
}

/**
 * @param {string} version - a candidate version.
 * @returns {boolean} whether it is a plain `MAJOR.MINOR.PATCH[-prerelease]`.
 */
export function isPlainSemver(version) {
  return typeof version === 'string' && SEMVER.test(version);
}

/**
 * @param {object} deps - the injected collaborators.
 * @returns {object} the collaborators `self-update` uses, with defaults.
 */
function collaborators(deps) {
  const execFileAsync = deps.execFileAsync;

  return {
    runNpm: deps.runNpm || ((args, runOptions) => defaultRunNpm(args, { ...runOptions, execFileAsync })),
    realpath: deps.realpath || fsRealpath,
    lstat: deps.lstat || fsLstat,
    readFile: deps.readFile || fsReadFile,
    platform: deps.platform || process.platform,
    packageDir: deps.packageDir,
    signals: deps.signals || process
  };
}

/**
 * Refuses anything `self-update` does not accept: positionals and the
 * targeting flags.
 * @param {string[]} positionals - the arguments after `self-update`.
 * @param {{repo: (string|undefined), claudeConfigDir: (string|undefined)}} targeting - the targeting flags.
 * @throws {UsageError} (exit `2`) on an extra argument or a targeting flag.
 */
function checkInvocation(positionals, targeting) {
  if (positionals.length > 0) {
    throw new UsageError(`self-update: unexpected argument '${positionals[0]}'`);
  }

  if (targeting.repo !== undefined) {
    throw new UsageError('--repo is not accepted by self-update');
  }

  if (targeting.claudeConfigDir !== undefined) {
    throw new UsageError('--claude-config-dir is not accepted by self-update');
  }
}

/**
 * @param {object} tools - the collaborators.
 * @returns {Promise<string>} `npm root -g`.
 * @throws {NpmError} (exit `8`) when npm is missing or the call fails.
 */
async function npmRoot(tools) {
  try {
    const { stdout } = await tools.runNpm(['root', '-g'], { timeout: ROOT_TIMEOUT });

    return stdout.trim();
  } catch (error) {
    if (error instanceof NpmError && error.category !== 'not_installed') {
      throw new NpmError('could not locate the npm global install (npm root -g failed)', {
        npmOutput: error.npmOutput, category: error.category, npmExit: error.npmExit
      });
    }

    throw error;
  }
}

/**
 * @param {object} tools - the collaborators.
 * @param {string} file - a path.
 * @returns {Promise<(object|null)>} its `lstat`, or `null` when missing.
 */
async function lstatOrNull(tools, file) {
  try {
    return await tools.lstat(file);
  } catch {
    return null;
  }
}

/**
 * @param {object} tools - the collaborators.
 * @param {string} file - a path.
 * @returns {Promise<string>} its real path, or `file` itself when it
 *   cannot be resolved.
 */
async function realpathOrSelf(tools, file) {
  try {
    return await tools.realpath(file);
  } catch {
    return file;
  }
}

/**
 * Checks that the running copy is the global install, with local calls
 * only.
 * @param {object} tools - the collaborators.
 * @param {string} globalCopy - `<npm root -g>/arcanum-cli`.
 * @throws {TargetUnavailableError} (exit `4`) for a linked checkout or a
 *   copy other than the global one.
 */
async function checkGlobalCopy(tools, globalCopy) {
  const startDir = path.dirname(fileURLToPath(import.meta.url));
  const packageDir = tools.packageDir === undefined ? await findPackageDir(startDir, tools.readFile) : tools.packageDir;
  const running = packageDir === null ? startDir : await realpathOrSelf(tools, packageDir);
  const stat = await lstatOrNull(tools, globalCopy);

  if (stat !== null && stat.isSymbolicLink()) {
    throw new TargetUnavailableError(
      `running from a linked checkout (${await realpathOrSelf(tools, globalCopy)}); update it with git pull and a rebuild`
    );
  }

  if (packageDir === null || stat === null || !stat.isDirectory() || await realpathOrSelf(tools, globalCopy) !== running) {
    throw new TargetUnavailableError(`this ${PACKAGE_NAME} (${running}) is not the global install`, {
      hint: `run ${FALLBACK_INSTALL}, or update it through the project's package manager ` +
        '(a different Node/npm on PATH? e.g. nvm)'
    });
  }
}

/**
 * @param {object} tools - the collaborators.
 * @returns {Promise<string>} the configured registry, best effort.
 */
async function configuredRegistry(tools) {
  try {
    const { stdout } = await tools.runNpm(['config', 'get', 'registry'], { timeout: REGISTRY_TIMEOUT });

    return stdout.trim() || 'the configured registry';
  } catch {
    return 'the configured registry';
  }
}

/**
 * Resolves `latest`, bounded, and validates it.
 * @param {object} tools - the collaborators.
 * @returns {Promise<string>} the latest release's exact version.
 * @throws {NpmError} (exit `8`) on any lookup failure or an invalid version.
 */
async function latestVersion(tools) {
  let stdout;

  try {
    ({ stdout } = await tools.runNpm(
      ['view', `${PACKAGE_NAME}@latest`, 'version', '--json', '--fetch-retries=0', '--fetch-timeout=15000'],
      { timeout: VIEW_TIMEOUT }
    ));
  } catch (error) {
    throw await viewError(tools, error);
  }

  const raw = stdout.trim();
  let version;

  try {
    version = JSON.parse(raw);
  } catch {
    version = raw;
  }

  if (!isPlainSemver(version)) {
    throw new NpmError(`npm returned an invalid version '${typeof version === 'string' ? version : raw}'`);
  }

  return version;
}

/**
 * @param {object} tools - the collaborators.
 * @param {unknown} error - the `npm view` failure.
 * @returns {Promise<unknown>} the error to throw, worded for `npm view`.
 */
async function viewError(tools, error) {
  if (!(error instanceof NpmError)) {
    return error;
  }

  const details = { npmOutput: error.npmOutput, category: error.category, npmExit: error.npmExit };

  if (error.category === 'network' || error.category === 'timeout') {
    return new NpmError('could not reach the npm registry', {
      ...details, hint: 'check your network or npm proxy/registry config'
    });
  }

  if (error.category === 'not_found') {
    return new NpmError(`${PACKAGE_NAME} is not on the configured registry (${await configuredRegistry(tools)})`, details);
  }

  return error;
}

/**
 * Runs `npm i -g`, keeping the CLI alive on Ctrl-C (the signal reaches
 * npm too) so the interruption is reported.
 * @param {object} tools - the collaborators.
 * @param {string} version - the exact version to install.
 * @param {string} root - `npm root -g`.
 * @returns {Promise<{stdout: string, stderr: string}>} npm's output.
 * @throws {NpmError} (exit `8`) when the install fails.
 * @throws {InterruptedError} (exit `130`) on Ctrl-C.
 */
async function install(tools, version, root) {
  const ignoreSigint = () => {};

  tools.signals.on('SIGINT', ignoreSigint);

  try {
    return await tools.runNpm(['i', '-g', '--ignore-scripts', `${PACKAGE_NAME}@${version}`], {});
  } catch (error) {
    throw installError(error, root);
  } finally {
    tools.signals.removeListener('SIGINT', ignoreSigint);
  }
}

/**
 * @param {unknown} error - the `npm i -g` failure.
 * @param {string} root - `npm root -g`.
 * @returns {unknown} the error to throw, worded for `npm i -g`.
 */
function installError(error, root) {
  if (error instanceof InterruptedError) {
    return new InterruptedError('the install may be incomplete; run arcanum self-update again', {
      hint: `if arcanum no longer runs: ${FALLBACK_INSTALL}`
    });
  }

  if (!(error instanceof NpmError) || error.category === 'not_installed') {
    return error;
  }

  const details = { npmOutput: error.npmOutput, category: error.category, npmExit: error.npmExit };

  if (error.category === 'permission') {
    return new NpmError(`the npm global prefix (${path.dirname(path.dirname(root))}) is not writable`, {
      ...details,
      hint: 'fix its permissions or use a user-owned prefix (npm config set prefix ~/.npm-global); ' +
        'arcanum never retries with sudo'
    });
  }

  return new NpmError(`npm i -g failed (exit ${error.npmExit === null ? 'unknown' : error.npmExit})`, details);
}

/**
 * Reads the installed version, so the reported `to` is a fact.
 * @param {object} tools - the collaborators.
 * @param {string} globalCopy - `<npm root -g>/arcanum-cli`.
 * @param {string} version - the version just installed.
 * @throws {NpmError} (exit `8`) when the global copy is not at `version`.
 */
async function verifyInstall(tools, globalCopy, version) {
  let installed;

  try {
    installed = JSON.parse(await tools.readFile(path.join(globalCopy, 'package.json'), 'utf8')).version;
  } catch {
    installed = undefined;
  }

  if (installed !== version) {
    throw new NpmError(`npm i -g reported success but ${PACKAGE_NAME} is at ${installed === undefined ? 'an unreadable version' : installed}`);
  }
}

/**
 * @param {object} output - the command's output helpers.
 * @param {object} data - the `{status, from, to, latest}` result.
 * @returns {number} `EXIT_OK`.
 */
function report(output, data) {
  const human = {
    updated: `Updated ${PACKAGE_NAME} ${data.from} → ${data.to}`,
    up_to_date: `${PACKAGE_NAME} is up to date (${data.from})`,
    newer: `${PACKAGE_NAME} ${data.from} is newer than the latest release (${data.latest}); nothing to do`
  }[data.status];

  output.result(human, data);

  return EXIT_OK;
}

/**
 * `arcanum self-update [--json]`: updates the global arcanum-cli to the
 * exact `latest` version, refusing a linked checkout or a copy other
 * than the global one. `ARCANUM_SKIP_CLI` is ignored; there is no prompt.
 * @param {object} context - the parsed invocation (see `main.js`).
 * @returns {Promise<number>} the exit code.
 * @throws {CliError} a usage error (`2`), a refusal (`4`), an npm failure
 *   (`8`), an interruption (`130`), or Windows (`1`).
 */
export async function run(context) {
  const { positionals, values, io, env = {}, version: from, deps = {}, output, targeting = {} } = context;

  if (values.help) {
    io.stdout.write(selfUpdateUsage());

    return EXIT_OK;
  }

  const tools = collaborators(deps);

  if (tools.platform === 'win32') {
    throw new CliError('self-update is not supported on Windows', { hint: FALLBACK_INSTALL });
  }

  checkInvocation(positionals, targeting);

  const root = await npmRoot(tools);
  const globalCopy = path.join(root, PACKAGE_NAME);

  await checkGlobalCopy(tools, globalCopy);

  const latest = await latestVersion(tools);
  const comparison = compareVersions(from, latest);

  if (comparison === 0) {
    return report(output, { status: 'up_to_date', from, to: from, latest });
  }

  if (comparison > 0) {
    return report(output, { status: 'newer', from, to: from, latest });
  }

  output.note(`updating ${PACKAGE_NAME} ${from} → ${latest}...`);

  const npmOutput = await install(tools, latest, root);

  if (env.ARCANUM_DEBUG === '1') {
    io.stderr.write(`${npmOutput.stdout}${npmOutput.stderr}`);
  }

  await verifyInstall(tools, globalCopy, latest);

  return report(output, { status: 'updated', from, to: latest, latest });
}

export default { options, run };
