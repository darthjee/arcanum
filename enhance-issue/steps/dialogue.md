# Topic-Driven Dialogue

The core loop of this skill: a checklist of concerns the user can pick from, revisited until they're satisfied with the issue overall.

## 1. Read the project's usual concerns

Read `docs/agents/issue-enhancement.md` in the target repo, if it exists. Degrade gracefully if it's missing — proceed with only the issue-derived concerns from step 2 below.

## 2. Build the topic checklist

Build (or, on a repeat pass, update) a checklist combining:

- Every concern listed in `docs/agents/issue-enhancement.md` (when present).
- Any issue-specific concerns evident from `FILE`'s content or the exploration in [explore.md](explore.md) that aren't already covered above.

Mark each item as already discussed (✅) or not (☐) based on this conversation so far.

## 3. Present the list

Show the checklist to the user, and let them pick:

- Any item, checked or not — picking a checked item means revisiting it.
- A topic entirely outside the list.

Wait for their choice.

## 4. Dig into the chosen topic

Hold an open dialogue about the chosen topic: propose alternatives, ask follow-up questions, surface trade-offs — dig in until both you and the user are satisfied with the outcome for that topic.

Append the outcome to `FILE` (the local issue draft from [fetch.md](fetch.md)) — add or update a section capturing what was decided, in whatever shape fits the topic (e.g. a `## <Topic>` subsection, or folded into an existing `## Description`/`## Solution` section if that reads better). Always write in English, translating if the conversation was in another language.

If the digging surfaces something that deserves its own GitHub issue instead of folding into `FILE`, spin it off with `../../arcanum/_lib/spawn_issue.sh "$REPO_PATH" <id> "<title>" <body_file>` rather than drafting a file to commit directly. Whether to pass `--as-subissue` is a judgment call each time: pass it when the new issue is genuinely a piece of this issue's own work breakdown, omit it (the default — a comment-only cross-reference) when it's a tangential/independent concern.

## 5. Repeat or finish

Return to step 2 to refresh the checklist (the item just discussed is now ✅) and present it again.

Keep looping until the user says they're satisfied with the issue overall — at which point proceed to [publish.md](publish.md).
