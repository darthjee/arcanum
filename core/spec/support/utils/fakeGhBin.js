import { chmod, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createTempDir, removeTempDir } from './tempDir.js';

// A minimal `gh` CLI stand-in, controlled entirely via env vars, so
// parity specs that need to isolate `gh`-shelling code (both the shell
// script side and the native side's `resolve_pr_number.sh`/`GithubToken`
// calls) never touch the real network — per the repo-wide "no real
// network calls in specs" rule. Only the subcommands
// reply_comment_shell.sh / resolve_pr_number.sh / GithubToken.js
// actually issue are handled:
//   - `gh auth switch --user <x>` -> always succeeds.
//   - `gh auth token [--hostname <x>]` -> prints `$FAKE_GH_TOKEN`
//     (default `fake-gh-token`).
//   - `gh pr view -R <ref> <branch> --json number -q .number` -> prints
//     `$FAKE_GH_PR_NUMBER` when set; otherwise fails (simulating "no
//     pull request found for the current branch").
//   - `gh pr comment <number> -R <ref> --body-file -` -> drains stdin;
//     fails when `$FAKE_GH_COMMENT_FAIL` is `1`, otherwise succeeds
//     printing nothing (matching this migration's "gh pr comment isn't
//     captured/echoed" contract — see AutoFixAllReplyComment.js).
const GH_SCRIPT = `#!/usr/bin/env bash
set -euo pipefail

case "\${1:-}" in
  auth)
    case "\${2:-}" in
      switch)
        exit 0
        ;;
      token)
        echo "\${FAKE_GH_TOKEN:-fake-gh-token}"
        exit 0
        ;;
    esac
    ;;
  pr)
    case "\${2:-}" in
      view)
        if [[ -n "\${FAKE_GH_PR_NUMBER:-}" ]]; then
          echo "$FAKE_GH_PR_NUMBER"
          exit 0
        fi
        echo "no pull requests found for branch" >&2
        exit 1
        ;;
      comment)
        cat >/dev/null
        if [[ "\${FAKE_GH_COMMENT_FAIL:-}" == "1" ]]; then
          echo "HTTP 422: Validation Failed" >&2
          exit 1
        fi
        exit 0
        ;;
    esac
    ;;
esac

echo "fake gh: unrecognized invocation: $*" >&2
exit 1
`;

/**
 * Build a throwaway directory containing an executable `gh` stand-in
 * (see this file's header comment for the subcommands it handles),
 * meant to be prepended to `PATH` for the duration of a single spec.
 * @returns {Promise<{binDir: string, cleanup: Function}>} the built
 *   fake `gh`'s directory and a cleanup callback.
 */
export async function createFakeGhBin() {
  const binDir = await createTempDir('arcanum-core-fake-gh-');
  const ghPath = path.join(binDir, 'gh');

  await writeFile(ghPath, GH_SCRIPT);
  await chmod(ghPath, 0o755);

  return { binDir, cleanup: () => removeTempDir(binDir) };
}
