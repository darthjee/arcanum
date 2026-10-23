# Errors, output and tier-file reading
The shared output and error layer, and the tolerant tier reader that every command uses.

- Error wording (spec "Error messages"): an `arcanum: ` prefix, an optional `hint: ` line, and no stack traces unless `ARCANUM_DEBUG=1`. Results go only to stdout; every warning and error goes to stderr.
- `--json` (spec "JSON output"): one writer for the stable per-command shapes and for the error object printed on failure, so that each command only builds the data.
- Extend `exitCodeForError` and the CLI errors so that validation (`3`), target (`4`) and skew (`5`) refusals have their own error classes, each mapped to its code. Keep `exitCodes.js` as the single mapping point.
- Tier reader (spec "Missing and malformed tier files"): a missing or empty file is an empty tier and stays silent. Invalid JSON, a non-object top level, or an unreadable file gives a stderr warning naming the file, and the tier is treated as empty. A UTF-8 BOM is stripped. The writes in step 05 reuse the same parse to refuse malformed files with exit `7`.

## Files to Change
- `cli/lib/exitCodes.js` — add the validation, target and skew error classes and map them.
- `cli/lib/output.js` (new) — human and JSON result writer, warnings, errors and hints, and `ARCANUM_DEBUG`.
- `cli/lib/tierFiles.js` (new) — tier file paths (matching `ConfigChain`) and the tolerant parse that reports a malformed state.
- `cli/lib/main.js` — use `output.js` for errors (including the JSON error object under `--json`).
- `cli/spec/lib/exitCodes_spec.js`, `cli/spec/lib/output_spec.js`, `cli/spec/lib/tierFiles_spec.js` — one spec per malformed-file kind, plus the BOM and error-shape specs.
