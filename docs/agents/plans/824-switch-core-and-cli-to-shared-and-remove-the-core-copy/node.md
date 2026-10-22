# Node Plan: Switch core and cli to shared/ and remove the core copy

Main plan: [plan.md](plan.md)

## Shared contracts

- Run `diff -r core/lib/shared shared/lib` first. It must be empty; if it is not, stop and get `shared/lib/` re-synced by `shared`.
- Import the surface by relative path into `<repo>/shared/lib/`. Add no shims and never import `shared/spec/**`.
- The strict-key error message becomes `arcanum: config key "<key>" is not in shared/lib/config/keys.json (ARCANUM_STRICT_CONFIG_KEYS=1)` (changed by `shared`). Any core spec asserting it must use this text.
- `core/lib/commands/shared/` and `core/spec/lib/commands/shared/` are not the surface. Leave them alone.

## Steps

- [01 — Switch core imports to shared/lib](node/01-switch-imports.md)
- [02 — Delete the core copy and its specs](node/02-delete-core-copy.md)
- [03 — Lint rules and comments](node/03-lint-and-comments.md)

## CI Checks

- `core`: `make core-check` (CI jobs: `test`, `checks`)

## Notes

- `core/package.json`'s c8 config measures only files under `core/`. Once the surface moves out, core's coverage numbers change but stay above the 50% floor. `shared/` coverage is reported by its own job (#823).
- Specs import `shared/lib/` the same way lib files do. No jasmine config change is needed, because `shared/lib` has no `node_modules` dependencies (it imports only `node:` built-ins).
