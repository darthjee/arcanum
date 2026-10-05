# Spec: Auto-next

## Status

Proposed. Nothing in this spec is implemented yet. It is tracked by #712 and implemented by its sub-issues:

- #714: `arcanum/_lib/next_step_prompt.sh` flags and the config keys;
- #715: wiring the keys into the skills that make next-step offers;
- #716: the init-claude settings step and the migrations. #716 also removes this spec once the feature is documented in the architecture docs.

## Goal

Add an opt-in boolean per source skill. When it is `true`, the skill's next-step offer is skipped and the offered command runs automatically, as a **chained** (top-level) run. When it is absent or `false`, the offer behaves exactly as it does today.

## Config keys

The keys live under the `next_step` namespace, at `next_step.auto.<skill>`:

```json
{
  "next_step": {
    "auto": {
      "enhance-issue": true,
      "discuss-issue": false,
      "auto-plan-issue": true
    }
  }
}
```

- Each key is read through `config_chain_read <repo_path> next_step auto.<skill>` (`arcanum/_lib/config_chain.sh`), which resolves local state, then repo config, then global config. `repo_config_read` already handles dotted keys, so no change to the config readers is needed.
- Every key defaults to `false`. Only the JSON boolean `true` enables the chain. Any other value, including the string `"true"`, counts as `false`.
- `/arcanum-check-config next_step.auto.<skill>` shows which tier a value resolves from.

| Key | Offer it skips | Where the offer lives |
| --- | --- | --- |
| `next_step.auto.enhance-issue` | `/discuss-issue <id>` | `enhance-issue/steps/publish.md` |
| `next_step.auto.discuss-issue` | `/auto-plan-issue <id>` (discuss-issue's first offer) | `discuss-issue/steps/discuss_and_save.md` |
| `next_step.auto.auto-plan-issue` | `/auto-resolve-issue <id>` | `auto-plan-issue/steps/run.md` (top-level `Next:` line), `discuss-issue/steps/discuss_and_save.md` (second offer), `plan-issue/steps/write_and_confirm.md` |

The `auto-plan-issue` key names the step that just finished (a plan exists), not the skill printing the offer. That is why it covers three offers: `auto-plan-issue`'s own top-level `Next:` line, discuss-issue's second offer (made after its nested plan), and `plan-issue`'s offer.

## Script contract (`next_step_prompt.sh`)

`arcanum/_lib/next_step_prompt.sh` stays plain bash and is not engine-dispatched. #714 adds two flags:

```text
next_step_prompt.sh --repo <repo_path> --command "<command>" [--command "<command>"]... [--auto-key <skill>] [--no-prompt]
```

- **`--auto-key <skill>`**: resolves `next_step.auto.<skill>` through `config_chain_read`.
  - When it resolves to `true`: print `auto-continuing: <cmd> (next_step.auto.<skill>=true)` on **stderr**, then output `CHOICE=yes` and `AUTO=true` on stdout, and exit 0. `/dev/tty` is never probed. `<cmd>` is the first `--command`, exactly as given.
  - Otherwise: behaviour is unchanged (the TTY prompt, or the exit-4 `FALLBACK=chat` path).
- **`--no-prompt`**: never prompt and never probe `/dev/tty`. It outputs `CHOICE=yes` or `CHOICE=no` from config alone, and exits 0. It needs `--auto-key` to know which key to read; without it, `CHOICE=no`. When the key is `true`, the output is the same as `--auto-key` alone, including the notice and `AUTO=true`. It is meant for auto skills, which must never block on a prompt.
- Argument validation still runs first: usage errors (unknown argument, missing `--repo`, no `--command`, empty `--auto-key` value) exit 1 before any config read or TTY probe.
- The existing output protocol is unchanged. `AUTO=true` is the only new stdout line, and only appears together with `CHOICE=yes`. The notice goes to stderr so that stdout keeps its key=value protocol.

Calling skills treat `CHOICE=yes` with `AUTO=true` exactly like a user's `[Y]es`: they run the command as a chained run. They relay the notice line to the user so the hop is visible.

## Epic rule

enhance-issue never auto-chains for an issue labeled `Epic`. Before passing `--auto-key enhance-issue`, it checks with `auto-fix-all/scripts/github.sh has-label <repo_path> <id> Epic`. On exit 0, it omits `--auto-key`, so an Epic always gets the normal offer.

## Chained versus nested

- A chained run is a top-level run. It is never invoked with `NESTED=true`, prints its own report, and makes its own next-step offer.
- A nested `auto-plan-issue` (run by discuss-issue or by the per-issue pipeline under `auto-fix-all`) never chains. Nested runs return a `FINISH_*` block and print no `Next:` line, so there is nothing to auto-continue.
- A chain continues hop by hop as long as each hop's key is `true`. For example, with all three keys `true`, `/enhance-issue` → `/discuss-issue` → `/auto-plan-issue` → `/loop /auto-resolve-issue`. A `false` key at any hop stops the chain at that hop's normal offer.

## Branch safety

`auto-resolve-issue` bootstraps `issue-<id>` itself through `auto-fix-all/scripts/checkout_from_main.sh`, so the chained run is safe as long as the plan is already on that branch remotely.

- **`plan-issue`** commits and pushes the plan on `issue-<id>` (through `commit_plan.sh`) before its offer.
- **discuss-issue** pushes the nested plan on `issue-<id>`, then releases the working tree through `checkout_safe_branch.sh`, before its second offer.
- **Top-level `auto-plan-issue`**: `commit_plan.sh` commits on the current HEAD without pushing. From a detached `origin/main`, the plan commit would be left behind. Rule: a top-level `auto-plan-issue` auto-chains only when HEAD is the `issue-<id>` branch. Otherwise it does not chain, and prints its normal `Next: /auto-resolve-issue <id>` line.

## Chaining `auto-resolve-issue`

A chained `auto-resolve-issue` is invoked through Claude Code's `loop` skill, as `/loop /auto-resolve-issue <id>`, so its `ScheduleWakeup` keeps monitoring a pending PR. The auto-continuing notice shows that exact command.

Note: discuss-issue's second offer is already `/auto-resolve-issue <id>` on `main` (since #710). Older wording in #712 and #713 that says `/auto-fix-issue` is out of date.

## Enabling

- **init-claude**: the settings step asks for each of the three keys and writes the answers to **repo config** (`.claude/configuration/arcanum-repo-config.json`), which is shared and committed. Users can still override a key per user in local state (`.claude/state/arcanum-config.json`), or for every repo in global config.
- **Migrations**: two opt-in, skippable prompted migrations in `arcanum/migrations/repos/next/`, modeled on `arcanum/migrations/repos/0.16.1/002–003` (`git.merge_body_mode`):
  - one with `type: script`, `skippable: true`, `applies_to: repo`, prompting for each key and writing repo config;
  - one with `type: script`, `skippable: true`, `applies_to: global`, prompting for each key and writing global config.

## Docs to update during implementation

- [Skill Finish](../architecture/skill-finish.md): the next-step offer contract (new flags, `AUTO=true`, notice) and the next-step map.
- [Shared State & Configuration Files](../architecture/shared-state-and-configuration.md): the `next_step` namespace.
- `docs/guides/arcanum-repo-config.md`: the new keys.
- The `README.md` config table.

## See also

- [Skill Finish](../architecture/skill-finish.md): the closing report and the next-step offer.
- [Shared State & Configuration Files](../architecture/shared-state-and-configuration.md): config tiers and resolution.
- [Per-Repo Migrations](../architecture/per-repo-migrations.md): how prompted `repo` and `global` migrations work.
- #712: the parent issue.
