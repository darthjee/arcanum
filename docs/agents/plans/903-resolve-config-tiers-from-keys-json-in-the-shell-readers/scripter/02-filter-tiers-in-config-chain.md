# Filter tiers in config_chain_read

`arcanum/_lib/config_chain.sh` sources `key_registry.sh`. Each of `config_chain_read`'s three per-tier loops (local state, repo config, global) skips a key when `key_registry_allows_tier "${namespace}.${key}" <tier>` prints `false`. The tiers are `local`, `repo` and `global`, in the loop order. A skipped key is not read at all.

Keep everything else unchanged:

- the tier order, with each tier fully resolved before the next one;
- `null` falls through and `""` stops the chain;
- it always exits 0, with the same `jq -c` output.

Update the function's header comment to describe the filter, link `key_registry.sh`, and note that `true` and `null` (unknown key) both read.

Every caller inherits this: `engine_dispatch.sh`, `engine_dispatch_docker.sh`, `next_step_prompt_shell.sh`, `spawn_issue_shell.sh`, `agent_email.sh` and `merge_body.sh`. None of them changes.

## Files to Change

- `arcanum/_lib/config_chain.sh`: source `key_registry.sh`, add the per-tier skip, update the header comment.
