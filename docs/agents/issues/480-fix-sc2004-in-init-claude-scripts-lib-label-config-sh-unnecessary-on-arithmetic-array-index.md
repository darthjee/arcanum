# Issue: Fix SC2004 in init-claude/scripts/lib/label_config.sh: unnecessary `$`/`{}` on arithmetic array index

## Description
Codacy's ShellCheck flags `init-claude/scripts/lib/label_config.sh:228` for SC2004 — `$`/`${}` is unnecessary on arithmetic variables:

```sh
        existing_pairs[$i]="${new_name}:${new_color}"
```

`$i` here is the loop variable from `for i in "${!existing_pairs[@]}"; do` — it's used as an array *index*, which is already an arithmetic context in bash, so the `$` is redundant (and, per ShellCheck's rationale, mixing `$i` and bare `i` in index positions is a common source of confusion about whether the index is arithmetic or string-keyed).

## Problem
This is the only `ErrorProne`-category finding in the current Warning-level Codacy backlog (the rest are `BestPractice`), which makes it the single highest-signal, lowest-effort fix available: a one-character-class change with no behavioral risk.

## Expected Behavior
- `existing_pairs[$i]=...` becomes `existing_pairs[i]=...` at `init-claude/scripts/lib/label_config.sh:228`.
- No change in behavior — `label_config.sh`'s associative/indexed array update logic still works identically.
- Re-running ShellCheck/Codacy on this file shows zero SC2004 findings.

## Solution
Change line 228 in `init-claude/scripts/lib/label_config.sh` from:
```sh
        existing_pairs[$i]="${new_name}:${new_color}"
```
to:
```sh
        existing_pairs[i]="${new_name}:${new_color}"
```

Work should be delegated to the `scripter` agent, since the file is under `init-claude/scripts/`.

## Benefits
- Clears the one `ErrorProne`-category Codacy Warning currently open in the repo.
- Removes ambiguity about whether the array index is arithmetic or string-keyed for future readers.

