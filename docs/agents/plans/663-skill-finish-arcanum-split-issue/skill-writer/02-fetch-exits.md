# Fetch exits

In `steps/fetch.md`:

- After `github.sh mark-planning`, derive the **planning change** from its output: `idea:planning`, `writting:planning` or `created:planning` for whichever `Removed tag '<tag>'` line it printed; otherwise `:planning`. If `mark-planning` produced no `Added tag 'planning'` (best-effort failure), record no planning change. Carry this value to every later report.
- If `resolve_and_fetch.sh` itself fails (e.g. dirty working tree — a plain script error, not `STATUS=error`), **fail with** `Fetch` (no label change happened yet; pass `--issue <id>` only if the id was parsed from the args).
- **Skip** (issue already has tracked sub-issues): release the working tree, then print a `declined` report with `--issue <id>`, one `--sub-issue` per existing tracked id, and the planning change. No offer.
- **Continue**: note that later reports/offer include only sub-issues created in this run.

## Files to Change
- `arcanum-split-issue/steps/fetch.md` — planning-change derivation, failed exit, Skip -> declined report, Continue note.
