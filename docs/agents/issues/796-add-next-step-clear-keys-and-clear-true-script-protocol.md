# Issue: Add next_step.clear.* keys and CLEAR=true script protocol

## Description
Part of Epic #790. Add the `next_step.clear.<skill>` config keys and the script-side
protocol that reports them. Nothing clears context yet — that is the skill-side
handling sub-issue; this one only makes the decision available.

## Problem
With `next_step.auto.<skill>` on, a pipeline run chains enhance-issue → discuss-issue → auto-plan-issue → `/loop /auto-resolve-issue` in one session, so each later stage inherits every earlier stage's context. Epic #790 adds an opt-in "clear context at the hop" per skill; the decision has to be configurable and reported by the scripts before any skill can act on it (#798).

## Expected Behavior
- [ ] Keys documented with type/default/chain and the "only with auto" note.
- [ ] `CLEAR=true` printed right after `AUTO=true` only when both keys are JSON `true`
      (shell and native, parity spec covers it); output unchanged otherwise.
- [ ] Notice names both keys when clearing.
- [ ] `auto_next.sh` forwards `CLEAR=true` with `CHAIN=yes` (shell and native).
- [ ] `/init-claude` offers the clear keys in the same table as the auto keys (one
      row per skill, `Auto` and `Clear` columns), flags a clear-without-auto cell as
      inactive, and writes only edited cells.
- [ ] `set_next_step_clear.sh` writes `next_step.clear.<skill>` to the repo config and
      prints `NEXT_STEP_CLEAR=<skill>=<value>`; auto and clear commands share one base
      class; `set_next_step_auto.sh` behavior and specs unchanged.
- [ ] Specs cover edge cases 1–6 and 9 (shell and native): auto-off, mixed tiers,
      local `false` shadowing, non-boolean, failing clear read keeping the auto result,
      manual yes, `CHAIN=no`.
- [ ] No migration added.
- [ ] Existing next-step specs (parity, unit, engine-dispatch) pass unchanged; new
      cases cover `CLEAR=true` and the two-key notice.
- [ ] Script header contracts and `skill-finish.md` document `CLEAR=true`.

## Solution

### Scope

- **Docs** — document `next_step.clear.enhance-issue`, `next_step.clear.discuss-issue`
  and `next_step.clear.auto-plan-issue` in `docs/guides/arcanum-repo-config.md`, same
  table format as `next_step.auto.*`. State up front that a clear key only does
  something when the matching `next_step.auto.<skill>` is `true`. Boolean-strict
  (only JSON `true` enables); an explicit `false` shadows a lower tier;
  `/arcanum-check-config next_step.clear.<skill>` reports the resolved tier.
- **`next_step_prompt.sh --auto-key <skill>`** (shell twin `next_step_prompt_shell.sh`
  and native `core/bin/arcanum next-step-prompt`): when auto mode fires, also read
  `next_step.clear.<skill>` via `config_chain_read`. When `true`, print `CLEAR=true`
  on its own line right after `AUTO=true`; otherwise output is unchanged. Same with
  `--no-prompt`. The stderr notice names both keys:
  `auto-continuing: <cmd> (next_step.auto.<skill>=true, next_step.clear.<skill>=true)`.
  The clear key is never consulted when `--auto-key` is omitted or auto does not fire.
- **`auto-plan-issue/scripts/auto_next.sh`** (shell + native): forward `CLEAR=true`
  alongside `CHAIN=yes`. Update its header contract.
- **`/init-claude`** `setup_auto_next.md`: offer the new keys next to the auto keys,
  written to the repo config.
- No `/arcanum-migrate` migration (see "Migration" below).

### init-claude write script

`/init-claude` writes the clear keys through a **sibling entrypoint over a shared
base**, rather than renaming or flag-extending the existing auto writer:

- Extract the body of `core/lib/commands/init-claude/InitClaudeSetNextStepAuto.js`
  into a parametrized base (e.g. `InitClaudeSetNextStepKey`, taking the key prefix
  and the output tag). Same `SKILLS` list, same strict `true|false` validation, same
  `RepoConfigWriter.write` call into `.claude/configuration/arcanum-repo-config.json`.
- `InitClaudeSetNextStepAuto` becomes a thin subclass: key `auto.<skill>`, output
  `NEXT_STEP_AUTO=<skill>=<value>` — behavior, entrypoint and specs unchanged.
- New `InitClaudeSetNextStepClear`: key `clear.<skill>`, output
  `NEXT_STEP_CLEAR=<skill>=<value>`.
- New shim `init-claude/scripts/set_next_step_clear.sh <repo_path> <skill> <true|false>`,
  a native-only `engine_dispatch` call like `set_next_step_auto.sh`.
- Register `init-claude-set-next-step-clear` in `core/lib/core/commands.js` and in
  `arcanum/_lib/migration-status.json` (`docker`, same as the auto command).
- Specs: a bin spec and a lib spec for the clear command (mirroring
  `initClaudeSetNextStepAuto_spec.js` and `InitClaudeSetNextStepAuto_spec.js`), a
  spec for the shared base, and the `commands_spec.js` registration.
- Docs: add the new command next to the auto one in
  `docs/agents/architecture/script-engine.md` and
  `docs/agents/architecture/shared-state-and-configuration.md`.
- `setup_auto_next.md` calls `set_next_step_clear.sh` for edited clear rows and
  `set_next_step_auto.sh` for edited auto rows.

Rejected: a single renamed `set_next_step.sh <auto|clear> …` (churns a shipped
entrypoint and its specs/docs for no gain) and a `--kind clear` flag on
`set_next_step_auto.sh` (the script name would lie).

### init-claude interaction (`setup_auto_next.md`)

Stays model-driven (no `/dev/tty` script, so no exit-4 fallback involved); the
existing read → table → confirm-loop → write-edited-rows shape is widened:

- **Step 1 — read:** six `jq` reads — the three `.next_step.auto["<skill>"]` plus
  `.next_step.clear["<skill>"] // false`. Anything other than `true` is `false`.
- **Step 2 — one table, 3 rows, two value columns:**

  | Skill | Tier | Auto | Clear | Description |
  | --- | --- | --- | --- | --- |
  | `enhance-issue` | repo (committed) | `<bool>` | `<bool>` | … |
  | `discuss-issue` | repo (committed) | `<bool>` | `<bool>` | … |
  | `auto-plan-issue` | repo (committed) | `<bool>` | `<bool>` | … |

  A `Clear` cell that is `true` while `Auto` is `false` renders as
  `true (inactive: auto is off)`. Allowed, not blocked or auto-corrected; noted once
  below the table.
- **Notes below the table:** `Clear` drops the conversation context before the
  chained command runs (how depends on the mod, #797/#798); `/arcanum-check-config`
  hint names both `next_step.auto.<skill>` and `next_step.clear.<skill>`; the
  "override via `/arcanum-migrate`'s auto-next migrations" sentence applies to the
  auto keys only — until the clear-key migrations land with #798, other tiers are
  set by editing those config files by hand (#798 updates this sentence).
- **Step 3 — confirm loop:** the user edits individual cells (e.g. "discuss-issue
  clear → true"); unchanged semantics otherwise.
- **Step 4 — write:** only edited cells, in table order, row by row, auto before
  clear: an edited Auto cell → `set_next_step_auto.sh`, an edited Clear cell →
  `set_next_step_clear.sh`. Untouched cells are never written. A non-zero exit is
  reported and the rest continue.
- **Step 5 — report:** one line per written key (e.g.
  `next_step.clear.discuss-issue` set to `true` in
  `.claude/configuration/arcanum-repo-config.json`).

### Migration

None in this issue. The clear keys default to `false` (missing = `false`), so no
existing repo needs a change, and until #798 handles `CLEAR=true` nothing actually
clears — an opt-in prompt now would enable a no-op setting.

The opt-in migrations land with #798 (or a small follow-up under #790): three
`arcanum/migrations/repos/next/` entries mirroring `2.0.0/001`–`003`
(`applies_to` `local`, `repo`, `global`), prompting `[Y]es/[N]o/[S]kip` per skill for
`next_step.clear.<skill>`, each prompt noting it has no effect unless
`next_step.auto.<skill>` is `true`; silent no-op without a TTY.

These must be migrations, not `/arcanum-update` steps: `/arcanum-update` only
reconciles the arcanum install tree, never the consuming repo's config, its local
state, or the global config.

### Backward compatibility

Every existing consumer parses by line prefix, so the change is safe:

| Consumer | Parsing | Effect of `CLEAR=true` |
| --- | --- | --- |
| `auto_next_shell.sh` | `sed -n 's/^CHOICE=//p' \| head -n 1` | ignored |
| `AutoPlanIssueAutoNext.js` | `find(line => line.startsWith('CHOICE='))` | ignored |
| Skill steps (enhance publish, discuss ×2, plan-issue, split push, create-issue) | model reads `CHOICE=`/`AUTO=` | extra line, ignored until #798 |
| `auto-plan-issue/steps/run.md` (`auto_next.sh`) | model reads `CHAIN=yes`/`CHAIN=no` + `REASON=` | only follows `CHAIN=yes`; ignored until #798 |
| stderr notice | nothing parses it; specs compare it exactly | changes only when the clear key is `true` |

Rules:

1. **Additive only.** No existing line changes text or order. `CLEAR=true` goes right
   after `AUTO=true` (`next_step_prompt.sh`) / `CHAIN=yes` (`auto_next.sh`), and never
   appears with `CHOICE=no`/`chat`, `CHAIN=no`, or without `--auto-key`.
2. **Byte-identical when the clear key is unset or `false`:** stdout, stderr notice and
   exit code. The existing parity, unit and engine-dispatch specs pass unchanged —
   that is the proof.
3. **No install skew:** scripts and skill steps ship in the same install. Setting
   `next_step.clear.*` before #798 lands only emits the line; skills ignore it, so it
   is a no-op until #798.
4. **Contract docs:** update the output sections of the `next_step_prompt_shell.sh`
   header, the `auto_next_shell.sh` header and `docs/agents/architecture/skill-finish.md`.
   Skill-step prose is left to #798.

### Edge cases

| # | Case | Behavior |
| --- | --- | --- |
| 1 | `clear=true`, auto off | Clear key never read; no `CLEAR`, notice unchanged; `--no-prompt` still prints only `CHOICE=no`. |
| 2 | Keys resolve from different tiers (e.g. auto global, clear repo) | Each key walks local → repo → global independently; `CLEAR=true`. |
| 3 | `clear=false` local, `true` repo | Local shadows; no `CLEAR`. |
| 4 | Non-boolean clear value (`"true"`, `1`, `null`) | Disabled — strict, like auto. |
| 5 | Clear read fails (malformed JSON, `jq` error) | Treated as disabled; the auto result stands (`CHOICE=yes`, `AUTO=true`, no `CLEAR`, exit 0). A clear-read failure never turns an auto-continue into an error or a prompt. |
| 6 | Manual `[Y]es` (TTY) or `Yes` in the `AskUserQuestion` fallback | No `CLEAR` — clearing applies only to automatic hops; a present user can `/clear` themselves. |
| 7 | Several `--command`s | Not combined with `--auto-key` today (split-issue); rule stays generic — tied to auto firing, notice names `COMMANDS[0]`. |
| 8 | Epic in enhance-issue | `--auto-key` omitted for Epics, so no `CLEAR`. |
| 9 | `auto_next.sh` → `CHAIN=no` (branch, config, push) | No `CLEAR`; forwarded only with `CHAIN=yes`. |
| 10 | Nested `auto-plan-issue` | Never calls `auto_next.sh`; unchanged (relay is #798). |
| 11 | `--auto-key` with an unlisted skill | Reads `clear.<skill>` generically, no allow-list; `/init-claude` and docs cover only the three skills. |

## Benefits
- Ships the config surface and script contract independently of the mod (#797) and skill handling (#798).
- Purely additive: existing output and specs stay byte-identical when the keys are unset.
