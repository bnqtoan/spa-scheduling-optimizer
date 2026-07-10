// ---------------------------------------------------------------------------
// Email notifications via Resend (Phase 2). Two triggers use this:
//   - booking created -> notify the assigned technician
//   - payment paid    -> confirm to the assigned technician
//
// sendEmail NEVER throws — a failed/missing-key send is logged as
// EXTERNAL_EMAIL (Task 14 taxonomy) and swallowed so a booking/payment
// mutation always succeeds regardless of email provider health. Callers fire
// this best-effort (see notifyNewBooking/notifyPaymentPaid + their call sites
// in routes/bookings.ts and routes/webhooks.ts), ideally via
// c.executionCtx.waitUntil so the HTTP response isn't delayed.
// ---------------------------------------------------------------------------
import type { Booking, Service, Technician } from '../db/schema'
import { logStructured } from './errors'

export interface EmailEnv {
  RESEND_API_KEY: string
  EMAIL_FROM: string
}

export interface SendEmailInput {
  to: string
  subject: string
  html: string
}

export interface SendEmailResult {
  ok: boolean
}

// ---------------------------------------------------------------------------
// sendEmail — POST to Resend's HTTP API. Never throws.
// ---------------------------------------------------------------------------
export async function sendEmail(env: EmailEnv, input: SendEmailInput): Promise<SendEmailResult> {
  if (!env.RESEND_API_KEY) {
    logStructured('WARN', {
      category: 'EXTERNAL',
      code: 'EXTERNAL_EMAIL',
      message: 'sendEmail: no-op, RESEND_API_KEY not set',
      context: { to: input.to, subject: input.subject },
    })
    return { ok: false }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: input.to,
        subject: input.subject,
        html: input.html,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      logStructured('ERROR', {
        category: 'EXTERNAL',
        code: 'EXTERNAL_EMAIL',
        message: 'sendEmail: Resend returned non-2xx',
        context: { to: input.to, subject: input.subject, status: res.status, body },
      })
      return { ok: false }
    }

    return { ok: true }
  } catch (err) {
    logStructured('ERROR', {
      category: 'EXTERNAL',
      code: 'EXTERNAL_EMAIL',
      message: 'sendEmail: request failed',
      context: { to: input.to, subject: input.subject, error: String(err) },
    })
    return { ok: false }
  }
}

// ---------------------------------------------------------------------------
// minutes-from-midnight -> "HH:MM". Tiny server-side replica of the client's
// fmtHM (src/client/lib/time.ts) to avoid a cross-boundary import.
// ---------------------------------------------------------------------------
function fmtHM(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export interface RenderedEmail {
  subject: string
  html: string
}

// ---------------------------------------------------------------------------
// renderNewBookingEmail — sent to the assigned technician right after a
// booking is created. Vietnamese copy.
// ---------------------------------------------------------------------------
export function renderNewBookingEmail(
  booking: Pick<Booking, 'code' | 'date' | 'startMin' | 'endMin' | 'customerName' | 'customerPhone'>,
  service: Pick<Service, 'name'>,
  technician: Pick<Technician, 'name'>,
): RenderedEmail {
  const time = `${fmtHM(booking.startMin)} - ${fmtHM(booking.endMin)}`
  const subject = `Lịch hẹn mới: ${booking.code}`
  const html = `
    <p>Chào ${technician.name},</p>
    <p>Bạn vừa có một lịch hẹn mới:</p>
    <ul>
      <li>Mã lịch hẹn: <strong>${booking.code}</strong></li>
      <li>Ngày: ${booking.date}</li>
      <li>Giờ: ${time}</li>
      <li>Dịch vụ: ${service.name}</li>
      <li>Khách hàng: ${booking.customerName} (${booking.customerPhone})</li>
    </ul>
    <p>Vui lòng chuẩn bị đón khách đúng giờ.</p>
  `.trim()
  return { subject, html }
}

// ---------------------------------------------------------------------------
// renderPaymentPaidEmail — sent to the assigned technician after SePay
// confirms payment. (Decision: technician, not receptionist — they're the one
// executing the service and benefit most from knowing payment already
// cleared.)
// ---------------------------------------------------------------------------
export function renderPaymentPaidEmail(
  booking: Pick<Booking, 'code' | 'date' | 'startMin' | 'endMin' | 'customerName'>,
  service: Pick<Service, 'name'>,
): RenderedEmail {
  const time = `${fmtHM(booking.startMin)} - ${fmtHM(booking.endMin)}`
  const subject = `Đã thanh toán: ${booking.code}`
  const html = `
    <p>Lịch hẹn <strong>${booking.code}</strong> đã được thanh toán.</p>
    <ul>
      <li>Ngày: ${booking.date}</li>
      <li>Giờ: ${time}</li>
      <li>Dịch vụ: ${service.name}</li>
      <li>Khách hàng: ${booking.customerName}</li>
    </ul>
  `.trim()
  return { subject, html }
}
