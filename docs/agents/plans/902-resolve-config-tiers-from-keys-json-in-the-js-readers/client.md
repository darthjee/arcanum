# Client Plan: Resolve config tiers from keys.json in the JS readers

Main plan: [plan.md](plan.md)

## Shared contracts

You rely on (from shared): `registry.allowsTier(key, tier)` returning `true | false | null`, where `null` means unknown key and counts as allowed. `context.registry` is already a `KeyRegistry`.

You produce: the CLI side of the marker. The text is exactly `ignored: tier not allowed`, and JSON tier entries gain `allowed` (present only when `allowsTier` returns a boolean).

## Implementation Steps

### Step 1 — Filter and mark tiers in `config get`

In `cli/lib/commands/config/get.js`, after building `found`, add `allowed` to each entry from `registry.allowsTier(key, entry.tier)`, but only when the result is a boolean. Then:

- **No tier flag:** `winner` is the first entry with `set && allowed !== false`.
- **`--all-tiers`:**
  - a disallowed, set tier gets the status `(ignored: tier not allowed)` instead of `<- resolved` or blank;
  - JSON `tiers.<tier>` gains `allowed`;
  - `resolved` uses the filtered winner.
- **Explicit `--tier <t>`:** still the raw value of that tier, because the user asked for it explicitly. JSON gains `allowed`. When the tier is disallowed and the value is set, also warn on stderr (human mode only): `<key> is set in the <t> tier, but arcanum does not read it from there`.

Spec cases in `cli/spec/lib/commands/config/get_spec.js`:

- `git.safe_branch` in repo only → unset, exit `1`;
- local plus repo → local wins;
- the `--all-tiers` marker;
- the explicit `--repo` warning;
- an unknown key → unchanged behavior.

### Step 2 — Mark ignored entries in `config list`

In `cli/lib/commands/config/list.js`, give each entry `allowed` (only when `allowsTier` returns a boolean). In the human output, append `   (ignored: tier not allowed)` to the line of an entry with `allowed === false`, before the description. JSON entries gain the `allowed` field. Spec cases go in `cli/spec/lib/commands/config/list_spec.js`.

Check the shortcuts that read through `ConfigChain#readWithSource` (`agentsEmail.js`, `agentsEmailMatrix.js`): they inherit the filter automatically, and every `git.*` key they read allows all three tiers, so no change is expected. Shortcuts that read raw tiers through `readTiers` in `shared.js` (`nextStep`, `ignoreChecks`, `setup/*`) write to one tier, so they belong to #905. Leave them.

## Files to Change

- `cli/lib/commands/config/get.js`: filtered winner, `--all-tiers` marker, explicit-tier warning, JSON `allowed`.
- `cli/lib/commands/config/list.js`: `allowed` and the human marker.
- `cli/spec/lib/commands/config/get_spec.js`, `cli/spec/lib/commands/config/list_spec.js`: the cases above.
- `cli/README.md` / the CLI end-user guide: mention the marker where `config get --all-tiers` is documented.

## CI Checks

- `cli/`: `make cli-check` (CI jobs: `cli`, `cli-node-floor`)

## Notes

- Ship this after the shared plan, because `allowsTier` comes from `shared/lib/config/KeyRegistry.js` and is bundled by `cli/scripts/build.mjs`.
