import { chmod, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createTempDir, removeTempDir } from './tempDir.js';

// A minimal `gh` CLI stand-in, controlled entirely via env vars, so
// parity specs that need to isolate `gh`-shelling code (both the shell
// script side and the native side's `resolve_pr_number.sh`/`GithubToken`
// calls) never touch the real network — per the repo-wide "no real
// network calls in specs" rule. Only the subcommands
// reply_comment_shell.sh / resolve_pr_number.sh / GithubToken.js /
// wait_ci_shell.sh actually issue are handled:
//   - `gh auth switch --user <x>` -> always succeeds.
//   - `gh auth token [--hostname <x>]` -> prints `$FAKE_GH_TOKEN`
//     (default `fake-gh-token`); fails when `$FAKE_GH_AUTH_TOKEN_FAIL`
//     is `1`, OR unconditionally when `createFakeGhBin`'s own
//     `authTokenAlwaysFails` option was set at build time (baked
//     directly into the script file, so it survives even an `env -i`
//     call that strips `FAKE_GH_AUTH_TOKEN_FAIL` itself — used to force
//     `GithubToken#get`'s own failure path, before it ever reaches a
//     real REST call, from a caller that can't rely on a runtime env
//     var surviving to the invocation under test — see
//     autoFixAllWaitCiParity_spec.js's engine_dispatch routing case).
//   - `gh pr view -R <ref> <branch> --json number -q .number` (also
//     matches `gh pr view <number> -R <ref> --json number ...`, in case
//     order ever changes) -> prints `$FAKE_GH_PR_NUMBER` when set;
//     otherwise fails (simulating "no pull request found for the
//     current branch").
//   - `gh pr view <number> -R <ref> --json headRefOid -q .headRefOid`
//     -> prints `$FAKE_GH_HEAD_SHA` (default `fake-head-sha`) when
//     `$FAKE_GH_PR_NUMBER` is set; otherwise fails, matching the
//     `number` case above.
//   - `gh pr view -R <ref> <branch|number> --json state -q .state` ->
//     prints `$FAKE_GH_PR_STATE` (default `OPEN`) — used by
//     `github.sh`'s `cmd_pr_state`.
//   - `gh pr view -R <ref> <branch|number> --json title -q .title` ->
//     prints `$FAKE_GH_PR_TITLE` (default `Fake PR title`) — used by
//     `github.sh`'s `cmd_pr_merge` cached-number/url branch.
//   - `gh pr view -R <ref> <branch> --json title,number,url` (no `-q`,
//     raw JSON on stdout) -> prints `{"title":..,"number":..,"url":..}`
//     built from `$FAKE_GH_PR_TITLE`/`$FAKE_GH_PR_NUMBER`/
//     `$FAKE_GH_PR_URL` (default derived from `$FAKE_GH_PR_NUMBER`) —
//     used by `github.sh`'s `cmd_pr_merge` uncached branch.
//   - `gh pr view -R <ref> <number> --json commits` (no `-q`) -> prints
//     `{"commits": $FAKE_GH_PR_COMMITS_JSON}` (default `[]`) — used by
//     `merge_body.sh`'s `merge_body_coauthors_list`.
//   - Every `gh pr view ...` invocation above fails (simulating "no pull
//     request found for the current branch") whenever `$FAKE_GH_PR_NUMBER`
//     is unset/empty.
//   - `gh pr merge <number> -R <ref> --squash --delete-branch --subject
//     <subject> [--body <body>]` -> succeeds (prints nothing) unless
//     `$FAKE_GH_PR_MERGE_FAIL` is `1` — used by `github.sh`'s
//     `cmd_pr_merge`.
//   - `gh pr comment <number> -R <ref> --body-file -` -> drains stdin;
//     fails when `$FAKE_GH_COMMENT_FAIL` is `1`, otherwise succeeds
//     printing nothing (matching this migration's "gh pr comment isn't
//     captured/echoed" contract — see AutoFixAllReplyComment.js).
//   - `gh api repos/<owner>/<repo>/commits/<sha>/check-runs?per_page=100`
//     -> prints `{"check_runs": $FAKE_GH_CHECK_RUNS_JSON}` (default
//     `[]`) — used by wait_ci_shell.sh.
//   - `gh api user -q '.login'` -> prints `$FAKE_GH_USER_LOGIN` (default
//     `fake-merger`); fails when `$FAKE_GH_USER_FAIL` is `1` — used by
//     `merge_body.sh`'s `merge_body_coauthors_list`.
//   - `gh issue view <id> -R <ref> --json labels -q '.labels[].name'`
//     -> prints `$FAKE_GH_ISSUE_LABELS` (one label name per line —
//     embedded newlines in the env var itself, e.g. `'Ready for
//     Work\nCreated'`), or nothing when unset; fails when
//     `$FAKE_GH_ISSUE_VIEW_FAIL` is `1` — used by
//     tag_mutate.sh's `tag_mutate_add_label`/`tag_mutate_remove_label`
//     (queue_save_shell.sh's/queue_push_shell.sh's `_mark_enqueued`, and
//     `github.sh`'s `cmd_has_shipit_label`/`cmd_add_tag`/`cmd_remove_tag`).
//   - `gh issue edit <id> -R <ref> --add-label <label>` /
//     `gh issue edit <id> -R <ref> --remove-label <label>` -> succeeds
//     (prints nothing) unless `$FAKE_GH_ISSUE_EDIT_FAIL` is `1`.
/**
 * @param {boolean} authTokenAlwaysFails - whether `gh auth token` should
 *   unconditionally fail, baked in as a literal (not read from the
 *   runtime environment) at script-generation time.
 * @returns {string} the fake `gh` script's full source.
 */
function buildGhScript(authTokenAlwaysFails) {
  return `#!/usr/bin/env bash
set -euo pipefail

AUTH_TOKEN_ALWAYS_FAILS=${authTokenAlwaysFails ? '1' : '0'}

_json_flag_value() {
  local prev=""
  for arg in "$@"; do
    if [[ "$prev" == "--json" ]]; then
      echo "$arg"
      return 0
    fi
    prev="$arg"
  done
}

case "\${1:-}" in
  auth)
    case "\${2:-}" in
      switch)
        exit 0
        ;;
      token)
        if [[ "$AUTH_TOKEN_ALWAYS_FAILS" == "1" || "\${FAKE_GH_AUTH_TOKEN_FAIL:-}" == "1" ]]; then
          echo "fake gh: auth token failed" >&2
          exit 1
        fi
        echo "\${FAKE_GH_TOKEN:-fake-gh-token}"
        exit 0
        ;;
    esac
    ;;
  pr)
    case "\${2:-}" in
      view)
        if [[ -z "\${FAKE_GH_PR_NUMBER:-}" ]]; then
          echo "no pull requests found for branch" >&2
          exit 1
        fi
        json_field="$(_json_flag_value "$@")"
        case "$json_field" in
          headRefOid)
            echo "\${FAKE_GH_HEAD_SHA:-fake-head-sha}"
            ;;
          number)
            echo "$FAKE_GH_PR_NUMBER"
            ;;
          state)
            echo "\${FAKE_GH_PR_STATE:-OPEN}"
            ;;
          title)
            echo "\${FAKE_GH_PR_TITLE:-Fake PR title}"
            ;;
          title,number,url)
            printf '{"title":"%s","number":%s,"url":"%s"}\\n' \\
              "\${FAKE_GH_PR_TITLE:-Fake PR title}" \\
              "$FAKE_GH_PR_NUMBER" \\
              "\${FAKE_GH_PR_URL:-https://github.com/example/repo/pull/$FAKE_GH_PR_NUMBER}"
            ;;
          commits)
            echo "{\\"commits\\": \${FAKE_GH_PR_COMMITS_JSON:-[]}}"
            ;;
          *)
            echo "fake gh: unrecognized --json field: $json_field" >&2
            exit 1
            ;;
        esac
        exit 0
        ;;
      merge)
        if [[ "\${FAKE_GH_PR_MERGE_FAIL:-}" == "1" ]]; then
          echo "fake gh: merge failed" >&2
          exit 1
        fi
        exit 0
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
  api)
    case "\${2:-}" in
      repos/*/commits/*/check-runs*)
        echo "{\\"check_runs\\": \${FAKE_GH_CHECK_RUNS_JSON:-[]}}"
        exit 0
        ;;
      user)
        if [[ "\${FAKE_GH_USER_FAIL:-}" == "1" ]]; then
          echo "fake gh: api user failed" >&2
          exit 1
        fi
        echo "\${FAKE_GH_USER_LOGIN:-fake-merger}"
        exit 0
        ;;
    esac
    ;;
  issue)
    case "\${2:-}" in
      view)
        if [[ "\${FAKE_GH_ISSUE_VIEW_FAIL:-}" == "1" ]]; then
          echo "fake gh: issue view failed" >&2
          exit 1
        fi
        if [[ -n "\${FAKE_GH_ISSUE_LABELS:-}" ]]; then
          printf '%s\\n' "$FAKE_GH_ISSUE_LABELS"
        fi
        exit 0
        ;;
      edit)
        if [[ "\${FAKE_GH_ISSUE_EDIT_FAIL:-}" == "1" ]]; then
          echo "fake gh: issue edit failed" >&2
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
}

/**
 * Build a throwaway directory containing an executable `gh` stand-in
 * (see this file's header comment for the subcommands it handles),
 * meant to be prepended to `PATH` for the duration of a single spec.
 * @param {object} [opts] - options.
 * @param {boolean} [opts.authTokenAlwaysFails] - when `true`, `gh auth
 *   token` unconditionally fails, regardless of `FAKE_GH_AUTH_TOKEN_FAIL`
 *   — see this file's header comment.
 * @returns {Promise<{binDir: string, cleanup: Function}>} the built
 *   fake `gh`'s directory and a cleanup callback.
 */
export async function createFakeGhBin({ authTokenAlwaysFails = false } = {}) {
  const binDir = await createTempDir('arcanum-core-fake-gh-');
  const ghPath = path.join(binDir, 'gh');

  await writeFile(ghPath, buildGhScript(authTokenAlwaysFails));
  await chmod(ghPath, 0o755);

  return { binDir, cleanup: () => removeTempDir(binDir) };
}
