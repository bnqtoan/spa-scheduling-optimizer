// ---------------------------------------------------------------------------
// SePay webhook (Phase 2). PUBLIC, server-to-server — no auth cookie/session.
// Auth is the `Authorization: Apikey <token>` header verified against
// env.SEPAY_WEBHOOK_TOKEN. authMiddleware runs app-wide and sets user=null for
// unauthenticated requests, which is fine — we never read the session here.
//
// Mounted by the Planner at /api/webhooks (see app.ts). POST /sepay reconciles
// an incoming bank transfer to a pending payment by matching the paymentRef in
// the transfer content + amount, marks payment/booking paid, audits it, and
// always responds 200 { success: true } on a HANDLED request (SePay retries on
// non-200) — the ONLY non-200 is an auth failure.
// ---------------------------------------------------------------------------
import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import type { Env } from '../app'
import { getDb } from '../db/client'
import { bookings, payments, services, technicians } from '../db/schema'
import { AUTH_UNAUTHORIZED, logStructured } from '../lib/errors'
import { writeAudit } from '../lib/audit'
import { matchWebhookToPayment, type SepayWebhookPayload } from '../lib/payment'
import { renderPaymentPaidEmail, sendEmail } from '../lib/email'

const app = new Hono<Env>()

// ---------------------------------------------------------------------------
// POST /sepay — SePay pushes each incoming transfer here.
// ---------------------------------------------------------------------------
app.post('/sepay', async (c) => {
  // 1) Verify the Apikey header. Format: "Authorization: Apikey <token>".
  const header = c.req.header('authorization') ?? ''
  const token = header.replace(/^Apikey\s+/i, '').trim()
  const expected = c.env.SEPAY_WEBHOOK_TOKEN
  if (!expected || token !== expected) {
    throw AUTH_UNAUTHORIZED('invalid SePay webhook apikey')
  }

  // 2) Parse body defensively.
  const payload = (await c.req.json().catch(() => null)) as SepayWebhookPayload | null
  if (!payload || typeof payload !== 'object') {
    logStructured('WARN', {
      category: 'EXTERNAL',
      code: 'EXTERNAL_SEPAY',
      message: 'sepay webhook: unparseable body',
    })
    return c.json({ success: true })
  }

  const db = getDb(c.env.DB)
  const sepayTxId = payload.id != null ? String(payload.id) : null

  // 3) Idempotency: if this tx already marked a payment paid, no-op (no double
  //    audit). Guards against SePay retries.
  if (sepayTxId) {
    const [already] = await db
      .select({ id: payments.id })
      .from(payments)
      .where(and(eq(payments.sepayTxId, sepayTxId), eq(payments.status, 'paid')))
      .limit(1)
    if (already) {
      logStructured('INFO', {
        category: 'EXTERNAL',
        code: 'SEPAY_WEBHOOK_DUPLICATE',
        message: 'sepay webhook: duplicate tx, already paid — no-op',
        context: { sepayTxId },
      })
      return c.json({ success: true })
    }
  }

  // 4) Only incoming transfers can settle a payment.
  if (payload.transferType !== 'in') {
    logStructured('INFO', {
      category: 'EXTERNAL',
      code: 'SEPAY_WEBHOOK_IGNORED',
      message: 'sepay webhook: non-incoming transfer ignored',
      context: { sepayTxId, transferType: payload.transferType },
    })
    return c.json({ success: true })
  }

  // 5) Match against pending payments (pure matcher over the pending set).
  const pending = await db.select().from(payments).where(eq(payments.status, 'pending'))
  const match = matchWebhookToPayment(payload, pending)

  if (!match) {
    // Stray/unmatched transfer — log for manual reconciliation, still 200.
    logStructured('WARN', {
      category: 'EXTERNAL',
      code: 'SEPAY_WEBHOOK_UNMATCHED',
      message: 'sepay webhook: no pending payment matched — logged for reconciliation',
      context: {
        sepayTxId,
        content: payload.content ?? payload.description,
        amount: payload.transferAmount,
      },
    })
    return c.json({ success: true })
  }

  // 6) Settle: mark payment paid + booking paid, then audit + log. Guard the
  //    payment update on status='pending' so a concurrent duplicate can't
  //    double-settle (only the first UPDATE flips it).
  const paidAt = new Date().toISOString()
  await db
    .update(payments)
    .set({
      status: 'paid',
      sepayTxId,
      rawPayload: JSON.stringify(payload),
      paidAt,
    })
    .where(and(eq(payments.id, match.id), eq(payments.status, 'pending')))

  await db.update(bookings).set({ paymentStatus: 'paid' }).where(eq(bookings.id, match.bookingId))

  // userId null = customer self-service (server-to-server settlement).
  await writeAudit(db, {
    bookingId: match.bookingId,
    userId: null,
    action: 'pay',
    newValues: { amount: match.amount, sepayTxId },
  })

  logStructured('INFO', {
    category: 'EXTERNAL',
    code: 'SEPAY_WEBHOOK_PAID',
    message: 'sepay webhook: payment settled',
    context: { paymentRef: match.paymentRef, bookingId: match.bookingId, amount: match.amount, sepayTxId },
  })

  // Task 18: best-effort payment-paid email to the assigned technician.
  // Fetch booking+service+technician fresh (webhook has no c.executionCtx
  // guarantee issue — Workers always provide it — but we still guard
  // defensively and never let email failure affect the 200 SePay response).
  const [full] = await db
    .select({
      booking: bookings,
      serviceName: services.name,
      technicianName: technicians.name,
      technicianEmail: technicians.email,
    })
    .from(bookings)
    .leftJoin(services, eq(bookings.serviceId, services.id))
    .leftJoin(technicians, eq(bookings.technicianId, technicians.id))
    .where(eq(bookings.id, match.bookingId))
    .limit(1)

  if (full?.technicianEmail && full.serviceName) {
    const { subject, html } = renderPaymentPaidEmail(full.booking, { name: full.serviceName })
    const task = sendEmail(c.env, { to: full.technicianEmail, subject, html }).then(() => undefined)
    if (c.executionCtx?.waitUntil) {
      c.executionCtx.waitUntil(task)
    } else {
      await task.catch(() => undefined)
    }
  }

  return c.json({ success: true })
})

export default app
