# Shared helper: reads a per-repo-migration version folder's ordered
# entries, either from its migrations.json manifest (preferred, every
# version folder after 0.12.0) or, when that file is absent, by
# falling back to legacy glob discovery (0.9.3, 0.12.0, and any future
# not-yet-retrofitted folder) — implicit "repo" scope, skippable
# sourced from "<file>.sh config", same as before this file existed.
#
# This file is meant to be SOURCED, not executed directly.
#
# --- migrations.json schema ---
#
# An array of entry objects, run in array order:
#
#   [
#     {"id": "001", "type": "script", "file": "001.sh", "skippable": false, "applies_to": "repo"},
#     {"id": "002", "type": "script", "file": "002.sh", "skippable": true,  "applies_to": "local"},
#     {"id": "003", "type": "instructions", "description_file": "003.md", "instructions_file": "003.instructions.md", "skippable": true, "applies_to": "local"}
#   ]
#
# - "id": zero-padded (NNN), matches the paired "<id>.sh" (type
#   "script") or "<id>.md"/"<id>.instructions.md" (type "instructions")
#   filenames. generate_next.sh computes the next one as (highest
#   existing "id" across all entries, any type) + 1.
# - "type": "script" (deterministic, runs "<file> run") or
#   "instructions" (hands off to the AI — see below). Both types share
#   the same single id sequence.
# - "file" (type "script" only): filename of the migration script,
#   within the same version folder.
# - "description_file" (type "instructions" only): filename of the
#   human-facing description, shown at the confirm prompt exactly like
#   a "script" entry's paired "<file>.md" — but given directly here
#   since there is no ".sh" path to derive it from.
# - "instructions_file" (type "instructions" only): filename of the
#   AI-facing content, never printed to the terminal, only handed to
#   the AI once [R]un is chosen (or under --no-confirm). A second,
#   separate file from "description_file" — the human-facing summary
#   shown at the prompt and the AI-facing instructions serve different
#   audiences.
# - "skippable": moved out of "<file> config" for manifest-driven
#   entries — update_per_file.sh no longer shells out to it for these;
#   "<file> config" only still matters for legacy (glob-discovered)
#   entries, where this file's legacy fallback below still calls it.
#   Always present for both types.
# - "applies_to": "repo", "local", or "global" — no combined "both"
#   value; a change needing more than one kind of effect is authored as
#   separate entries, one per scope (see
#   docs/guides/arcanum-repo-version.md for why). "repo" entries are
#   satisfied once the committed version pointer
#   (.claude/configuration/arcanum-repo-config.json's top-level
#   .version) reaches this version folder's name; "local" entries are
#   satisfied once the local version pointer
#   (.claude/state/arcanum-config.json's .migrations.version) does,
#   independently per clone; "global" entries are satisfied once the
#   global, cross-project version pointer
#   (${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json's
#   .migrations.version, read/written via
#   global_config_get_version/global_config_set_version in
#   arcanum/_lib/global_config.sh) does — shared machine/account-wide,
#   not per-clone or per-repo, so one repo advancing it satisfies every
#   other repo on the same machine/account immediately — for
#   "instructions" entries specifically, update_per_version.sh also
#   treats an entry as satisfied once
#   .claude/state/arcanum-migrations-ledger.json (see _ledger.sh) has
#   recorded it complete, regardless of pointer position, so a resume
#   mid-version never re-triggers an already-handled hand-off.

# _manifest_entries <version_dir>
#   Prints one TSV line per entry, in run order:
#     <id>\t<type>\t<primary_file>\t<instructions_file>\t<skippable>\t<applies_to>
#
#   <primary_file> is ".file" for type "script" or ".description_file"
#   for type "instructions" — the file shown/run at the [R]un/[S]kip/
#   [C]hat prompt either way. <instructions_file> is ".instructions_file"
#   for type "instructions", or the literal "-" otherwise (type
#   "script" and legacy glob-discovered entries) — never a truly empty
#   field: bash's `read` (the way every caller consumes this TSV)
#   squeezes/strips consecutive IFS-whitespace delimiters (tab is one),
#   silently collapsing a genuinely empty middle field and shifting
#   every column after it. "-" is not a valid filename fragment either
#   type ever produces for real, so it's an unambiguous "not
#   applicable" sentinel. Callers never need to special-case it — it's
#   only ever read for "type" == "instructions" entries, which always
#   have a real filename here.
#
#   Reads "<version_dir>/migrations.json" if present (array order is
#   the run order — entries are not re-sorted). Otherwise falls back to
#   legacy glob discovery: every "[0-9][0-9][0-9].sh" in <version_dir>,
#   sorted by filename, each synthesized as
#   id=<NNN> type=script primary_file=<NNN.sh> instructions_file=-
#   applies_to=repo, with skippable read live from "<file> config"'s
#   {"skippable": ...}.
_manifest_entries() {
  local version_dir="$1"
  local manifest="${version_dir}/migrations.json"

  if [[ -f "$manifest" ]]; then
    jq -r '.[] | [
        .id,
        .type,
        (if .type == "instructions" then .description_file else .file end),
        (if .type == "instructions" then .instructions_file else "-" end),
        .skippable,
        .applies_to
      ] | @tsv' "$manifest"
    return 0
  fi

  local f base skippable
  for f in "${version_dir}"/[0-9][0-9][0-9].sh; do
    [[ -e "$f" ]] || continue
    base="$(basename "$f" .sh)"
    skippable="$("$f" config | jq -r '.skippable')"
    printf '%s\tscript\t%s\t-\t%s\trepo\n' "$base" "$(basename "$f")" "$skippable"
  done
}

# _manifest_has_scope <version_dir> <scope>
#   Exits 0 if any entry in <version_dir>'s manifest (or legacy glob
#   fallback) has applies_to == <scope> ("repo", "local", or "global"),
#   1 otherwise.
_manifest_has_scope() {
  local version_dir="$1" scope="$2"
  local _id _type _primary_file _instructions_file _skippable applies_to
  while IFS=$'\t' read -r _id _type _primary_file _instructions_file _skippable applies_to; do
    [[ "$applies_to" == "$scope" ]] && return 0
  done < <(_manifest_entries "$version_dir")
  return 1
}
