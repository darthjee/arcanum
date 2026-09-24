import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NATIVE_BIN, REPO_ROOT, runCommand } from './runCommand.js';

/**
 * Run one `init-claude` entrypoint on both sides: the shell
 * implementation (`init-claude/scripts/<script>_shell.sh`, run directly —
 * never through the engine_dispatch shim, so the test isn't circular)
 * with `cwd` set to `shellDir`, and `core/bin/arcanum <command>
 * <nativeDir> <args...>` with `cwd` set to `nativeCwd` (a directory other
 * than `nativeDir`, proving native resolves paths against `repoPath`
 * rather than `process.cwd()`).
 * @param {object} opts - the invocation options.
 * @param {string} opts.script - the shell script's base name (e.g.
 *   `setup_templates`).
 * @param {string} opts.command - the `core/bin/arcanum` command name.
 * @param {string[]} [opts.args] - the entrypoint's own arguments.
 * @param {string} opts.shellDir - the shell side's project dir.
 * @param {string} opts.nativeDir - the native side's project dir.
 * @param {string} opts.nativeCwd - the native process's cwd.
 * @returns {Promise<{shell: object, native: object}>} both sides'
 *   `{ stdout, stderr, code }` results.
 */
export async function runInitClaudeBoth({ script, command, args = [], shellDir, nativeDir, nativeCwd }) {
  const shell = await runCommand(
    [path.join(REPO_ROOT, 'init-claude', 'scripts', `${script}_shell.sh`), ...args],
    shellDir
  );
  const native = await runCommand([process.execPath, NATIVE_BIN, command, nativeDir, ...args], nativeCwd);

  return { shell, native };
}

/**
 * Snapshot every entry under `dir` (relative path → file contents, or
 * `'<dir>'` for directories) so both sides' resulting trees can be
 * compared byte-for-byte.
 * @param {string} dir - the directory to snapshot.
 * @returns {Promise<Object<string, string>>} the snapshot.
 */
export async function snapshotTree(dir) {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  const snapshot = {};

  for (const entry of entries) {
    const full = path.join(entry.parentPath, entry.name);
    const relative = path.relative(dir, full);

    snapshot[relative] = entry.isDirectory() ? '<dir>' : await readFile(full, 'utf8');
  }

  return snapshot;
}

/**
 * Write the same `files` (relative path → contents) into every one of
 * `dirs`, creating parent directories as needed.
 * @param {string[]} dirs - the project dirs to seed.
 * @param {Object<string, string>} files - the files to write.
 * @returns {Promise<void>} resolves once written.
 */
export async function seedFiles(dirs, files) {
  for (const dir of dirs) {
    for (const [relative, contents] of Object.entries(files)) {
      const full = path.join(dir, relative);

      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, contents);
    }
  }
}

/**
 * Create the three sibling directories every `init-claude` parity spec
 * needs under `baseDir`: `shell/` and `native/` project dirs, plus a
 * separate `cwd/` for the native process.
 * @param {string} baseDir - a fresh temp dir.
 * @returns {Promise<{shellDir: string, nativeDir: string, nativeCwd: string}>}
 *   the created directories.
 */
export async function createParityDirs(baseDir) {
  const dirs = {
    shellDir: path.join(baseDir, 'shell'),
    nativeDir: path.join(baseDir, 'native'),
    nativeCwd: path.join(baseDir, 'cwd')
  };

  await Promise.all(Object.values(dirs).map((dir) => mkdir(dir)));

  return dirs;
}

/**
 * Assert byte-identical stdout, stderr and exit code on both sides, and
 * byte-identical resulting project trees.
 * @param {{shell: object, native: object}} results - both sides'
 *   results, from `runInitClaudeBoth`.
 * @param {{shellDir: string, nativeDir: string}} dirs - both sides'
 *   project dirs.
 * @returns {Promise<Object<string, string>>} the (shared) resulting tree
 *   snapshot, for further assertions.
 */
export async function expectInitClaudeParity({ shell, native }, { shellDir, nativeDir }) {
  expect(native.stdout).toEqual(shell.stdout);
  expect(native.stderr).toEqual(shell.stderr);
  expect(native.code).toEqual(shell.code);

  const shellTree = await snapshotTree(shellDir);

  expect(await snapshotTree(nativeDir)).toEqual(shellTree);

  return shellTree;
}
