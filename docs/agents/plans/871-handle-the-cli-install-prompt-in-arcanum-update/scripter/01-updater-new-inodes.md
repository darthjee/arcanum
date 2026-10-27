# Replace files instead of overwriting them in updater.sh

`updater.sh` installs the release with `cp -R "${RELEASE_ROOT}/." "${TARGET}/"`. `cp` opens existing destination files with truncate and rewrites them in place (same inode). A bash script that is still running from the install (`arcanum-update/scripts/run_update.sh` always, `run_update_apply_shell.sh` in shell mode) reads the rest of its own source from the file at its old byte offset after the child returns, so it then reads the *new* content from the wrong place. Reproduced: a script whose `case` gains a branch while it runs dies with `unexpected EOF while looking for matching` and exit `2` after a successful copy. Removing the destination file first (new inode on copy) fixes it: the running bash keeps its open handle on the old, unlinked inode.

Change the copy step so every file that the release tree provides and that already exists in `TARGET` (regular file or symlink) is removed just before the copy, then keep `cp -R "${RELEASE_ROOT}/." "${TARGET}/"`. For example:

```bash
# Unlink files the release replaces before copying, so scripts still
# running from the install (e.g. run_update.sh) keep reading their old
# inode instead of the new content at a stale offset.
while IFS= read -r -d '' rel_path; do
  rel_path="${rel_path#./}"
  if [[ -f "${TARGET}/${rel_path}" || -L "${TARGET}/${rel_path}" ]]; then
    rm -f "${TARGET}/${rel_path}"
  fi
done < <(cd "$RELEASE_ROOT" && find . \( -type f -o -type l \) -print0)
```

A directory in `TARGET` that the release has as a file (or vice versa) is out of scope (same behavior as today). The window in which a file is missing is short and retry-safe (`arcanum.json` is still written last). Explain the reason in a short comment, matching the style of the surrounding section comments.

Add a case to `arcanum/update/test_updater.sh`: the fake install has a script (e.g. `<target>/arcanum-update/scripts/run_update.sh` or any `running.sh`) that is **currently running** the update — have the case start that script from the target, let it run `updater.sh` (or simulate with a script that runs the copy through `updater.sh` as a child), and give the release a longer version of the same script with an extra `case` branch and trailing command. Assert the running script exits `0`, did not execute the trailing command of the new file, and that the target file now has the new content. Keep the case consistent with the existing `new_case` / `run` / `assert_*` helpers.

## Files to Change
- `arcanum/update/updater.sh` — unlink files replaced by the release before `cp -R`; header comment mention.
- `arcanum/update/test_updater.sh` — new case for a script that is running while it is replaced.
