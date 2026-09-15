# Scripter Plan: Fix SC2004 in init-claude/scripts/lib/label_config.sh: unnecessary `$`/`{}` on arithmetic array index

## Implementation Steps

### Step 1 — Drop the redundant `$` on the array-index lvalue

In `init-claude/scripts/lib/label_config.sh`, change the array assignment at line 228 from:

```sh
        existing_pairs[$i]="${new_name}:${new_color}"
```

to:

```sh
        existing_pairs[i]="${new_name}:${new_color}"
```

`i` is already the loop variable from `for i in "${!existing_pairs[@]}"; do` a few lines above, and an array subscript in bash is already an arithmetic context, so the `$` is redundant on this lvalue. This is a pure syntax change — the assigned value and control flow are untouched. Do not touch the read at line 226 (`existing_name="${existing_pairs[$i]%%:*}"`); ShellCheck does not flag it (confirmed locally — `shellcheck` only reports `SC2004` at line 228, not 226), since SC2004 targets the redundant `$` on array-index lvalues, not on rvalue reads.

Verify with:
```sh
shellcheck init-claude/scripts/lib/label_config.sh
```
and confirm no `SC2004` finding remains for this file.

## Files to Change
- `init-claude/scripts/lib/label_config.sh` — remove the `$` from the array index on the lvalue at (currently) line 228.

## Notes
- No behavior change: this is a lint-only fix. `label_config.sh` has no dedicated spec suite in this repo (it's a bash lib, not `core/`), so verification is via `shellcheck` locally, matching how Codacy surfaced the finding.
