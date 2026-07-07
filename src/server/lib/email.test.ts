import { describe, it, expect, vi, afterEach } from 'vitest'
import { sendEmail, renderNewBookingEmail, renderPaymentPaidEmail } from './email'

const ENV = { RESEND_API_KEY: 'test-key', EMAIL_FROM: 'SPA <a@b.com>' }

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('renderNewBookingEmail', () => {
  it('includes date, time (HH:MM from minutes), service, customer, code', () => {
    const booking = {
      code: 'SPA260702-0001',
      date: '2026-07-02',
      startMin: 570, // 09:30
      endMin: 630, // 10:30
      customerName: 'Nguyễn Thị Hoa',
      customerPhone: '0901111111',
    }
    const service = { name: 'Massage thư giãn' }
    const technician = { name: 'Lan Anh' }

    const { subject, html } = renderNewBookingEmail(booking, service, technician)

    expect(subject).toContain('SPA260702-0001')
    expect(html).toContain('2026-07-02')
    expect(html).toContain('09:30')
    expect(html).toContain('10:30')
    expect(html).toContain('Massage thư giãn')
    expect(html).toContain('Nguyễn Thị Hoa')
    expect(html).toContain('0901111111')
    expect(html).toContain('Lan Anh')
  })

  it('formats minutes -> HH:MM correctly at edges', () => {
    const booking = {
      code: 'SPA260101-0001',
      date: '2026-01-01',
      startMin: 0, // 00:00
      endMin: 5, // 00:05
      customerName: 'A',
      customerPhone: '000',
    }
    const { html } = renderNewBookingEmail(booking, { name: 'S' }, { name: 'T' })
    expect(html).toContain('00:00')
    expect(html).toContain('00:05')
  })
})

describe('renderPaymentPaidEmail', () => {
  it('includes date/time/service/customer/code', () => {
    const booking = {
      code: 'SPA260702-0001',
      date: '2026-07-02',
      startMin: 600,
      endMin: 660,
      customerName: 'Trần Văn Bình',
    }
    const { subject, html } = renderPaymentPaidEmail(booking, { name: 'Facial cơ bản' })
    expect(subject).toContain('SPA260702-0001')
    expect(html).toContain('2026-07-02')
    expect(html).toContain('10:00')
    expect(html).toContain('11:00')
    expect(html).toContain('Facial cơ bản')
    expect(html).toContain('Trần Văn Bình')
  })
})

describe('sendEmail', () => {
  it('returns {ok:false} without throwing when RESEND_API_KEY is missing', async () => {
    const result = await sendEmail(
      { RESEND_API_KEY: '', EMAIL_FROM: 'a@b.com' },
      { to: 'x@y.com', subject: 's', html: '<p>h</p>' },
    )
    expect(result).toEqual({ ok: false })
  })

  it('returns {ok:false} without throwing when fetch rejects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network down')),
    )
    const result = await sendEmail(ENV, { to: 'x@y.com', subject: 's', html: '<p>h</p>' })
    expect(result).toEqual({ ok: false })
  })

  it('returns {ok:false} without throwing on non-2xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'server error' }),
    )
    const result = await sendEmail(ENV, { to: 'x@y.com', subject: 's', html: '<p>h</p>' })
    expect(result).toEqual({ ok: false })
  })

  it('returns {ok:true} on a 2xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '' }),
    )
    const result = await sendEmail(ENV, { to: 'x@y.com', subject: 's', html: '<p>h</p>' })
    expect(result).toEqual({ ok: true })
  })
})
