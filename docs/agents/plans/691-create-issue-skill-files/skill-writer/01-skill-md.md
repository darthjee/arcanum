# SKILL.md

Create `arcanum-create-issue/SKILL.md` with frontmatter `name: arcanum-create-issue` and a `description` (interview-driven creation of a brand-new GitHub issue: start or resume a local draft, checklist dialogue as in `enhance-issue`, pick Epic and labels, confirm, create the labeled issue; next step `/arcanum-split-issue` for Epics, otherwise `/discuss-issue`. Usage: `/arcanum-create-issue`).

Body, modeled on `enhance-issue/SKILL.md`:

- You are the **architect**; no arguments are expected.
- Resolve `REPO_PATH="$(pwd)"` once and thread it to every script call.
- State up front: this skill never touches git (no commit, no checkout, no dirty-tree check); the draft lives in `.claude/state/create-issue/` and is deleted only by `publish.sh` on success.
- Step 1 → [steps/start.md](steps/start.md); Step 2 → [steps/explore.md](steps/explore.md); Step 3 → [steps/dialogue.md](steps/dialogue.md); Step 4 → [steps/publish.md](steps/publish.md) (ends with the closing report and the Epic-based next-step offer).

## Files to Change

- `arcanum-create-issue/SKILL.md` — new
