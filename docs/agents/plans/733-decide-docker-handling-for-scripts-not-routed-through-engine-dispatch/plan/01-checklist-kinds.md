# Assign final kinds in the checklist

Replace every `TBD (#733)` in `docs/agents/specs/docker/checklist.md`.

1. **"How to use it"** (line 8): drop "pending #733". Say that the last section lists the scripts not routed through `engine_dispatch.sh`, one row per file, each with a non-dispatched kind and status `n/a`.
2. **Columns table, `kind` row** (line 18): replace `TBD (#733)` with the four non-dispatched kinds and define each one in a few words:
   - `sourced`: a library, only ever `source`d by other scripts. It runs wherever its caller runs, and is unused inside the container, where native code runs.
   - `wrapper`: a per-skill script that `exec`s a dispatched `arcanum/_lib` shim. The shim's rows cover it.
   - `entrypoint`: called directly by skills, never dispatched, so it always runs as bash on the host.
   - `bootstrap`: install/update bootstrap. It runs before or outside an installed arcanum, so it can never be dispatched.

   State that only `dispatched` and `native-only` rows can ever be ✅. Every non-dispatched kind is permanently `n/a`.
3. **Section heading and intro** (lines 189–191): rename to `## Not routed through dispatch`. In the intro, replace "decided in #733" with a short summary of the per-kind rule from item 2, linking to dispatch.md's non-dispatched section (step 02).
4. **Rows** (lines 195–233): set `kind`, keep status `n/a`, and fill `notes`:
   - `sourced`: `run_update_common.sh`, every `arcanum/_lib/*.sh` row except `next_step_prompt.sh` (this includes `push.sh` and `merge_body.sh`), `config_common.sh`/`queue_common.sh` (auto-fix-all), `config_common.sh`/`rewrite_queue_common.sh` (monitor-issues). Notes stay empty, except `push.sh`/`merge_body.sh`: "Sourced, not an entrypoint."
   - `wrapper`: every `*/scripts/github.sh` (notes: "Covered by the `github-issue-*` rows."), `issue_state.sh` → `issue-state`, both `resolve_plan_paths.sh` → `resolve-plan-paths`, both `resolve_id_and_file.sh` → `resolve-id-and-file`, `resolve_and_fetch.sh` → `resolve-and-fetch`, every `list_agents.sh` → `list-agents`. In notes, write "Covered by the `<command>` row."
   - `entrypoint`: `next_step_prompt.sh` (notes: "Bash on the host. Owns `/dev/tty`. Becomes a dispatched `host-only` command in #760.") and `auto_next.sh` (notes: "Bash on the host. Runs `next_step_prompt.sh --no-prompt` and `git push`. Becomes a dispatched `host-only` command in #760.").
   - `bootstrap`: the four `arcanum/install/*` and `arcanum/update/*` rows (notes: "Runs before or outside an installed arcanum.").
   - Leave `credentials`, `mounts`, `env` and `issue` empty, except `issue` = `#733` on every row, since this issue gives each row its final value.

## Files to Change
- `docs/agents/specs/docker/checklist.md`: the "How to use it" bullet, the `kind` column definition, the last section's heading and intro, and every row in that section.
