# Shared helper: reads a per-repo-migration version folder's ordered
# entries, either from its migrations.json manifest (preferred, every
# version folder from 0.12.0 onward) or, when that file is absent, by
# falling back to legacy glob discovery (0.9.3 and any future
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
#     {"id": "002", "type": "script", "file": "002.sh", "skippable": true,  "applies_to": "local"}
#   ]
#
# - "id": zero-padded (NNN), matches the paired "<id>.sh" filename.
#   generate_next.sh computes the next one as (highest existing "id"
#   across all entries) + 1.
# - "type": only "script" for now (a paired "instructions" type is
#   planned by a follow-up issue, on top of this same schema).
# - "file": filename of the migration script, within the same version
#   folder.
# - "skippable": moved out of "<file> config" for manifest-driven
#   entries — update_per_file.sh no longer shells out to it for these;
#   "<file> config" only still matters for legacy (glob-discovered)
#   entries, where this file's legacy fallback below still calls it.
# - "applies_to": "repo" or "local" — no combined "both" value; a
#   change needing both kinds of effects is authored as two separate
#   entries (see docs/guides/arcanum-repo-version.md for why). "repo"
#   entries are satisfied once the committed version pointer
#   (.claude/configuration/arcanum-repo-config.json's top-level
#   .version) reaches this version folder's name; "local" entries are
#   satisfied once the local version pointer
#   (.claude/state/arcanum-config.json's .migrations.version) does,
#   independently per clone.

# _manifest_entries <version_dir>
#   Prints one TSV line per entry, in run order:
#     <id>\t<type>\t<file>\t<skippable>\t<applies_to>
#
#   Reads "<version_dir>/migrations.json" if present (array order is
#   the run order — entries are not re-sorted). Otherwise falls back to
#   legacy glob discovery: every "[0-9][0-9][0-9].sh" in <version_dir>,
#   sorted by filename, each synthesized as
#   id=<NNN> type=script file=<NNN.sh> applies_to=repo, with skippable
#   read live from "<file> config"'s {"skippable": ...}.
_manifest_entries() {
  local version_dir="$1"
  local manifest="${version_dir}/migrations.json"

  if [[ -f "$manifest" ]]; then
    jq -r '.[] | [.id, .type, .file, .skippable, .applies_to] | @tsv' "$manifest"
    return 0
  fi

  local f base skippable
  for f in "${version_dir}"/[0-9][0-9][0-9].sh; do
    [[ -e "$f" ]] || continue
    base="$(basename "$f" .sh)"
    skippable="$("$f" config | jq -r '.skippable')"
    printf '%s\tscript\t%s\t%s\trepo\n' "$base" "$(basename "$f")" "$skippable"
  done
}

# _manifest_has_scope <version_dir> <scope>
#   Exits 0 if any entry in <version_dir>'s manifest (or legacy glob
#   fallback) has applies_to == <scope> ("repo" or "local"), 1
#   otherwise.
_manifest_has_scope() {
  local version_dir="$1" scope="$2"
  local _id _type _file _skippable applies_to
  while IFS=$'\t' read -r _id _type _file _skippable applies_to; do
    [[ "$applies_to" == "$scope" ]] && return 0
  done < <(_manifest_entries "$version_dir")
  return 1
}
