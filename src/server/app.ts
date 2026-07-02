import { Hono } from 'hono'
import technicians, { skillsRoute } from './routes/technicians'
import services from './routes/services'
import schedule from './routes/schedule'
import bookings from './routes/bookings'
import slots from './routes/slots'

export type Env = {
  Bindings: {
    DB: D1Database
    ASSETS: Fetcher
  }
}

const app = new Hono<Env>()

app.get('/api/health', (c) => c.json({ ok: true }))

app.route('/api/technicians', technicians)
app.route('/api/skills', skillsRoute)
app.route('/api/services', services)
app.route('/api/schedule', schedule)
app.route('/api/bookings', bookings)
app.route('/api/slots', slots)

export default app
