// Builds arcanum-cli's single-file bundle, dist/arcanum.mjs, with esbuild
// (see docs/agents/specs/arcanum-cli/shared-config-logic.md#bundle-at-build-time-with-esbuild
// and docs/agents/specs/arcanum-cli/packaging-and-release.md#build-output).
//
// Besides bundling, it:
// - injects the CLI version and the per-scope migration-version list
//   through `define`;
// - fails when any bundled input lies outside cli/lib/** and the shared
//   config surface declared in core/eslint.config.mjs.
//
// The helpers are exported for the specs; the build only runs when this
// file is invoked directly (`node scripts/build.mjs`).

import { build } from 'esbuild';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The cli/ directory. */
export const CLI_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The repository root, cli/'s parent. */
export const REPO_ROOT = path.resolve(CLI_DIR, '..');

/** The migration scopes an entry's `applies_to` may name. */
export const SCOPES = ['repo', 'local', 'global'];

const SEMVER_DIR = /^\d+\.\d+\.\d+$/;
const KEYS_JSON = 'core/lib/utils/config/keys.json';
const STUB_NAMESPACE = 'arcanum-bare-stub';
// esbuild lists an object/array `define` value as a virtual input.
const DEFINE_INPUT = /^<define:[A-Za-z0-9_$.]+>$/;

/**
 * @param {string} version - an `X.Y.Z` version.
 * @returns {number[]} its numeric parts.
 */
function semverParts(version) {
  return version.split('.').slice(0, 3).map((part) => parseInt(part, 10) || 0);
}

/**
 * Compares two `X.Y.Z` versions numerically (`0.9.3` < `0.13.0`).
 * @param {string} a - one version.
 * @param {string} b - another version.
 * @returns {number} negative, zero or positive, as for `Array#sort`.
 */
export function compareSemver(a, b) {
  const left = semverParts(a);
  const right = semverParts(b);

  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) {
      return left[index] - right[index];
    }
  }

  return 0;
}

/**
 * Derives esbuild's `target` from an `engines.node` range.
 * @param {string} enginesNode - e.g. `>=22.13.0`.
 * @returns {string} e.g. `node22.13` (a zero patch is dropped).
 * @throws {Error} unless the range is a plain `>=X.Y.Z` floor.
 */
export function nodeTarget(enginesNode) {
  const match = /^>=\s*(\d+)\.(\d+)\.(\d+)$/.exec(String(enginesNode).trim());

  if (!match) {
    throw new Error(`engines.node must be a plain ">=X.Y.Z" floor, got ${JSON.stringify(enginesNode)}`);
  }

  const [, major, minor, patch] = match;

  return patch === '0' ? `node${major}.${minor}` : `node${major}.${minor}.${patch}`;
}

/**
 * Reads the shared-surface list from core's ESLint config, without
 * needing core/node_modules: the config is bundled in memory with every
 * bare specifier stubbed, then imported through a `data:` URL.
 * @param {string} [repoRoot] - the repository root.
 * @returns {Promise<string[]>} repo-relative paths of the allowed core/
 *   inputs: the surface block's `files`, plus `keys.json`.
 * @throws {Error} unless exactly one block's `no-restricted-syntax`
 *   targets `ImportExpression`.
 */
export async function sharedSurface(repoRoot = REPO_ROOT) {
  const configFile = path.join(repoRoot, 'core', 'eslint.config.mjs');
  const result = await build({
    entryPoints: [configFile],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    logLevel: 'silent',
    plugins: [bareSpecifierStubPlugin()]
  });
  const code = result.outputFiles[0].text;
  const module = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
  const config = module.default;
  const blocks = (Array.isArray(config) ? config : []).filter(targetsImportExpression);

  if (blocks.length !== 1) {
    throw new Error(
      `core/eslint.config.mjs must have exactly one shared-surface block (no-restricted-syntax on ImportExpression), found ${blocks.length}`
    );
  }

  const { files } = blocks[0];

  if (!Array.isArray(files) || files.length === 0 || !files.every((file) => typeof file === 'string')) {
    throw new Error('core/eslint.config.mjs: the shared-surface block has no files list');
  }

  return [...files.map((file) => `core/${file}`), KEYS_JSON];
}

/**
 * @returns {object} an esbuild plugin that resolves every bare
 *   (package) specifier to `export default { configs: {} }`.
 */
function bareSpecifierStubPlugin() {
  return {
    name: 'arcanum-bare-specifier-stub',
    setup(pluginBuild) {
      pluginBuild.onResolve({ filter: /^[^./]/ }, (args) => {
        if (args.path.startsWith('node:') || path.isAbsolute(args.path)) {
          return undefined;
        }

        return { path: args.path, namespace: STUB_NAMESPACE };
      });
      pluginBuild.onLoad({ filter: /.*/, namespace: STUB_NAMESPACE }, () => ({
        contents: 'export default { configs: {} };',
        loader: 'js'
      }));
    }
  };
}

/**
 * @param {unknown} block - one flat-config block.
 * @returns {boolean} whether its `no-restricted-syntax` rule targets `ImportExpression`.
 */
function targetsImportExpression(block) {
  const rule = block && block.rules ? block.rules['no-restricted-syntax'] : undefined;

  if (!Array.isArray(rule)) {
    return false;
  }

  return rule.slice(1).some((option) => (
    option === 'ImportExpression' || (option && option.selector === 'ImportExpression')
  ));
}

/**
 * Fails when any bundled input lies outside `cli/lib/**` and `allowed`.
 * esbuild's virtual `<define:…>` inputs are not files and are ignored.
 * Only asserts "bundled inputs ⊆ allowed"; an allowed file the CLI does
 * not use yet is fine.
 * @param {{inputs: object}} metafile - esbuild's metafile.
 * @param {string[]} allowed - repo-relative allowed core/ inputs.
 * @param {object} [dirs] - where the metafile's paths are relative to.
 * @param {string} [dirs.workingDir] - esbuild's working directory.
 * @param {string} [dirs.repoRoot] - the repository root.
 * @returns {string[]} the repo-relative bundled inputs, sorted.
 * @throws {Error} listing every input outside the allowed set.
 */
export function checkInputs(metafile, allowed, { workingDir = CLI_DIR, repoRoot = REPO_ROOT } = {}) {
  const allowedSet = new Set(allowed);
  const inputs = Object.keys(metafile.inputs).filter((input) => !DEFINE_INPUT.test(input)).map((input) => (
    path.relative(repoRoot, path.resolve(workingDir, input)).split(path.sep).join('/')
  )).sort();
  const outside = inputs.filter((input) => !input.startsWith('cli/lib/') && !allowedSet.has(input));

  if (outside.length > 0) {
    throw new Error(
      `bundled inputs outside cli/lib/** and the core/lib shared surface: ${outside.join(', ')}`
    );
  }

  return inputs;
}

/**
 * Builds the per-scope migration-version list from
 * `<reposDir>/<X.Y.Z>/migrations.json` (see
 * docs/agents/specs/arcanum-cli/packaging-and-release.md#embedded-migration-version-list).
 * Non-`X.Y.Z` directories (such as `next/`) and directories without a
 * `migrations.json` are skipped; versions above `cliVersion` are dropped.
 * @param {string} reposDir - e.g. `arcanum/migrations/repos`.
 * @param {string} cliVersion - the CLI's own version.
 * @returns {Promise<{repo: string[], local: string[], global: string[]}>}
 *   each scope's versions, sorted by semver.
 * @throws {Error} on a file that is not a JSON array, or an entry whose
 *   `applies_to` is missing or not `repo`, `local` or `global`.
 */
export async function migrationVersions(reposDir, cliVersion) {
  const scopes = { repo: new Set(), local: new Set(), global: new Set() };
  const dirents = await readdir(reposDir, { withFileTypes: true });
  const versions = dirents
    .filter((dirent) => dirent.isDirectory() && SEMVER_DIR.test(dirent.name))
    .map((dirent) => dirent.name);

  for (const version of versions) {
    const file = path.join(reposDir, version, 'migrations.json');
    const entries = await readMigrations(file);

    if (entries === undefined || compareSemver(version, cliVersion) > 0) {
      continue;
    }

    for (const entry of entries) {
      scopes[entry.applies_to].add(version);
    }
  }

  return Object.fromEntries(SCOPES.map((scope) => [scope, [...scopes[scope]].sort(compareSemver)]));
}

/**
 * @param {string} file - a `migrations.json` path.
 * @returns {Promise<object[]|undefined>} its validated entries, or
 *   `undefined` when the file does not exist.
 * @throws {Error} on invalid JSON, a non-array, or a bad `applies_to`.
 */
async function readMigrations(file) {
  let text;

  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return undefined;
    }

    throw error;
  }

  let entries;

  try {
    entries = JSON.parse(text);
  } catch (error) {
    throw new Error(`${file}: invalid JSON (${error.message})`, { cause: error });
  }

  if (!Array.isArray(entries)) {
    throw new Error(`${file}: expected a JSON array of migrations`);
  }

  entries.forEach((entry, index) => {
    const appliesTo = entry && typeof entry === 'object' ? entry.applies_to : undefined;

    if (!SCOPES.includes(appliesTo)) {
      throw new Error(
        `${file}: entry ${index} has a missing or invalid applies_to ${JSON.stringify(appliesTo)} ` +
        `(expected one of ${SCOPES.join(', ')})`
      );
    }
  });

  return entries;
}

/**
 * Builds `dist/arcanum.mjs`. The bundle is checked before it is written,
 * so a failed surface check leaves no output behind.
 * @param {object} [options] - overridable locations, for the specs.
 * @param {string} [options.cliDir] - the cli/ directory.
 * @param {string} [options.repoRoot] - the repository root.
 * @param {string} [options.outfile] - the bundle path.
 * @returns {Promise<{outfile: string, inputs: string[], version: string}>}
 *   what was built.
 */
export async function buildBundle({
  cliDir = CLI_DIR,
  repoRoot = REPO_ROOT,
  outfile = path.join(cliDir, 'dist', 'arcanum.mjs')
} = {}) {
  const manifest = JSON.parse(await readFile(path.join(cliDir, 'package.json'), 'utf8'));
  const { version } = manifest;
  const versions = await migrationVersions(path.join(repoRoot, 'arcanum', 'migrations', 'repos'), version);
  const allowed = await sharedSurface(repoRoot);
  const result = await build({
    absWorkingDir: cliDir,
    entryPoints: ['lib/main.js'],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: nodeTarget(manifest.engines && manifest.engines.node),
    minify: false,
    sourcemap: false,
    metafile: true,
    write: false,
    logLevel: 'silent',
    define: {
      __ARCANUM_CLI_VERSION__: JSON.stringify(version),
      __ARCANUM_MIGRATION_VERSIONS__: JSON.stringify(versions)
    }
  });
  const inputs = checkInputs(result.metafile, allowed, { workingDir: cliDir, repoRoot });

  await mkdir(path.dirname(outfile), { recursive: true });

  for (const output of result.outputFiles) {
    await writeFile(output.path, output.contents);
  }

  return { outfile, inputs, version };
}

/**
 * @returns {boolean} whether this file is the process's entry script.
 */
function invokedDirectly() {
  return Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (invokedDirectly()) {
  buildBundle()
    .then(({ outfile, inputs, version }) => {
      process.stdout.write(
        `arcanum-cli ${version}: built ${path.relative(CLI_DIR, outfile)} from ${inputs.length} inputs\n`
      );
    })
    .catch((error) => {
      process.stderr.write(`build failed: ${error.message}\n`);
      process.exitCode = 1;
    });
}
