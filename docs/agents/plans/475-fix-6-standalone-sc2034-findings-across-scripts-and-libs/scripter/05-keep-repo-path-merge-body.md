# Keep repo_path param in merge_body.sh, suppress with convention comment

Unlike the other 3 "keep" locations, `local repo_path="$1" ...` (line 74, inside `merge_body_coauthors_list`) is a function parameter, not a sourced global — there is no "consumer" to name. The function's own docstring already documents this explicitly: "`<repo_path>` is accepted but unused, kept only for signature consistency with every other arcanum script's repo-path-first-arg convention." The suppression comment should reflect that reasoning rather than naming a caller.

## Files to Change

- `arcanum/_lib/merge_body.sh` — add `# shellcheck disable=SC2034 # kept for repo-path-first-arg signature consistency (see docstring above); not read` on the `local repo_path="$1" repo_ref="$2" number="$3" model_email="${4:-}"` line (line 74), or immediately above it if inlining on the `local` line reads awkwardly.
