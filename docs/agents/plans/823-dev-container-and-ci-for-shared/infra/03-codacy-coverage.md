# Codacy partial uploads and coverage-final

Two lcov reports per commit (core and shared) must merge in Codacy instead of the last one winning. Model: `darthjee/majora`'s `.circleci/config.yml` (`report --partial` per job, a `coverage-final` job requiring them, an `SF:` path rewrite before upload).

- Path rewrite: c8 writes `SF:` paths relative to the package (`lib/...`) or absolute. Before each upload, rewrite them to repo-root paths, e.g. in `test` (cwd `core/`): `sed -i -E 's#^SF:(.*/core/)?lib/#SF:core/lib/#' coverage/lcov.info`; in `shared` (cwd `shared/`): `sed -i -E 's#^SF:(.*/shared/)?lib/#SF:shared/lib/#' coverage/lcov.info`. Check the actual `SF:` lines from a local `make core-test` / `make shared-test` run and adjust the pattern (also check core's `bin/` or other covered roots, if any appear in lcov).
- `test` job: replace the upload with "Make coverage paths relative to the repository root" + `bash <(curl -Ls https://coverage.codacy.com/get.sh) report --partial -r coverage/lcov.info || true`.
- `shared` job: the same two steps for `shared/`.
- New `coverage-final` job: image `darthjee/circleci_node:0.2.1`, no checkout, one step `bash <(curl -Ls https://coverage.codacy.com/get.sh) final || true`. In `workflows.test`: `requires: [test, shared]`, `filters: tags: ignore: /.*/`.
- Everything non-blocking (`|| true`). Document in the header comment that core and shared upload partial reports and `coverage-final` closes them, and that a failed `test`/`shared` skips the final call (accepted).

## Files to Change
- `.circleci/config.yml` — `test` upload switched to partial + path rewrite, `shared` upload, `coverage-final` job and workflow entry, header comment
