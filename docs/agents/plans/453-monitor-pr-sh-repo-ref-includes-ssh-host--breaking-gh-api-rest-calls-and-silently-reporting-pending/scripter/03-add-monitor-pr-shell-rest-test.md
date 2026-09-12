# Add REST-path regression test for monitor_pr_shell.sh

There's no existing test file for `monitor_pr_shell.sh`, and no existing pattern in this repo for stubbing the `gh` CLI in a shell test. Add one: `auto-monitor-pr/scripts/test_monitor_pr_shell.sh`, following the standalone-script shape of `arcanum/_lib/test_origin_resolution.sh` (`set -uo pipefail`, a `fail()` helper, a `trap cleanup EXIT` for temp dirs, `echo "OK: ..."` per assertion, `echo "PASS: ..."` at the end, exit 0 on success).

## Fixture setup

1. Create a throwaway git repo (`mktemp -d`, `git init -q`) with an SSH-proxy-style origin, matching this issue's exact reproduction shape: `git remote add origin "ssh://git@ssh.github.com:443/darthjee/arcanum.git"`.
2. Put a fake `gh` executable earlier on `PATH` than the real one for the duration of the test (e.g. `PATH="$FAKE_BIN_DIR:$PATH"`), so `monitor_pr_shell.sh`'s `gh ...` calls hit the fake instead of a real network call. The fake should:
   - Log every invocation it receives (the full argument list) to a file the test can inspect afterward, so the test can assert on exactly what path string the script passed.
   - Recognize `gh pr view <n> -R <ref> --json state,comments,reviews` and print a canned JSON object with `state: "OPEN"`, `comments: []`, `reviews: []` — enough for the script to fall through to the REST call without finding a terminal state or approval.
   - Recognize `gh api repos/*/pulls/*/comments` and print `[]` (no inline review comments) — this is the call this issue's fix targets.
   - Anything else the script might call in this path (e.g. `gh auth switch`) doesn't need special handling here: with no `user.ghuser` git config set in the fixture repo, `_ensure_gh_user`/`get_gh_user` short-circuit before ever invoking `gh auth switch`, so the fake never needs to answer it.
3. Run `auto-monitor-pr/scripts/monitor_pr_shell.sh <fixture_repo> --pr-number 452` with that `PATH` override (and `cd`'d appropriately, or via the script's own `<repo_path>` argument — it calls `repo_path_enter` internally).

## Assertions

- The script's stdout is exactly `pending` and it exits 0 — the legitimate "nothing new to report" outcome (not a crash), confirming the script actually ran to completion past the REST call rather than erroring out earlier.
- The logged fake-`gh` invocations show the `gh api repos/.../pulls/.../comments` call was made with the **bare** `darthjee/arcanum` form (e.g. `repos/darthjee/arcanum/pulls/452/comments`), not the domain-prefixed `ssh.github.com/darthjee/arcanum` form — this is the concrete regression check for this issue. Before the fix in step 1, this call would instead 404 (or, in this fake-`gh` setup, simply be logged with the wrong domain-prefixed path) and the script would return `pending` via the earlier failure branch instead of ever calling the fake `gh api` with a well-formed path — so also assert the fake `gh api .../comments` invocation was actually reached/logged at all, not just that it has the right shape.

Clean up the fixture repo and fake-`gh` directory via the same `trap cleanup EXIT` pattern `test_origin_resolution.sh` uses.

## Files to Change

- `auto-monitor-pr/scripts/test_monitor_pr_shell.sh` (new file) — standalone regression test with a fake `gh` stub, asserting `monitor_pr_shell.sh`'s REST call uses the bare `owner/repo` form under an SSH-proxy-style origin and completes successfully instead of silently failing into `pending` via the wrong path.
