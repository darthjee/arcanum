import path from 'node:path';
import { REPO_ROOT, runCommand } from '../support/utils/runCommand.js';

// Packaging spec for the `arcanum-next-step/` mod (issue #797): runs the
// real `scripts/build_release_zip.sh --list` against this checkout and
// asserts the mod's committed files make it into the release MANIFEST,
// while its engine-generated `.claude-plugin/types/` folder never does.
// It also asserts the `cli/` source tree (issue #779) is never shipped.
// `--list` only prints the would-be MANIFEST — no zip, no output dir.

const BUILD_SCRIPT = path.join(REPO_ROOT, 'scripts', 'build_release_zip.sh');
const MOD_FILES = [
  'arcanum-next-step/.claude-plugin/plugin.json',
  'arcanum-next-step/hooks/hooks.json',
  'arcanum-next-step/hooks/register.ts',
  'arcanum-next-step/types/index.d.ts',
  'arcanum-next-step/README.md'
];
const GENERATED_TYPES_PREFIX = 'arcanum-next-step/.claude-plugin/types/';
const CLI_PREFIX = 'cli/';

/**
 * The environment `build_release_zip.sh --list` runs with: the caller's
 * own, plus a `safe.directory` entry for the repo root so `git ls-files`
 * still works when the checkout is bind-mounted under another owner
 * (e.g. inside the `core` test container).
 * @returns {object} the environment.
 */
function listEnv() {
  return {
    ...process.env,
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'safe.directory',
    GIT_CONFIG_VALUE_0: REPO_ROOT
  };
}

describe('scripts/build_release_zip.sh --list', () => {
  let result;
  let paths;

  beforeAll(async () => {
    result = await runCommand([BUILD_SCRIPT, '--list'], REPO_ROOT, listEnv());
    paths = result.stdout.split('\n').filter((line) => line !== '');
  });

  it('exits 0', () => {
    expect(result.code).withContext(result.stderr).toEqual(0);
  });

  it('prints only repo-relative paths, not the zip path', () => {
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.filter((line) => line.endsWith('.zip') || path.isAbsolute(line))).toEqual([]);
  });

  MOD_FILES.forEach((file) => {
    it(`lists ${file}`, () => {
      expect(paths).toContain(file);
    });
  });

  it('lists nothing under the engine-generated .claude-plugin/types/ folder', () => {
    expect(paths.filter((line) => line.startsWith(GENERATED_TYPES_PREFIX))).toEqual([]);
  });

  it('lists nothing under cli/', () => {
    expect(paths.filter((line) => line.startsWith(CLI_PREFIX))).toEqual([]);
  });
});
