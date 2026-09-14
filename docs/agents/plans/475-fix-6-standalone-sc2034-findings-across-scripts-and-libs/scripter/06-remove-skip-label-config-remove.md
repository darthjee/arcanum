# Remove unused skip local in label_config.sh

Inside `label_config_remove`, `local pair existing_name skip found` (line 185) declares `skip`, but only `found` is ever assigned or read in the loop below (`found=0` / `found=1` / `[[ "$found" -eq 1 ]]`). `skip` is untouched anywhere else in the function — a leftover from an earlier version. Drop it from the `local` declaration.

## Files to Change

- `init-claude/scripts/lib/label_config.sh` — change `local pair existing_name skip found` (line 185) to `local pair existing_name found`, leaving the rest of `label_config_remove` untouched.
