/**
 * A handoff the model scheduled through `mcp__arcanum-next-step__handoff`:
 * the command as given (trimmed), and its split into the command name
 * (without the slash) and its arguments, as `$.command.run` takes them.
 */
export type ArcanumNextStepHandoff = {
  command: string
  name: string
  args: string
}

declare module 'claude-code' {
  interface PluginState {
    'arcanum-next-step': {
      /**
       * The one pending handoff, run once the main loop's turn ends; `null`
       * (or never written) when none is pending.
       */
      pending: ArcanumNextStepHandoff | null
      /**
       * Whether a person is at the prompt (`session.start`'s `isInteractive`);
       * the tool is not offered, and a call is denied, where it is false.
       */
      interactive: boolean
    }
  }
}
