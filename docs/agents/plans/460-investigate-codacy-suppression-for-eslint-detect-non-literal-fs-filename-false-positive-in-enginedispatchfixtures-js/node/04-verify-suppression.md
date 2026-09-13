# Verify the finding no longer appears

After Step 2's suppression is applied on Codacy's side and Step 3's documentation commits are pushed, trigger (or wait for) a fresh Codacy analysis of the branch/PR and re-check with `codacy_get_file_issues`/`codacy_search_repository_srm_items` (same calls as Step 1) that `detect-non-literal-fs-filename` no longer appears as an open finding under `core/spec/` — or, if suppressed as individually-ignored findings, that each one now shows an `Ignored` status.

## Files to Change

- None — verification only.
