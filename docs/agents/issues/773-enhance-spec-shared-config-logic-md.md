# Issue: Enhance spec: shared-config-logic.md

## Description

Part of epic #767 (Arcanum user-facing CLI for configuration). See the epic for the full design decisions.

Deepen and review the spec file `docs/agents/specs/arcanum-cli/shared-config-logic.md` written in the "Write the arcanum CLI spec" sub-issue.

Focus for this file: the exact list of shared-surface files, the `ConfigError` contract and how the dispatcher/CLI map it, the lint rule, the `esbuild` bundle setup, lock interoperability with the shell `lock.sh`, and the CI coupling rules.

### Scope

- Resolve the open points recorded in this file.
- Cover, for what this file describes: edge cases, backward compatibility, testing strategy, performance & security considerations.
- Keep cross-links with the index and the other parts consistent; update the index's open-points list accordingly.
- Docs only — no code.

### Owner

`architect`.

### Dependencies

After "Write the arcanum CLI spec". Can run in parallel with the other "Enhance spec" sub-issues. The CLI's write commands (not this docs issue) are additionally hard-blocked by #807 (lock protocol fix).

## Problem

`shared-config-logic.md` left five open points, and review surfaced further gaps:

- The exact shared-surface file list, including the JSDoc `RepoContext` type references.
- The shape of `ConfigError` and how it maps to `DispatchFailure` and to the CLI exit codes.
- How CI detects shared-surface changes.
- Shared agent-email resolution (duplicated in three native commit commands plus `agent_email.sh`, with a shell/native divergence on `""`).
- Lock interoperability with `arcanum/_lib/lock.sh` — which turned out to hide a real bug: the shared lock protocol does not exclude a writer that already holds the lock (spun off as #807).
- The lint rule only covered one direction (surface → outside), not the CLI reaching into `core/lib` beyond the surface; the `esbuild` setup was unspecified beyond "bundle".

## Expected Behavior

After this issue, `docs/agents/specs/arcanum-cli/shared-config-logic.md` has no open points left (only the npm-package extraction remains as future work), and every decision below is recorded there with its rationale and rejected alternatives. Consequential edits land in `command-surface.md` (lock-contention wording, non-object-intermediate case), `shortcuts-and-setup.md` (agent-email resolution pointing at `AgentEmail`, `""` row) and the index (`arcanum-cli.md`: part description, #807 dependency). Docs only — no code.

## Solution

Decisions to record in the spec, grouped by topic.

### Lock interoperability

**Finding.** The shared lock protocol (`arcanum/_lib/lock.sh` and its mirror `core/lib/utils/file/Lock.js`) is not mutually exclusive against a writer that already holds the lock: acquire writes its id unconditionally, sleeps 1s and re-reads, never checking whether the lock file already exists. A late writer therefore "steals" a held lock, both mutate the file concurrently (silent lost update), and the first to finish `rm -f`s the other's lock. It only arbitrates writers arriving within the same ~1s window. The [Command Surface](../specs/arcanum-cli/command-surface.md#lock-contention) guarantees ("the CLI and running skills exclude each other", the bounded `--lock-timeout`, exit `6`) assume real exclusion.

**Decision.** Fix the shared protocol rather than weakening the CLI's guarantees or giving the CLI a private lock (which would still not exclude skills). The fix is code in both shell and `core/`, so it is spun off as **#807** (owners `node` + `scripter`), which the CLI's write path depends on:

- **Atomic create-if-absent acquire** — Node `writeFile(lockFile, id, { flag: 'wx' })`; Bash `( set -o noclobber; echo "$id" > "$LOCK_FILE" )`. Existing file → wait and retry (forever for skills; bounded for the CLI). No more write → sleep → re-read.
- **Owner-checked release** — delete only if the file still holds this instance's id.
- **Stale-lock detection** — same hostname and dead pid (`kill -0` / `process.kill(pid, 0)`) → break the lock; cross-host locks keep today's warn-once behaviour.
- **Optional bound** on `Lock` (the CLI's dependency), skills keep wait-forever.

**#807 is a hard blocker for the CLI's write commands.** `set`/`unset` (and every shortcut that writes) do not ship until #807 has landed, so the exclusion guarantees in `command-surface.md` hold from the CLI's first release. Read-only commands (`get`, `list`, `info`) take no lock and are not blocked.

#807 stays **standalone, outside epic #767**: it fixes a bug that exists without the CLI (e.g. the `auto-fix-all` queue race) and should be planned and merged on its own merits. The blocking is made visible instead: the spec records #807 as the write path's blocker, and the epic's write-path implementation issue is marked "blocked by #807" when it is created.

**Consequences for this spec (#773 work):**

- `shared-config-logic.md`: replace the lock-interoperability open point with this decision and list #807 as a dependency; fold the "Bounded lock for the CLI" guardrail into it.
- `command-surface.md#lock-contention`: state that exclusion between the CLI and skills holds once #807 ships; a timeout now means the lock file existed for the whole wait, the CLI wrote nothing, so there is nothing to clean up on timeout or signal.
- **Mixed versions.** The npm CLI may be newer than the arcanum install it targets. A new-protocol writer waits on an old writer's file; an old writer can still overwrite a new one's, as today. A mix is never worse than now and becomes fully exclusive once both sides upgrade. No per-repo migration (no file shape change).

### `ConfigError` contract and mapping

**Findings.**

- The only `DispatchFailure` use on the current shared surface is `BooleanKeyConfig#isEnabled`'s `throw new DispatchFailure('', 1)`, which is `config.sh is-enabled`'s "false" signal via exit code, not an error.
- `BooleanKeyConfig` is the native `config.sh` dispatch layer (subcommand-named methods, `"\n"`-terminated stdout strings, `toggle`), not generic config logic. Its subclasses (`AutoFixAllConfig`, `MonitorIssuesConfig`) target the same namespaced repo file with legacy fallback that `ConfigChain` / `RepoConfigWriter` already handle.
- Validation (exit `3`) is already settled in [Key Registry](../specs/arcanum-cli/key-registry.md): `KeyRegistry#check` returns a structured result instead of throwing, so `ConfigError` does not cover validation.

**Decisions.**

1. **`BooleanKeyConfig` leaves the shared surface.** It stays core-only and keeps `DispatchFailure` (a dispatch protocol there, not an error). The CLI reads through `ConfigChain` and writes through `RepoConfigWriter` for every key. The "Decouple `DispatchFailure`" guardrail is removed — the problem no longer exists. The shared surface becomes `ConfigChain`, `RepoConfig`, `RepoConfigWriter`, `Lock`, `ConfigError`, `KeyRegistry`, `keys.json` (plus the shared agent-email helper, see its own topic).
2. **`ConfigError`** is a small class on the shared surface, `core/lib/utils/config/ConfigError.js`:

   ```js
   class ConfigError extends Error {
     constructor(code, message, { file } = {}) { super(message); this.code = code; this.file = file; }
   }
   ```

   | `code` | Thrown by | Message |
   | --- | --- | --- |
   | `NOT_AN_OBJECT` | `RepoConfigWriter` (`_readBase`, namespace, intermediate path) | unchanged: `Cannot index <file\|.path>: not a JSON object` |
   | `INVALID_JSON` | `RepoConfigWriter#_readLegacy` | unchanged parse error |
   | `LOCK_TIMEOUT` | `Lock` when its new optional bound is exhausted (#807) | names the lock file |
   | `UNREGISTERED_KEY` | strict-keys guard in `ConfigChain#read` / `RepoConfig` read (`ARCANUM_STRICT_CONFIG_KEYS=1`, test-only) | names the key |

   Native fs errors (`EACCES`, `ENOSPC`, `EISDIR`, …) propagate unwrapped; they already carry `error.code`.
3. **Dispatcher mapping: none.** `ConfigError extends Error` with today's messages, so `core/bin/arcanum`'s bare-`Error` path (`arcanum: <message>` on stderr, exit `1`) is unchanged — no new branch, byte-identical output and exit codes.
4. **CLI mapping**, a single function in `cli/lib/`:
   - `LOCK_TIMEOUT` → `6` (`EXIT_LOCK_TIMEOUT`);
   - `NOT_AN_OBJECT`, `INVALID_JSON`, any Node errno error → `7` (`EXIT_FILE`);
   - `UNREGISTERED_KEY` and anything unrecognised → `1` (`EXIT_ERROR`).
5. **Edge case — non-object intermediate.** The CLI's own malformed-file check pre-empts a whole-file `NOT_AN_OBJECT`, but a non-object intermediate can still reach the writer (e.g. a hand-edited file where `.git` is a string, then `set git.authors …`). It maps to `7`: the problem is the file's content, not the key. `command-surface.md`'s malformed-files section should mention it.

**Spec consequences.** In `shared-config-logic.md`: update the shared-surface list, drop the `DispatchFailure` guardrail in favour of this contract, and close the `ConfigError` open point. In `command-surface.md`: add the non-object-intermediate case.

### Shared-surface lint rule

Precedent: `core/eslint.config.mjs` already enforces the `commands → context/services → utils` layering with a `no-restricted-imports` block. The shared surface gets a **two-sided** rule.

#### 1. Core side — allowlist on the surface files

A new block in `core/eslint.config.mjs` whose `files` list names the surface **explicitly** (not a glob — `BooleanKeyConfig.js` lives in the same folder but is no longer on the surface). **This `files` list is the authoritative declaration of the shared surface**; the spec points at it rather than maintaining a second copy.

```js
{
  // The CLI's declared shared surface (docs/agents/specs/arcanum-cli/shared-config-logic.md):
  // these files are bundled into arcanum-cli, so they may import only node:
  // built-ins and each other. Replaces the commands-layering rule for these
  // files (flat config: last matching block wins); `**` already rejects commands/.
  files: [
    'lib/utils/config/ConfigChain.js', 'lib/utils/config/RepoConfig.js',
    'lib/utils/config/RepoConfigWriter.js', 'lib/utils/config/ConfigError.js',
    'lib/utils/config/KeyRegistry.js', 'lib/utils/file/Lock.js'
    // + the shared agent-email helper once extracted
  ],
  rules: {
    'no-restricted-imports': ['error', { patterns: [{
      group: ['**', '!node:*', '!./ConfigChain.js', '!./RepoConfig.js', '!./RepoConfigWriter.js',
              '!./ConfigError.js', '!./keys.json', '!../file/Lock.js', '!../config/ConfigError.js'],
      message: 'Shared-surface files may import only node: built-ins and other shared-surface files.'
    }] }],
    'no-restricted-syntax': ['error',
      { selector: 'ImportExpression', message: 'No dynamic import() on the shared surface.' }]
  }
}
```

- Bare built-ins (`'fs'` instead of `'node:fs'`) are rejected; every current import already uses `node:`, so this keeps the allowlist simple at no cost.
- `no-restricted-syntax` covers dynamic `import()`, which `no-restricted-imports` ignores; `export … from` is already covered.
- Patterns match the import **specifier**, not the resolved path (e.g. `'./ConfigChain.js'` written in `file/Lock.js` would pass lint and fail at runtime — specs catch that). A path-resolving rule would need `eslint-plugin-import`, a new devDependency — not worth it.

#### 2. CLI side — `core/lib` only through the surface

`cli/eslint.config.mjs` restricts `**/core/lib/**` imports to the surface entry files the CLI actually uses (`ConfigChain`, `RepoConfigWriter`, `ConfigError`, `KeyRegistry`, `Lock`, plus the agent-email helper). Without it, the CLI could import e.g. `core/lib/context/RepoContext.js`, `esbuild` would bundle it silently, and the surface would be bypassed. The existing `checks` job enforces the core side; the new `cli` job enforces the CLI side.

#### 3. JSDoc `RepoContext` references (closes the shared-surface open point)

Keep them. Neither ESLint nor `esbuild` reads `import('…')` inside JSDoc comments, so they pull nothing into the bundle. They document an optional dependency only core injects; the CLI never passes `repoContext`. Reword the JSDoc to say "optional, core-only" so readers don't mistake it for a surface dependency.

**Spec consequences.** In `shared-config-logic.md`: replace the "Declared shared surface" guardrail with this two-sided rule, state that core's ESLint `files` list is authoritative, and close the shared-surface-list open point (including the `RepoContext` question).

### `esbuild` bundle setup

Precondition checked: no shared-surface file uses `import.meta.url` or `__dirname`, so moving them into a bundle breaks no module-relative path resolution.

**Entry and output.**

- Entry: `cli/lib/main.js` (the command router).
- `cli/bin/arcanum` is **not** bundled. It stays the tiny, syntax-conservative Node-floor gate specified in the index's [Runtime](../specs/arcanum-cli.md#runtime) section, and only then `import('../dist/arcanum.mjs')`s the bundle — an old Node fails at the gate with a clear message, never on newer syntax inside the bundle.
- Output: `cli/dist/arcanum.mjs`, a single file. `dist/` is gitignored.

**Options**, set in `cli/scripts/build.mjs` via esbuild's JS API (not the CLI, so the build can assert on its own output):

| Option | Value | Why |
| --- | --- | --- |
| `bundle` | `true` | |
| `platform` | `'node'` | Built-ins stay external automatically. |
| `format` | `'esm'` | Matches the `"type": "module"` stack. |
| `target` | `node` + the floor parsed from `cli/package.json` `engines.node` (`node22.13`) | Derived, not hard-coded — keeps the index's lockstep rule. |
| `minify` | `false` | Readable stack traces in bug reports; size is irrelevant at ~1–2k lines. |
| `sourcemap` | `false` | Nothing to map without minification. |
| `define` | `__ARCANUM_CLI_VERSION__` from `package.json` | `--version` needs no runtime file read or second JSON import. |
| `metafile` | `true` | Feeds the surface check below. |

**Build-time surface check.** After building, `build.mjs` reads the metafile and **fails** if any bundled input lies outside `cli/lib/**` plus the shared-surface files. It reads that list from core's ESLint shared-surface block (the authoritative declaration), so there is no third copy. This complements the specifier-based lint rule with a check on resolved paths, at no new dependency.

**`cli/package.json` wiring.** `"build": "node scripts/build.mjs"`; `"prepack": "yarn build"` (so `npm publish`/`npm pack` always ship a fresh bundle); `files: ["bin/", "dist/", "README.md"]`. The CI `cli` job and the release publish job both run `yarn build` — the shared build script from [CI coupling](#ci-coupling).

**Specs.** Regular Jasmine specs and c8 coverage run against the **source** (`cli/spec` → `cli/lib` → `core/lib` via relative imports). A few **smoke specs** run the built `dist/arcanum.mjs` through `cli/bin/arcanum`: `--version`, a `set`/`get` round-trip in a temp repo, and an unknown-key exit `3` (proves the registry was inlined). They require `yarn build` first.

**To verify during implementation (`node`).** `KeyRegistry.js`'s `import keys from './keys.json' with { type: 'json' }` is inlined by `esbuild`, but inside **core** it runs unbundled on Node 22.13. If that Node still prints an `ExperimentalWarning` for JSON modules (they were marked stable around 22.12/23.1), the stderr line would break the dispatcher's output contract. The floor CI job would also catch it. **Fallback:** rename `keys.json` → `keys.js` with `export default [...]` — transparent to `esbuild`, and the array-of-entries decision in [Key Registry](../specs/arcanum-cli/key-registry.md) is unaffected.

### CI coupling

**Decision: the CLI job always runs, on every push — no path filters.**

Why:

- **Precedent.** The CircleCI `test` workflow (`test`, `checks`, `mod-checks`) has no path filtering; every job runs on every branch push, docs-only commits included.
- **Cost of path filters on CircleCI.** They need the `path-filtering` orb, a setup workflow generating a continuation config, and "dynamic config" enabled in project settings — a restructuring of the whole `.circleci/config.yml` for one job.
- **Silent-skip failure mode.** The shared surface is really defined by the import graph `esbuild` follows; a path filter is a second, hand-maintained copy of that list. Add a file to the surface without updating the filter and the CLI job quietly stops covering it, with CI staying green.
- **Cheap job.** Yarn install, lint, a ~1k-line `esbuild` build and the CLI specs — on the order of the existing `checks` job.

**Shape.**

- A new **`cli` job in the `test` workflow**, owned by `infra` (whose scope gains `.circleci/` per [Packaging and Release](../specs/arcanum-cli/packaging-and-release.md)). Same image as `test`/`checks` (`darthjee/circleci_node:0.2.1`), `working_directory: ~/project/cli` (the full-repo checkout provides `core/lib`), tag pushes ignored like its siblings. Steps: `yarn install --frozen-lockfile` → lint → **build the bundle** → CLI specs.
- **At least one smoke spec runs against the built bundle**, not only the source — e.g. `node <bundle> --version` and a `set`/`get` round-trip in a temp repo — so bundling breakage (a JSON import not inlined, an unresolvable import) is caught.
- **The bundle is never committed.** It is built in CI and again at publish, so no freshness check is needed. The release pipeline's npm publish job uses **the same build script** as the `cli` job, so the tested artefact is the shipped artefact.
- **The reverse direction is already covered.** The shared-surface `no-restricted-imports` rule lives in `core`'s ESLint config, so the existing `checks` job enforces it on every `core` edit.
- **Revisit** path filtering only if the `cli` job's runtime grows noticeably — as a separate `infra` issue, outside epic #767.

**Spec consequences.** In `shared-config-logic.md`: rewrite the "CI coupling" guardrail with this decision and close the CI-detection open point. Cross-link `packaging-and-release.md` for the shared build script used by the publish job.

### Shared agent-email helper

**Findings.**

- The two-key, per-tier resolution already lives in `ConfigChain#read(repoPath, 'git', 'agents.<agent>', 'email')`, the native twin of `config_chain_read`. What is duplicated is only the thin wrapper (`null` → model-email fallback, `{agent}` substitution): three native `_agentEmailGet` copies (`AutoNewIssueCommitIssue`, `AutoPlanIssueCommitPlan`, `AutoFixIssueCommitChange`) plus `agent_email_get` in `arcanum/_lib/agent_email.sh`.
- The CLI additionally needs **provenance** (tier and key, e.g. `global git.email`), which none of them exposes.
- **Shell/native divergence on `""`.** Both stop the chain at an explicit empty string, but the shell then strips `jq -c`'s quotes, sees an empty value and falls back to the **model email**, while native returns `""` — an empty co-author email.

**Decisions.**

1. **`ConfigChain#readWithSource(repoPath, namespace, ...keys)`** returns `{ value, tier, file, key }` or `undefined`; `read` becomes a thin wrapper over it. One resolution loop, so value and provenance can never drift. It also lets `arcanum config get` show provenance generically.
2. **New shared-surface file `core/lib/utils/config/AgentEmail.js`**, importing only `ConfigChain`:
   - `resolve(repoPath, agent)` → `{ email, raw, tier, key } | undefined` (`raw` = value before `{agent}` substitution) — the CLI's entry point;
   - `get(repoPath, agent, modelEmail)` → `string` — `resolve` plus the `modelEmail` fallback, with the same verbatim `() => agent` replacer; replaces the three `_agentEmailGet` copies.
   - Added to the shared surface: core's ESLint `files` list, the CLI-side allowlist, and the bundle's metafile check.
3. **Align native to the shell on `""`** (confirmed: an empty string is *not* an opt-out of the agent co-author line; it falls back to the model email). A resolved empty string means "no email": `get` returns `modelEmail`; `resolve` still reports the tier/key with `email: undefined`, so the CLI can show e.g. `(model default)  (empty at repo: git.agents.node)`. This is a deliberate native behaviour fix (today a native commit would get an empty co-author email) — covered by a spec and called out in the release notes.
4. **The shell side stays.** `agent_email.sh` keeps serving the shell engine. Parity is enforced by one shared fixture table (tier setups → expected email, including `null`, `""`, generic-beats-specific across tiers, `{agent}` substitution) exercised by both the shell and the native specs.
5. **Scope and ownership.** Implementation is `node`'s, in the epic #767 implementation issues — #773 only records the design in the spec. The four `_modelCoauthorOmitted` copies (including `MergeBodyResolver`) are the same kind of duplication but are not needed by the CLI, so they stay off the surface and out of scope.
6. **Edge case — non-string values** (hand edits only). Native stringifies with `String(value)`; the shell prints the `jq -c` form. The [Key Registry](../specs/arcanum-cli/key-registry.md) types `git.email` and `git.agents.*` as strings, so the CLI never writes one. Documented as unsupported, not guaranteed identical.

**Spec consequences.** In `shared-config-logic.md`: close the agent-email open point with this design and add `AgentEmail.js` to the surface list. In `shortcuts-and-setup.md#resolution`: point at `AgentEmail#resolve`/`ConfigChain#readWithSource`, and add the `""` → `(model default)` row.

### Remaining concerns

- **Scope boundaries.** In: the spec docs — `shared-config-logic.md`, plus the consequential edits in `command-surface.md` and `shortcuts-and-setup.md` listed above, and the index line. Out: all code (implementation issues under epic #767), the lock fix itself (#807), and the npm-package extraction (future work).
- **Alternatives considered** (to add to the spec): path-filtered CI (CircleCI dynamic-config cost, silent-skip risk); a CLI-only stricter lock (would not exclude skills); keeping `BooleanKeyConfig` on the surface (it is the `config.sh` dispatch layer, and drags `DispatchFailure` in); a path-resolving lint via `eslint-plugin-import` (new devDependency; the metafile check covers resolved paths instead).
- **Edge cases.** Captured in the sections above: non-object intermediate (→ `7`), `""` and non-string agent emails, JSON-module warning on Node 22.13, mixed old/new lock writers.
- **Backward compatibility.** Dispatcher output and exit codes stay byte-identical (`ConfigError extends Error`, same messages). One deliberate change: native `""` agent email → model email, aligned with the shell. #807 is safe alongside old-protocol writers.
- **Testing strategy.** Source specs with c8; smoke specs on the built bundle; the metafile surface check; shell/native agent-email parity fixtures; a spec per `ConfigError` code; CI on the default image plus the Node 22.13 floor job.
- **Performance & security.** With #807, an uncontended lock is immediate instead of a fixed 1s. The bundle is unminified with zero runtime dependencies (supply-chain surface limited to the `esbuild` devDependency); the CLI-side lint and the metafile check stop the bundle from silently pulling in more of `core/lib`.
- **Migration needed?** No — no config or state file changes shape.
- **Script-driven interaction?** Not applicable (docs only, no skill prompts).
- **New root-level folder?** None introduced here. `cli/` (owned by `client`) is decided in [Packaging and Release](../specs/arcanum-cli/packaging-and-release.md) and the index; `dist/` lives under `cli/`.
- **Cross-links.** Update the index's description of this part ("`ConfigError` decoupling" → "`ConfigError` contract"); add #807 as a dependency; make the CI-coupling text reference the index's Node 22.13 floor job. The index keeps no consolidated open-points list, so nothing to update there.

## Benefits

- The CLI reads and writes config exactly like the skills, through a small, mechanically enforced shared surface (lint on both sides plus a resolved-path bundle check).
- No change to the internal dispatcher's output or exit codes; the CLI gets precise, documented exit codes for lock timeouts and file errors.
- A latent lost-update bug in the shared lock protocol is identified and fixed (#807) before the CLI starts writing concurrently with skills.
- One agent-email resolution for commits and the CLI, fixing a native `""` bug along the way.
