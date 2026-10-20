# Node Plan: Shared config key registry

Main plan: [plan.md](plan.md)

## Shared contracts

- You produce `core/lib/utils/config/keys.json` with exactly the key table in [plan.md](plan.md#shared-contracts), plus descriptions, `setup` entries and per-type fields from the spec.
- You own the shell static scan spec. It must implement the parsing and annotation rules in [plan.md](plan.md#shared-contracts) exactly. scripter adds the annotations it relies on.

## Steps

- [01 — Registry file and KeyRegistry loader/matcher/validator](node/01-registry-and-keyregistry.md)
- [02 — Registry validator spec and KeyRegistry spec](node/02-registry-specs.md)
- [03 — Strict-keys read guard](node/03-strict-keys-guard.md)
- [04 — Defaults drift spec](node/04-defaults-drift-spec.md)
- [05 — Shell static scan spec](node/05-shell-static-scan-spec.md)
- [06 — Shared-surface allowlist](node/06-shared-surface-allowlist.md)

## CI Checks

- `core`: `cd core && yarn lint && yarn test`, the core job in `.circleci/config.yml`.

## Notes

- Follow the spec to the letter. It has no open points.
- `cli/` does not exist yet, so there is no `client` side to keep green.
- Node 22.13 might print an `ExperimentalWarning` for the static JSON import (`with { type: 'json' }`). Check by running a bin command that imports `KeyRegistry.js`, e.g. via a spec, and inspecting stderr. If it does, switch to `keys.js` with `export default { format_version: 1, keys: [...] }`, and update the docs/spec references to the file name in the same PR.
