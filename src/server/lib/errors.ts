// ---------------------------------------------------------------------------
// Layered error taxonomy + structured logging (Phase 2, cross-cutting).
//
// Any failure is attributable to a tier via ErrorCategory, returned to the
// client as a stable `code`, and emitted as a single structured JSON log line
// on the Worker. Throw an AppError anywhere in a route; `appOnError` (wired via
// `app.onError`) turns it into the standard response + log.
// ---------------------------------------------------------------------------
import type { Context } from 'hono'

export type ErrorCategory = 'VALIDATION' | 'AUTH' | 'BUSINESS' | 'DB' | 'EXTERNAL'

export type LogLevel = 'ERROR' | 'WARN' | 'INFO'

// ---------------------------------------------------------------------------
// AppError — the one error type routes throw. Carries the tier (category), the
// stable client-facing code, the HTTP status, plus optional structured context
// and an underlying cause.
// ---------------------------------------------------------------------------
export class AppError extends Error {
  readonly category: ErrorCategory
  readonly code: string
  readonly httpStatus: number
  readonly context?: Record<string, unknown>

  constructor(
    category: ErrorCategory,
    code: string,
    httpStatus: number,
    message: string,
    opts?: { context?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message, opts?.cause !== undefined ? { cause: opts.cause } : undefined)
    this.name = 'AppError'
    this.category = category
    this.code = code
    this.httpStatus = httpStatus
    this.context = opts?.context
    // Restore prototype chain for `instanceof` across transpile targets.
    Object.setPrototypeOf(this, AppError.prototype)
  }
}

// ---------------------------------------------------------------------------
// Named factory helpers for every code currently in use across Phase 2. Each
// returns a ready-to-throw AppError with the canonical category + status.
// `message` is a safe, human-readable default; pass `context` for detail.
// ---------------------------------------------------------------------------
type FactoryOpts = { context?: Record<string, unknown>; cause?: unknown }

// -- VALIDATION (400/422) ---------------------------------------------------
export const VALIDATION_INVALID_INPUT = (message = 'invalid input', opts?: FactoryOpts) =>
  new AppError('VALIDATION', 'VALIDATION_INVALID_INPUT', 400, message, opts)

export const VALIDATION_SKILL_MISMATCH = (
  message = 'technician lacks the required skill for this service',
  opts?: FactoryOpts,
) => new AppError('VALIDATION', 'VALIDATION_SKILL_MISMATCH', 422, message, opts)

export const VALIDATION_OUTSIDE_HOURS = (
  message = 'slot is outside the technician working hours',
  opts?: FactoryOpts,
) => new AppError('VALIDATION', 'VALIDATION_OUTSIDE_HOURS', 422, message, opts)

export const VALIDATION_TIME_OFF = (
  message = 'slot overlaps the technician time off',
  opts?: FactoryOpts,
) => new AppError('VALIDATION', 'VALIDATION_TIME_OFF', 422, message, opts)

// -- BUSINESS (409) ---------------------------------------------------------
export const BUSINESS_SLOT_OVERLAP = (
  message = 'slot overlaps an existing booking',
  opts?: FactoryOpts,
) => new AppError('BUSINESS', 'BUSINESS_SLOT_OVERLAP', 409, message, opts)

export const BUSINESS_INVALID_STATUS = (
  message = 'invalid status transition',
  opts?: FactoryOpts,
) => new AppError('BUSINESS', 'BUSINESS_INVALID_STATUS', 409, message, opts)

// -- AUTH (401/403) ---------------------------------------------------------
export const AUTH_UNAUTHORIZED = (message = 'unauthorized', opts?: FactoryOpts) =>
  new AppError('AUTH', 'AUTH_UNAUTHORIZED', 401, message, opts)

export const AUTH_FORBIDDEN = (message = 'forbidden', opts?: FactoryOpts) =>
  new AppError('AUTH', 'AUTH_FORBIDDEN', 403, message, opts)

// -- DB (500/409) -----------------------------------------------------------
export const DB_QUERY = (message = 'database error', opts?: FactoryOpts) =>
  new AppError('DB', 'DB_QUERY', 500, message, opts)

export const DB_CONSTRAINT = (message = 'database constraint violation', opts?: FactoryOpts) =>
  new AppError('DB', 'DB_CONSTRAINT', 409, message, opts)

// -- EXTERNAL (502) ---------------------------------------------------------
export const EXTERNAL_SEPAY = (message = 'payment provider error', opts?: FactoryOpts) =>
  new AppError('EXTERNAL', 'EXTERNAL_SEPAY', 502, message, opts)

export const EXTERNAL_EMAIL = (message = 'email provider error', opts?: FactoryOpts) =>
  new AppError('EXTERNAL', 'EXTERNAL_EMAIL', 502, message, opts)

// ---------------------------------------------------------------------------
// Structured logging. One JSON line per event:
//   { timestamp, level, category, code, message, requestId, context }
// Reused by app code that wants to log success too (e.g. webhook accepted).
// ---------------------------------------------------------------------------
export interface StructuredLogFields {
  category: ErrorCategory | string
  code: string
  message: string
  requestId?: string
  context?: Record<string, unknown>
  // Anything extra (e.g. a stack) is passed through onto the JSON line.
  [k: string]: unknown
}

export function logStructured(level: LogLevel, fields: StructuredLogFields): void {
  const line = {
    timestamp: new Date().toISOString(),
    level,
    ...fields,
  }
  console.log(JSON.stringify(line))
}

// ---------------------------------------------------------------------------
// requestId. Middleware to stamp a request id (cf-ray if present, else a
// generated uuid) onto the context so every log line for a request correlates.
// The Planner wires this before the routes. `getRequestId` reads it back
// defensively (works even if the middleware wasn't installed).
// ---------------------------------------------------------------------------
export async function attachRequestId(
  c: Context,
  next: () => Promise<void>,
): Promise<void> {
  const id = c.req.header('cf-ray') ?? crypto.randomUUID()
  c.set('requestId', id)
  await next()
}

function getRequestId(c: Context): string {
  const existing = c.get('requestId') as string | undefined
  if (existing) return existing
  return c.req.header('cf-ray') ?? crypto.randomUUID()
}

// ---------------------------------------------------------------------------
// appOnError — the Hono error handler. Wire in app.ts with:
//   app.onError(appOnError)
//
// - AppError  -> log (ERROR if status>=500 else WARN) + standard client JSON.
// - anything else -> generic INTERNAL 500, full stack logged, no leak.
// ---------------------------------------------------------------------------
export function appOnError(err: Error, c: Context) {
  const requestId = getRequestId(c)

  if (err instanceof AppError) {
    const level: LogLevel = err.httpStatus >= 500 ? 'ERROR' : 'WARN'
    logStructured(level, {
      category: err.category,
      code: err.code,
      message: err.message,
      requestId,
      context: err.context,
    })
    return c.json(
      { error: { code: err.code, category: err.category, message: err.message } },
      err.httpStatus as import('hono/utils/http-status').ContentfulStatusCode,
    )
  }

  // Unexpected error: never leak internals to the client.
  logStructured('ERROR', {
    category: 'DB',
    code: 'INTERNAL',
    message: err?.message ?? 'internal error',
    requestId,
    context: { stack: err?.stack },
  })
  return c.json(
    { error: { code: 'INTERNAL', category: 'DB', message: 'internal error' } },
    500,
  )
}
