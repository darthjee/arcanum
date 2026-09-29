# finish_report_shell.sh

Create `arcanum/_lib/finish_report_shell.sh`, the shell implementation of the `finish-report` entrypoint, exactly per the shared contract in [plan.md](../plan.md#shared-contracts).

- Parse `<repo_path>` (required first positional argument), then the flags in any order. Repeatable flags accumulate in order.
- Validate the input:
  - `--status` must be one of `success|declined|failed`.
  - `--skill` and `--summary` are required. The summary is trimmed and must not contain a newline.
  - Ids must be numeric.
  - Each `--label-change` is split on the first `:`. Each non-empty side must resolve through `_tag_label_for`, and at least one side must be non-empty.
- Resolve the domain and repo via `origin.sh` (`get_domain`, `get_repo_path`) only when `--issue`, `--pr` or `--merge`-provided ids need URLs. Map `ssh.github.com` to `github.com`.
- Parse each `--merge` block line by line (`FINISH_*=` keys) and apply the merge rules. Enforce the nested-failed-vs-caller-success usage error.
- Without `--nested`, print the report. With `--nested`, print the `FINISH_*` block (label changes stay canonical tags; `--next` is ignored).
- On any usage error, print nothing to stdout, write the message to stderr, and exit 1.

## Files to Change
- `arcanum/_lib/finish_report_shell.sh`: new
