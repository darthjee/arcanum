import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

/** The real, shared `arcanum/_lib/engine_dispatch.sh`'s path. */
export const ENGINE_DISPATCH_SCRIPT = path.join(REPO_ROOT, 'arcanum', '_lib', 'engine_dispatch.sh');

/**
 * Build the throwaway wrapper (sources the real engine_dispatch.sh)
 * and throwaway shell-fixture (stands in for github.sh) used by
 * every engine_dispatch routing test case.
 * @param {string} dir - the directory to build the scripts in.
 * @returns {Promise<{wrapperPath: string, fixturePath: string}>} the
 *   two built scripts' paths.
 */
export async function buildDispatchFixtures(dir) {
  const wrapperPath = path.join(dir, 'dispatch-wrapper.sh');
  const fixturePath = path.join(dir, 'fixture-shell-impl.sh');

  // `dir` is always a trusted, test-controlled temporary directory
  // created by the spec (never user/external input), so the path
  // passed to `writeFile` here is not attacker-influenced — this is a
  // known false positive for Codacy's `detect-non-literal-fs-filename`
  // pattern (see issue #460).
  await writeFile(
    wrapperPath,
    [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      `source "${ENGINE_DISPATCH_SCRIPT}"`,
      'REPO_PATH="$1"',
      'COMMAND="$2"',
      'SHELL_SCRIPT="$3"',
      'shift 3',
      'engine_dispatch "$REPO_PATH" "$COMMAND" "$SHELL_SCRIPT" -- "$@"',
      ''
    ].join('\n')
  );
  // Same trusted-`dir` rationale as above — `fixturePath` is derived
  // from the same test-controlled temporary directory.
  await writeFile(fixturePath, ['#!/usr/bin/env bash', 'echo "SHELL: $*"', ''].join('\n'));

  return { wrapperPath, fixturePath };
}
