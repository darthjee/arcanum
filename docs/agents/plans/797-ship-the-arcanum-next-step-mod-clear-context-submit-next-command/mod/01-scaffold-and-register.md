# Scaffold the mod and register the tool

Create the folder layout from the shared contracts. `plugin.json` names the plugin
`arcanum-next-step` with a one-line description and `"types": "./types/index.d.ts"`.
`hooks/hooks.json` lists `./register.ts`. `tsconfig.json` extends the engine-laid
`./.claude-plugin/types/tsconfig.json`.

In `register.ts`, on `session.start`, register the tool with `$.tool.register`:
name `handoff`, not deferred, `inputSchema`
`{ type: "object", properties: { command: { type: "string" } }, required: ["command"] }`,
and a description telling the model what it does and that it must end its turn right
after calling it. Then `next(e)`.

Declare the pending-handoff value (`{ command: string, name: string, args: string }`
or absent) in `types/index.d.ts` under `interface PluginState`.

Add `arcanum-next-step/.claude-plugin/types/` to the root `.gitignore`.

## Files to Change
- `arcanum-next-step/.claude-plugin/plugin.json` — new.
- `arcanum-next-step/hooks/hooks.json` — new.
- `arcanum-next-step/hooks/register.ts` — new: tool registration.
- `arcanum-next-step/types/index.d.ts` — new: `$.state` contract.
- `arcanum-next-step/tsconfig.json` — new.
- `.gitignore` — ignore `arcanum-next-step/.claude-plugin/types/`.
