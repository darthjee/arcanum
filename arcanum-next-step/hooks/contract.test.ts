import { describe, expect, test } from 'claude-code/testing'
import { startSession, world } from './test-support.ts'

describe('contract', () => {
  test('registers handoff on session.start, not deferred, with a { command } schema', async ($, on) => {
    const w = world(on)
    await startSession($)

    expect(w.registered.length).toBe(1)
    const tool = w.registered[0]
    expect(tool?.name).toBe('handoff')
    expect(tool?.isDeferred).toBe(false)
    expect(tool?.inputSchema).toEqual({
      type: 'object',
      properties: { command: { type: 'string' } },
      required: ['command'],
    })
    expect(tool?.description).toContain('end your turn')
  })

  test('is not offered in a non-interactive session', async ($, on) => {
    const w = world(on)
    await startSession($, false)

    expect(w.registered.length).toBe(0)
  })
})
