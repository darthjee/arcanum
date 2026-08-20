# Wire the filter into merge_body_coauthors_list

In `merge_body_coauthors_list()` (`arcanum/_lib/merge_body.sh`, currently lines 69–95):

1. Call the new `remove_coauthors_list()` (from step 01) once, near the top of the function alongside the existing `merger_login`/`omit_model` lookups.
2. Pass the resulting JSON array into the `jq` pipeline as `--argjson remove_list "$remove_list_value"` (new arg, alongside the existing `--arg merger`, `--arg model_email`, `--arg omit_model`).
3. Add a filter step to the jq pipeline immediately after `unique_by(.email)` (current line 87), before the existing merger/omit_model filters:
   ```jq
   map(select(.email as $e | $remove_list | index($e) | not))
   ```
   Ordering relative to the other two `map(select(...))` filters doesn't affect correctness (all three are independent exclusions) — placing it right after `unique_by(.email)` matches the issue's description and keeps the "list-based" filters (dedupe, remove_coauthors) together before the "flag-based" filters (merger, omit_model).
4. Update the function's header doc comment (lines 48–68) to describe the new filter, in the same style as the existing bullet describing `omit_model_coauthor`/`model_email` (lines 66–68).

## Files to Change

- `arcanum/_lib/merge_body.sh` — call `remove_coauthors_list()`, pass it as `--argjson`, add the `map(select(...))` filter step after `unique_by(.email)`, and update the function's header doc comment.
