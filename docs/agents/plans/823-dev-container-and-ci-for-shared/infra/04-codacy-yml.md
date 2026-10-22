# .codacy.yml entries for shared/

Mirror core's Codacy entries for `shared/`:

- `engines.pmd.exclude_paths`: add `shared/**/*.js` — the copied code hits the same PMD "unnecessary block" false positives as `core/**/*.js`.
- Global `exclude_paths`: add `shared/spec/support/**` (next to `core/spec/support/**`) and `shared/yarn.lock` (next to `core/yarn.lock`).
- Extend the existing rationale comments for each so they name `shared/` too (mention #823).

## Files to Change
- `.codacy.yml` — PMD and global exclusions for `shared/`, comments
