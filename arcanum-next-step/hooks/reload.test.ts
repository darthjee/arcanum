import { describe, expect, test } from 'claude-code/testing'
import { NOT_ARCANUM, endTurn, handoff, scheduled, world } from './test-support.ts'

// A hot reload runs `register` again in a fresh environment, with the host's
// `$.state` kept and no new `session.start`: each test here loads the mod
// with state already held and never starts the session.
describe('reload', () => {
  test('a pending handoff survives a reload and runs at the turn end', async ($, on) => {
    const w = world(on, {
      state: {
        interactive: true,
        pending: { command: '/discuss-issue 797', name: 'discuss-issue', args: '797' },
      },
    })

    await endTurn($)
    await w.clock.settle()

    expect(w.commands).toEqual([
      { command: 'clear', args: '' },
      { command: 'discuss-issue', args: '797' },
    ])
    expect(w.state.get('pending')).toBeNull()
  })

  test('a call after a reload still reads the allowlist', async ($, on) => {
    const w = world(on, { state: { interactive: true } })

    expect(await handoff($, '/config')).toEqual({ deny: NOT_ARCANUM })
    expect(await handoff($, '/discuss-issue 797')).toEqual({ result: scheduled('/discuss-issue 797') })
    expect(w.registered).toEqual([])
  })

  test('a second call after a reload is still rejected', async ($, on) => {
    world(on, {
      state: {
        interactive: true,
        pending: { command: '/discuss-issue 797', name: 'discuss-issue', args: '797' },
      },
    })

    expect(await handoff($, '/auto-resolve-issue 796')).toEqual({
      deny: 'a handoff is already pending: /discuss-issue 797',
    })
  })
})
