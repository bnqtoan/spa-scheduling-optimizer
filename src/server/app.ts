import { Hono } from 'hono'
import technicians, { skillsRoute } from './routes/technicians'
import services from './routes/services'
import schedule from './routes/schedule'
import bookings from './routes/bookings'
import slots from './routes/slots'
import auth from './routes/auth'
import webhooks from './routes/webhooks'
import { appOnError, attachRequestId } from './lib/errors'
import { authMiddleware, type AuthVariables } from './middleware/auth'

export type Env = {
  Bindings: {
    DB: D1Database
    ASSETS: Fetcher
    // Phase 2 — SePay payment secrets (set via wrangler secret / .dev.vars)
    SEPAY_WEBHOOK_TOKEN: string
    SEPAY_BANK: string
    SEPAY_ACCOUNT_NUMBER: string
    SEPAY_ACCOUNT_NAME: string
    // Phase 2 — Resend email notifications (set via wrangler secret / .dev.vars)
    RESEND_API_KEY: string
    EMAIL_FROM: string
  }
  Variables: AuthVariables
}

const app = new Hono<Env>()

app.use('*', attachRequestId)
app.use('*', authMiddleware)

app.get('/api/health', (c) => c.json({ ok: true }))

app.route('/api/auth', auth)
app.route('/api/technicians', technicians)
app.route('/api/skills', skillsRoute)
app.route('/api/services', services)
app.route('/api/schedule', schedule)
app.route('/api/bookings', bookings)
app.route('/api/slots', slots)
app.route('/api/webhooks', webhooks)

app.onError(appOnError)

export default app
