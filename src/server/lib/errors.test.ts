import { describe, it, expect, vi, afterEach } from 'vitest'
import { Hono } from 'hono'
import {
  AppError,
  appOnError,
  attachRequestId,
  logStructured,
  BUSINESS_SLOT_OVERLAP,
  VALIDATION_SKILL_MISMATCH,
} from './errors'

// A minimal Hono app wired exactly like the Planner will wire app.ts, so the
// tests exercise the real onError path (and the requestId middleware).
function makeApp() {
  const app = new Hono()
  app.use('*', attachRequestId)
  app.onError(appOnError)
  return app
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AppError', () => {
  it('carries category / code / httpStatus / context / cause', () => {
    const cause = new Error('root')
    const err = new AppError('BUSINESS', 'BUSINESS_SLOT_OVERLAP', 409, 'boom', {
      context: { a: 1 },
      cause,
    })
    expect(err).toBeInstanceOf(AppError)
    expect(err).toBeInstanceOf(Error)
    expect(err.category).toBe('BUSINESS')
    expect(err.code).toBe('BUSINESS_SLOT_OVERLAP')
    expect(err.httpStatus).toBe(409)
    expect(err.message).toBe('boom')
    expect(err.context).toEqual({ a: 1 })
    expect(err.cause).toBe(cause)
  })

  it('factory helpers set the canonical category + status', () => {
    const overlap = BUSINESS_SLOT_OVERLAP()
    expect(overlap.category).toBe('BUSINESS')
    expect(overlap.code).toBe('BUSINESS_SLOT_OVERLAP')
    expect(overlap.httpStatus).toBe(409)

    const skill = VALIDATION_SKILL_MISMATCH()
    expect(skill.category).toBe('VALIDATION')
    expect(skill.code).toBe('VALIDATION_SKILL_MISMATCH')
    expect(skill.httpStatus).toBe(422)
  })
})

describe('appOnError', () => {
  it('maps a known AppError to the standard JSON + status', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const app = makeApp()
    app.get('/x', () => {
      throw BUSINESS_SLOT_OVERLAP()
    })

    const res = await app.request('/x')
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: {
        code: 'BUSINESS_SLOT_OVERLAP',
        category: 'BUSINESS',
        message: 'slot overlaps an existing booking',
      },
    })
  })

  it('logs a WARN structured JSON line for a 4xx AppError', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const app = makeApp()
    app.get('/x', () => {
      throw VALIDATION_SKILL_MISMATCH(undefined, { context: { technicianId: 3 } })
    })

    await app.request('/x')
    expect(spy).toHaveBeenCalledTimes(1)
    const line = JSON.parse(spy.mock.calls[0][0] as string)
    expect(line.level).toBe('WARN')
    expect(line.category).toBe('VALIDATION')
    expect(line.code).toBe('VALIDATION_SKILL_MISMATCH')
    expect(line.context).toEqual({ technicianId: 3 })
    expect(typeof line.timestamp).toBe('string')
    expect(typeof line.requestId).toBe('string')
    expect(line.requestId.length).toBeGreaterThan(0)
  })

  it('unknown error -> generic INTERNAL 500 with NO leak of internals', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const app = makeApp()
    app.get('/x', () => {
      throw new Error('secret db password is hunter2')
    })

    const res = await app.request('/x')
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body).toEqual({
      error: { code: 'INTERNAL', category: 'DB', message: 'internal error' },
    })
    // The raw message must never reach the client.
    expect(JSON.stringify(body)).not.toContain('hunter2')

    // But it IS logged server-side at ERROR level with the stack.
    const line = JSON.parse(spy.mock.calls[0][0] as string)
    expect(line.level).toBe('ERROR')
    expect(line.code).toBe('INTERNAL')
    expect(line.message).toContain('hunter2')
  })

  it('>=500 AppError logs at ERROR level', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const app = makeApp()
    app.get('/x', () => {
      throw new AppError('DB', 'DB_QUERY', 500, 'query failed')
    })

    const res = await app.request('/x')
    expect(res.status).toBe(500)
    const line = JSON.parse(spy.mock.calls[0][0] as string)
    expect(line.level).toBe('ERROR')
  })
})

describe('logStructured', () => {
  it('emits a single valid-JSON line with the required fields', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    logStructured('INFO', {
      category: 'EXTERNAL',
      code: 'EXTERNAL_SEPAY',
      message: 'webhook accepted',
      requestId: 'req-1',
      context: { orderId: 42 },
    })
    expect(spy).toHaveBeenCalledTimes(1)
    const line = JSON.parse(spy.mock.calls[0][0] as string)
    expect(line).toMatchObject({
      level: 'INFO',
      category: 'EXTERNAL',
      code: 'EXTERNAL_SEPAY',
      message: 'webhook accepted',
      requestId: 'req-1',
      context: { orderId: 42 },
    })
    expect(typeof line.timestamp).toBe('string')
  })
})
