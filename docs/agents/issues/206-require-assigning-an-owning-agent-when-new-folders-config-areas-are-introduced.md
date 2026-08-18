## Description

Follow-up from #200: the #192 plan routed a `.github/workflows/core-ci.yml` fix to `infra`, but `infra`'s documented scope (`.claude/agents/infra.md` and `docs/agents/architecture/agent-roster-and-delegation.md`) only lists Docker, docker-compose, and Makefile files — `.github/workflows/**` isn't actually listed anywhere as anyone's responsibility. Nobody had explicitly decided who owns CI workflow files; the plan just guessed the closest-sounding agent. This is a process gap, not something specific to #200: nothing today requires that when a new folder, file type, or config area is introduced to the repo, someone also updates `docs/agents/` to say which agent (if any) owns it.

(As of this writing, `.github/workflows/` itself no longer exists in the repo — the immediate file is gone, so there's no live CI-workflow content needing a right-now owner. The underlying process gap remains regardless, and `.github/` as a whole still needs an explicit owner — see Solution.)

## Problem

Agent scope boundaries are documented by hand in `.claude/agents/*.md` and `docs/agents/architecture/agent-roster-and-delegation.md`, but there's no checklist or process step that forces this documentation to be touched whenever the repo grows a new structural area. Ownership gaps get discovered only when a plan needs to dispatch to *someone* and picks the closest guess — as happened here.

## Solution

Add an explicit ownership check to both issue-definition skills, since an issue can reach either one without necessarily going through the other first:

- `docs/agents/issue-enhancement.md` — add a checklist item consulted by `enhance-issue`'s dialogue step: does this issue introduce a new **top-level (root) repo folder**? If so, which agent should own it (extend an existing agent's scope, assign a new specialist, or explicitly record it as `architect`/cross-cutting), and update `docs/agents/architecture/agent-roster-and-delegation.md` plus the owning agent's `.claude/agents/<name>.md` accordingly.
- `discuss-issue/steps/discuss_and_save.md`'s step 4 ("Generate clarifying questions") — add the same standing consideration, since a sufficiently concrete issue can go straight to `discuss-issue` without passing through `enhance-issue` first.

The instruction is duplicated deliberately in both files rather than factored into one shared doc, since the two skills read their checklists from different places today.

**No silent no-owner default:** the check must always resolve to an explicitly named owner — never skipped because "no specialist obviously fits." `architect` is a valid answer (e.g. genuinely cross-cutting, or a root-level doc/config file in the same vein as `README.md`/`AGENTS.md`), but only as a deliberate call made during the dialogue, not a fallback reached by omission. Phrase the question as "which agent owns this — name one" rather than "does any agent own this?", so it can't be answered by silence.

**Testing strategy:** this is instruction text an LLM agent reads and acts on, not code — there's no automated test to write. Verification is manual: the wording is sanity-checked during PR review (does it unambiguously force a named-owner answer, per "No silent no-owner default" above?), and real confirmation comes from observing that the next issue introducing a new root-level folder actually gets asked the ownership question during `discuss-issue`/`enhance-issue`.

**Trigger scope:** new **top-level (root) repo folders only** (e.g. `.github/`, matching this issue's motivating example) — not nested files, subfolders, or config areas inside an already-owned folder, since those consistently already fall under an existing agent's documented scope.

**Out of scope for this issue:** a matching check at plan time (`auto-plan-issue`'s agent-selection step) was considered and explicitly deferred. Catching the gap at issue-definition time would already have prevented #200's misroute, so plan-time enforcement is left for a future issue if a gap is ever caught later than the discuss/enhance stage.

**Immediate remediation — `.github/`:** `.github/workflows/` is gone, but `.github/` as a folder still lacks a fully-documented owner today. `architect` already owns `.github/copilot-instructions.md` specifically (per its "Root-level files" scope bullet in `.claude/agents/architect.md`), while the other files currently in `.github/` (`pull_request_template.md`, `commit_message_template.md`, `commit_message_template-2.0.md`) aren't documented anywhere. Since these are all root-level process/meta artifacts in the same vein as `README.md`/`AGENTS.md`, extend `architect`'s documented scope from `.github/copilot-instructions.md` to `.github/` as a whole — update the "Root-level files" bullet in `.claude/agents/architect.md` accordingly. This also pre-assigns ownership for a future `.github/workflows/` reappearing, unless/until CI complexity grows enough to justify a dedicated specialist later.

## Benefits

Closes agent-ownership gaps before they cause a misrouted dispatch (as happened in #200), instead of after.
