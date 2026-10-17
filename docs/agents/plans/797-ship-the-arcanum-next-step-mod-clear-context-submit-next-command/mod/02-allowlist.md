# Allowlist and validation

On `session.start`, before registering, build the allowlist: list the mod folder's
parent (the install's skills folder) with `$.fs` and keep each child folder that holds
a `SKILL.md`. Keep it in a module variable (rebuilt on every load).

Serve the tool with a `tool.call` hook on `{ tool: "mcp__arcanum-next-step__handoff" }`
(with a `.catch` that denies when the hook failed before deciding). Validate in order:

1. `e.agentId` set → error `handoff is only available on the main loop`.
2. Trim `command`; must start with `/`; split at the first whitespace run into name
   and args. Name `loop` → re-apply the same check to the args' first token (must be
   `/<allowlisted skill>`). Name `clear`, any non-allowlisted name, or a non-`/`
   input → error `handoff only runs arcanum skills`.
3. A pending handoff already in `$.state` → error
   `a handoff is already pending: <pending command>`.

Errors are tool results the model reads (`isError`), never thrown.

## Files to Change
- `arcanum-next-step/hooks/register.ts` — allowlist build + `tool.call` validation.
