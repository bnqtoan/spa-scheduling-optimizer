import { Hono } from 'hono'
import technicians, { skillsRoute } from './routes/technicians'
import services from './routes/services'
import schedule from './routes/schedule'
import bookings from './routes/bookings'
import slots from './routes/slots'
import auth from './routes/auth'
import { appOnError, attachRequestId } from './lib/errors'
import { authMiddleware, type AuthVariables } from './middleware/auth'

export type Env = {
  Bindings: {
    DB: D1Database
    ASSETS: Fetcher
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

app.onError(appOnError)

export default app
