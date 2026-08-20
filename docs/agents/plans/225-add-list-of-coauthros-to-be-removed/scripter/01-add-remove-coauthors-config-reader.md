# Add the remove_coauthors config reader

Add a function to `arcanum/_lib/agent_email.sh` that reads the `git.remove_coauthors` config key, following the exact pattern of the existing `model_coauthor_omitted()` in the same file (see lines 49–59): resolve via `config_chain_read(".", "git", "remove_coauthors")`, and print the raw jq-compact value.

Unlike `model_coauthor_omitted()` (which prints `"true"`/`"false"`), this key holds a JSON array, so the new function should print the raw compact JSON array when present, or the literal `[]` when the value is absent/null/empty — matching `config_chain_read`'s own "prints nothing when absent" contract plus a hardcoded default, same convention as every other `config_chain_read` caller in this file. Suggested name: `remove_coauthors_list()`.

Add a doc comment above the function mirroring `model_coauthor_omitted()`'s header comment style (see lines 49–53), documenting the default-`[]`/purely-opt-in behavior.

## Files to Change

- `arcanum/_lib/agent_email.sh` — add `remove_coauthors_list()` (or similar name) reading `git.remove_coauthors` via `config_chain_read`, defaulting to `[]`.
