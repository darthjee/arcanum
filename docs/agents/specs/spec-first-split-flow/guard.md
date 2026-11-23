# Shared Push Guard

Hub: [specs.md](specs.md)

## Field preservation is a security property

The verdict depends on the pointer being present, so the greatest risk to this feature is the issue losing its pointer, not the spec going missing.

**Rationale:** a rewrite that rebuilds the body drops the pointer. The resolver then sees `none`, automation proceeds, and the implementation runs without the contract that justified it, with zero errors.

## Covered skills

Four skills rewrite an existing issue body, and the guard binds all of them:

- `discuss-issue`: redrafts the sections.
- `enhance-issue`: publish.
- `auto-new-issue`: syncs the body from the local file.
- `auto-rewrite-issue`: the autonomous rewrite.

Not covered:

- `monitor-issues` never pushes a body. It only queues ids for `auto-rewrite-issue`.
- `arcanum-split-issue` and `arcanum-create-issue` create bodies rather than rewrite them.

## Mechanism

- One native-only command, shared by cross-skill reference, runs at every body-push path before `gh issue edit`. It is enforced by code, not by an instruction in a prompt.
- It fetches the current body from GitHub, extracts the pointer with the **resolver's parser** (one parser, no drift; see [pointer.md](pointer.md) and [resolver.md](resolver.md)), and compares it with the new body.

## Outcomes

- The current body has no pointer: pass the new body through unchanged.
- The pointer is kept verbatim: pass.
- The pointer is dropped: re-insert the original line verbatim at the canonical spot defined in [pointer.md](pointer.md), warn, and push.
- The pointer is changed (a different line or path): refuse the push with a non-zero exit, unless the caller passes `--allow-pointer-change`. Only the dialogue's "fix the field" option passes it (see [dialogue.md](dialogue.md)).

## Required regression tests

These tests are part of the contract:

- A rewrite that drops the pointer gets it back.
- A changed pointer without the override fails.
- A body with no pointer is untouched.
