import type { Register } from 'claude-code'

export const TOOL_NAME = 'handoff'

const DESCRIPTION = [
  'Clears the conversation context (/clear) and then runs the given arcanum',
  'skill command, once this turn ends. Pass the exact command line, e.g.',
  '"/discuss-issue 797" or "/loop /auto-resolve-issue 796". Only arcanum',
  'skills (optionally wrapped in /loop) are accepted. After calling it, end',
  'your turn right away without further output: the handoff runs only when',
  'the turn ends.',
].join(' ')

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: TOOL_NAME,
      description: DESCRIPTION,
      isDeferred: false,
      inputSchema: {
        type: 'object',
        properties: { command: { type: 'string' } },
        required: ['command'],
      },
    })
    return next(e)
  })
}
