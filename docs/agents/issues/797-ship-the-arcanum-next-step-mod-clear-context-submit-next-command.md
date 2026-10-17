# Issue: Ship the arcanum-next-step mod (clear context + submit next command)

## Description

Part of Epic #790; depends on #800 (create the `mod` agent). Ship `arcanum-next-step`, a Claude Code mod that lets a skill
truly clear context at a next-step handoff. Spike #791 showed that only the user or a
mod can run `/clear`; a throwaway mod running `$.command.run({command: "clear"})`
then `$.prompt.submit(...)` passed the codeword test.

This is **optional** for #790: without the mod, hops fall back to `ScheduleWakeup` +
asking the user to type `/clear`.

## Problem

Automatic next-step hops (`next_step.auto.*`) chain enhance → discuss → plan →
resolve in one session, so context keeps growing across stages. #796 added the
`next_step.clear.*` keys and the `CLEAR=true` protocol, but nothing can act on it yet:
spike #791 showed that neither a skill, the model, settings hooks nor a
`ScheduleWakeup` restart can run `/clear` — only the user, or a Claude Code mod
through `$.command.run`.

## Expected Behavior

- [ ] Mod validates (`claude plugin validate`), type-checks (`tsc`) and its
      `*.test.ts` suite passes (`claude plugin test`), all via `make mod-check`; CI
      runs as much of it as works headless.
- [ ] Calling `mcp__arcanum-next-step__handoff` clears context and then runs the given
      skill command (codeword test passes).
- [ ] `scripts/build_release_zip.sh --list` exists and a `core/spec` spec asserts the
      mod's files are in the would-be `MANIFEST`.
- [ ] A fresh install auto-loads it with no extra step.
- [ ] `handoff` rejects any command outside the allowlist (non-arcanum commands,
      built-ins, `/clear`, `/loop` wrapping a non-arcanum command), covered by the
      mod's `*.test.ts`.
- [ ] README / docs describe the mod, its tool contract, the allowlist, the optional
      `ask` rule and the opt-out.

**To verify during implementation:**

- The codeword test (#791) **through the tool path** — the spike fired from a
  `prompt.submit` hook, not a tool handler. The test calls `handoff` with a **real
  skill command** (e.g. `/arcanum-check-config next_step.auto`), not a plain
  question, confirming that `$.command.run` runs skill commands and not only
  built-ins.
- Whether a `handoff` call raises the **permission prompt** in the default permission
  mode (the auto-load probe's session did not prompt for its `ping` tool, but that may
  reflect the session's permission mode). Record the answer in the PR so #798 knows
  whether to ship the grant migration.

## Solution

### Design

- **Contract:** the mod registers one tool; see [Tool contract](#tool-contract). The
  tool's presence doubles as mod detection — no state file.
- **Behavior:** on call, store the command and return immediately; once the turn
  ends, run `/clear`, then run the command. On failure, toast the error.
- **Packaging:** top-level repo folder `arcanum-next-step/`
  (`.claude-plugin/plugin.json`, `hooks/hooks.json`, `hooks/register.ts`). Claude
  Code auto-loads a plugin folder inside a skills folder, which is where arcanum
  installs — so the release zip, `curl | bash`, git installs and `/arcanum-update`
  carry it with no installer change and no migration.
- **Always loaded, inert:** it acts only when a skill calls its tool. Document the
  opt-out (leave `next_step.clear.*` unset, or delete the folder).

### Scope

**In scope:**

| Area | Deliverable | Owner |
| --- | --- | --- |
| Mod | `arcanum-next-step/`: `.claude-plugin/plugin.json`, `hooks/hooks.json`, `hooks/register.ts`, `types/index.d.ts` (`$.state` contract), `*.test.ts` — implementing the tool contract, allowlist and edge-case handling below | `mod` |
| Mod docs | `arcanum-next-step/README.md`: tool contract (stability rule), allowlist, optional `ask` rule, opt-out (leave `next_step.clear.*` unset, or delete the folder), headless / double-install notes | `mod` |
| User docs | A short root `README.md` section: what the mod is, that it ships and auto-loads and is inert until called (until #798 nothing calls it), the custom-install-path caveat, link to the mod README | `architect` |
| Packaging | `scripts/build_release_zip.sh --list` | `scripter` |
| Packaging spec | `core/spec` spec asserting the mod's files are in the would-be `MANIFEST` | `node` |
| Checks | `make mod-check` target; CircleCI `mod-checks` job | `infra` |
| Manual | The manual checks under [Testing strategy](#testing-strategy), results recorded in the PR | implementer |

**Out of scope:**

- Creating the `mod` agent + roster / folder-structure rows → **#800** (lands first).
- Any skill calling `handoff` (the "Clearing" subsection, the `AUTO_CLEAR` relay,
  offer-step pointers) → **#798**.
- `next_step.clear.*` opt-in migrations and the `/init-claude` override-sentence
  update → **#798**.
- The conditional `handoff` permission-grant migration → **#798** (depends on the
  manual check).
- The `docs/guides/arcanum-repo-config.md` note that clearing needs the mod or the
  wakeup fallback → **#798**, when the behavior lands.
- `clear_context` in `auto-fix-all` / `monitor-issues` → **#795** (may reuse
  `handoff`).
- Marketplace distribution — dropped (auto-load verified). Installer changes — none.

### Tool contract

| Aspect | Decision |
| --- | --- |
| **Name** | Plugin `arcanum-next-step`, tool `handoff` → full name `mcp__arcanum-next-step__handoff`. Registered on `session.start`, **not deferred** (visible on turn one, no `ToolSearch`). |
| **Referencing** | Skills (#798) always name the tool by its **full** name, never "the handoff tool", so it cannot be confused with another plugin's `handoff`. The `mcp__<plugin>__` prefix already rules out a real name clash. |
| **Input** | `{ command: string }`, required — exactly the `COMMAND=` line `next_step_prompt.sh` printed (e.g. `/loop /auto-resolve-issue 796`). No other fields: the tool always clears. |
| **Validation** | `command` must start with `/`; it is split at the first space into name and args (`loop` + `/auto-resolve-issue 796`), and must pass the [allowlist](#security-and-performance). Anything else → error result, nothing scheduled. |
| **Result** | Returned immediately: `scheduled: will /clear then run <command> once this turn ends — end your turn now without further output`. The tool description says the same. |
| **Timing** | Nothing runs inside the tool call. The mod keeps **one** pending command; on `turn.complete` it defers (`$.clock.after(0)`, outside the hook) and runs `$.command.run({ command: 'clear' })`, then `$.command.run({ command: <name>, args: <args> })`. |
| **Why `command.run`, not `prompt.submit`** | `PromptSubmitArgs` omits `command`, so a submitted `/discuss-issue 797` would arrive as plain text, not run as a command. The #791 spike only submitted a plain question. |
| **Second call in a turn** | Rejected with an error result (`a handoff is already pending: <command>`); the first stays scheduled. |
| **Failure** | A failure in either `command.run` toasts `arcanum-next-step: <error>` and drops the pending command. The context is left as it is (intact, or cleared without the next command); the user re-types the command. |
| **Detection (#798)** | The skill checks whether `mcp__arcanum-next-step__handoff` is in its tool list: present → level 1; absent → level 2/3. No version handshake. |
| **Stability** | Documented in `arcanum-next-step/README.md`. Renaming the tool or changing its schema is a breaking change for #798's skill text. |

### Edge cases

`turn.complete` carries `reason` (`answer` / `aborted` / `refusal` / `error`) and
`agentId`; `tool.call` carries `agentId` (absent on the main loop).

| # | Case | Handling |
| --- | --- | --- |
| 1 | Model keeps talking after the call (e.g. prints the closing report) | Harmless — the mod waits for `turn.complete`. #798 still makes the handoff the skill's last action. |
| 2 | User interrupts the turn (Esc) after the call | `reason: 'aborted'` → handoff **dropped**, toast `handoff cancelled`. |
| 3 | Turn ends in `refusal` / `error` | Dropped + toast. Only `reason: 'answer'` fires the handoff. |
| 4 | Tool called from a subagent (`agentId` set) | **Denied** with an error result — only the main loop may hand off. |
| 5 | A subagent's `turn.complete` while a main-loop handoff is pending | Ignored; only the main loop's end (no `agentId`) fires it. |
| 6 | User queued a prompt during the turn | Handoff **cancelled** + toast — the user's input wins. The mod watches user-origin `prompt.submit` while a handoff is pending. |
| 7 | Mod hot-reloads mid-turn (e.g. `/arcanum-update` rewrites it) | The pending command lives in `$.state` (declared in `types/index.d.ts`), which survives reloads. |
| 8 | Headless `claude -p` (process may exit before the handoff runs) | Deny the tool in non-interactive sessions if `$` exposes that; otherwise document "not supported headless". **Check during implementation.** |
| 9 | Target command does not exist (e.g. skill not installed) | `command.run` fails after `/clear` → toast `arcanum-next-step: <error>` naming the command to re-type. |
| 10 | Two installs load the mod (user `~/.claude/skills` + project `.claude/skills`) | Unknown whether both load under the same name (a call could fire twice). **Check during implementation** with a second copy; if both load, document "install in one place". |
| 11 | Session ends before the turn completes | Nothing happens — `$.state` is per session. |
| 12 | Command with extra whitespace (`/loop  /auto-resolve-issue 796`) | Trim, split at the first whitespace run; args passed through verbatim. |

### Security and performance

**Threat:** a prompt injection in something the model reads (issue body, PR comment,
fetched page) asks it to call `handoff`. Running an arcanum skill is nothing new (the
Skill tool already can), and a cleared context is recoverable (transcript on disk,
`/resume`). The real risk is **privilege escalation**: `$.command.run` runs a command
"as if the person typed it", so an unrestricted `handoff` would let the model run
built-ins it otherwise cannot (`/plugin install …`, `/permissions`, `/config`,
`/logout`, `/mcp`, `/hooks`) or other plugins' commands.

**Allowlist (enforced by the mod):**

- The command name must be an **arcanum skill**: a sibling folder of the mod, in the
  same install, that contains a `SKILL.md`. The mod reads its install's skills folder
  once at `session.start` — no hardcoded list, new skills are covered automatically.
- **`/loop`** is the single exception, allowed only when its first argument is itself
  an allowlisted skill (`/loop /auto-resolve-issue 796`).
- `/clear` is never accepted as `command` — the mod issues it itself.
- Anything else → error result `handoff only runs arcanum skills`, nothing scheduled.

**Opt-in stays skill-side.** The mod does not read `next_step.clear.*`; the skills
(#798) decide when to call it. The allowlist caps the worst case at "an arcanum skill
ran after a clear".

**Per-call approval (optional):** the README documents that a user who wants a click
per handoff can add an `ask` permission rule for `mcp__arcanum-next-step__handoff`.
Off by default — it would stall unattended chains.

**Performance:** negligible. One small tool schema (~100 tokens) sits in every
session's context, even for users who never opt in — the price of presence-as-detection.
The `turn.complete` / `prompt.submit` hooks return immediately when nothing is pending.

### Auto-load and distribution (verified)

A throwaway probe mod (`arcanum-next-step-probe/`, registering a `ping` tool on
`session.start`) was placed in a live install at `~/.claude-favini/skills/`
(`CLAUDE_CONFIG_DIR=~/.claude-favini`, Claude Code build 2.1.302) and a fresh session
was opened:

- **Auto-load works from a non-default config dir.** The tool
  `mcp__arcanum-next-step-probe__ping` was available and answered `pong`.
- **No trust/approval prompt** appeared on first load.
- **Not deferred.** The model called the tool directly, with no `ToolSearch` first.

**Decision:** keep the skills-folder packaging — `arcanum-next-step/` ships as a
top-level folder of the release, and the release zip, `curl | bash`, git installs and
`/arcanum-update` carry it with no installer change. The marketplace fallback
(`.claude-plugin/marketplace.json` + `/plugin install`) is **dropped**.

Per the mod docs, auto-load covers the user skills folder and a project's
`.claude/skills/<name>`. An install to a custom path outside any skills folder will
not auto-load the mod; that case falls back to the mod-free level (see #790) and is
documented, not worked around.

### Folder ownership

`arcanum-next-step/` is a new root-level folder, owned by a **new `mod` specialist
agent** (owns `arcanum-next-step/` and any future top-level mod folder).

- **Why not `node`:** its conventions (Jasmine, c8, ESLint flat config, shell/native
  byte parity, `core/bin/arcanum` routing) do not apply — a mod is TypeScript running
  in Claude Code's own environment (no Node, no DOM, everything through `$`), checked
  with `claude plugin validate` / `claude plugin test` / `tsc`.
- **`mod`'s conventions:** the mod API (`$`, hooks, `.catch` on guarding hooks),
  `$.state` contracts in `types/index.d.ts`, the `plugin-authoring` skill as
  reference, `claude plugin validate`/`test` + `tsc`, and the tool-contract stability
  rule ([Tool contract](#tool-contract)).
- **Boundaries:** `Makefile` targets stay `infra`'s; skills that call the tool are
  `skill-writer`'s (#798).
- **Created by #800 (dependency).** `.claude/agents/mod.md`, the `mod` row in
  `docs/agents/architecture/agent-roster-and-delegation.md` and the
  `arcanum-next-step/` row in `docs/agents/folder-structure.md` ship in #800, which
  must land before this issue's mod code.
- **Name:** `mod` (the plugin-authoring skill's term) rather than `plugin`, which
  is ambiguous with Claude Code marketplace plugins.

### Testing strategy

**1. Mod checks (owner `mod`).**

- `claude plugin validate arcanum-next-step` — manifest, hooks, `.catch` on every
  guarding hook.
- `tsc -p arcanum-next-step` — type-check against the engine's types.
- `claude plugin test arcanum-next-step`, with `*.test.ts` covering:
  - **contract:** `handoff` registered on `session.start`, not deferred, input
    `{ command }`;
  - **allowlist:** arcanum skill accepted; `/loop <arcanum skill>` accepted; built-ins
    (`/plugin`, `/config`), `/clear`, other plugins' commands, `/loop <non-arcanum>`
    and input without a leading `/` denied;
  - **timing:** nothing runs during the call; on `turn.complete` with
    `reason: 'answer'` → `command.run` `clear`, then the command, in that order;
  - **cancellations:** `aborted` / `refusal` / `error` turn end; a queued user prompt;
    a second call (rejected); a call from a subagent (denied); a subagent's
    `turn.complete` (ignored);
  - **failure:** a `command.run` rejection → toast, pending slot cleared;
  - **reload:** the pending command survives in `$.state`.

**2. Where they run (owner `infra`).**

- **Local:** a new `make mod-check` target running all three — the gate `mod` uses.
- **CI:** a new CircleCI `mod-checks` job installing the Claude Code CLI
  (`npm i -g @anthropic-ai/claude-code`) and running the same three. Whether
  `validate` / `test` / type generation work headless without a credential is
  **verified during implementation**; if not, CI runs what does (at least
  `validate`) and `make mod-check` stays the full gate, stated in the PR.

**3. Packaging spec (owners `scripter` + `node`).**

- `scripts/build_release_zip.sh --list` prints the would-be `MANIFEST` without
  zipping.
- A `core/spec` spec runs it and asserts the mod's files are listed (nothing under
  `arcanum-next-step/` excluded). No `zip` and no release needed, so it runs in the
  normal `test` job.

**4. Manual checks (PR description, results recorded).**

- Codeword test through the tool path: plant a codeword, call `handoff` with
  `/arcanum-check-config next_step.auto` → the skill runs, the codeword is gone.
- Default-mode permission prompt (answer feeds #798).
- Headless `claude -p` behavior (edge case 8).
- Two installs loading the mod (edge case 10).
- A fresh `curl | bash` install auto-loads the mod.

### Migration

**None for this issue.** Migrations under `arcanum/migrations/repos/` change the
consuming repo; the mod lives in the install tree. `updater.sh` already adds new
`MANIFEST` files, so `/arcanum-update` brings `arcanum-next-step/` to existing
installs; git installs get it on checkout, fresh installs from the zip.

**Permission grant → #798 (conditional).** If a `handoff` call raises Claude Code's
permission prompt in the default permission mode (see To verify), every auto-clear hop
would stall on a click. In that case #798 ships an **opt-in local migration** granting
`mcp__arcanum-next-step__handoff` in `.claude/settings.local.json` (precedent:
`arcanum/migrations/repos/0.17.2/002`, via `arcanum/_lib/permission_grant.sh`) plus the
matching `/init-claude` offer, alongside its `next_step.clear.*` opt-in migrations.
Declining the grant is the per-hop-click (`ask`) behavior from
[Security and performance](#security-and-performance).

### Alternatives considered

- **Handoff state file** watched by the mod (#791's first sketch) — rejected: needs a
  file contract and cleanup; the tool's presence already doubles as detection.
- **`$.prompt.submit`** for the next command — rejected: it cannot run slash commands
  (`PromptSubmitArgs` omits `command`).
- **Marketplace plugin + `/plugin install`** — rejected: skills-folder auto-load is
  verified, no extra install step needed.
- **Session-to-session handoff** (#791 Q4) — rejected: needs a second idle session on
  the same account, and acting on the message is up to the model.
- **Wakeup + user-typed `/clear` only** — kept as the mod-free fallback level (#798),
  not the main path: it needs the user to act.

### Backward compatibility

Fully additive:

- Existing installs gain one folder via the normal update path (`updater.sh` copies
  the release tree; git installs check it out). No update script or installer change.
- Every session gains one small tool schema (~100 tokens). Nothing calls the tool
  until #798, so behavior is unchanged.
- After `/arcanum-update`, the mod loads in **new** sessions; a session already open
  when the folder appeared may not pick it up (harmless — nothing calls it yet).
- Deleting the folder opts out but is **re-added by `/arcanum-update`**; the README
  names leaving `next_step.clear.*` unset as the durable opt-out.

### Script-driven interaction

Not applicable: the mod never prompts — its only outputs are tool results and
toasts. The TTY-first rule concerns skill scripts; the `next_step_prompt.sh` side is
#796 / #798.

## Benefits

- Automatic hops can truly start each stage from a clean context, keeping later
  stages fast, cheap and unaffected by earlier conversation.
- Zero-install: ships and auto-loads with arcanum itself; inert until a skill calls it.
- A narrow, allowlisted tool — no new way for the model to run built-ins.
- Reusable by #795 for `clear_context`.
