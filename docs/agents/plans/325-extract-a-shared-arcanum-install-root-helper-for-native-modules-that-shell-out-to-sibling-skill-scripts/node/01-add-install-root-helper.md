# Add the InstallRoot helper

Create a single module that computes the arcanum install root once and exposes it for every install-root-relative lookup in `core/lib/`.

`core/lib/utils/file/InstallRoot.js`:

- Compute `INSTALL_ROOT` from this module's own location: `path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')`. `core/lib/utils/file/` is 4 levels below the repo root. Use `path.resolve` so the result is normalized (no literal `..` segments left in the string — some existing specs assert on the joined path).
- Export `INSTALL_ROOT` as a named `const` (string).
- Export `resolveInstallPath(...segments)` — a plain named function returning `path.join(INSTALL_ROOT, ...segments)`. JSDoc it (public function; ESLint requires it): one `@param {...string} segments` line and a `@returns {string}` line, plus a sentence saying it resolves paths **inside the arcanum install (the skill repo itself), never the target `repoPath`** — this is the distinction #319 got wrong.
- No class, no default export, no injectable deps — this is pure compile-time path math. Named-export-only precedent: `core/lib/utils/issue/Tags.js`.
- Keep the module comment short: what "install root" means and why the walk lives here (so moving a consumer module never silently rebreaks resolution).

`core/spec/lib/utils/file/InstallRoot_spec.js` (mirrors `core/lib/` 1:1):

- `INSTALL_ROOT` points at a directory that exists and contains known install-root markers — assert e.g. `arcanum/_lib/config_chain.sh` and `auto-fix-all/templates/reply.tmpl.md` exist under it (`node:fs/promises` `access`), mirroring how `ArcanumSplitIssueFinish_spec.js` already does an on-disk `access` check for the resolved script.
- `INSTALL_ROOT` contains no unresolved `..` segment.
- `resolveInstallPath('a', 'b', 'c.sh')` equals `path.join(INSTALL_ROOT, 'a', 'b', 'c.sh')`.
- `resolveInstallPath()` with no segments returns `INSTALL_ROOT`.
- Compute the expected root in the spec independently (from the spec file's own location, 5 levels up: `core/spec/lib/utils/file/`) rather than importing it from the module under test.

## Files to Change

- `core/lib/utils/file/InstallRoot.js` — new module: `INSTALL_ROOT` constant + `resolveInstallPath(...segments)`.
- `core/spec/lib/utils/file/InstallRoot_spec.js` — new spec covering the constant, the resolver, and on-disk existence of install-root markers.
