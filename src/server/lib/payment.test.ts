import { describe, expect, it } from 'vitest'
import {
  buildVietQrUrl,
  generatePaymentRef,
  matchWebhookToPayment,
  type MatchablePayment,
  type SepayWebhookPayload,
} from './payment'

describe('generatePaymentRef', () => {
  it('is A-Z0-9 only, SPA-prefixed, and contains the padded booking id', () => {
    const ref = generatePaymentRef(12)
    expect(ref).toMatch(/^SPA[A-Z0-9]+$/)
    expect(ref.startsWith('SPA0012')).toBe(true)
    // SPA + 4-digit id + 2 suffix
    expect(ref).toHaveLength(9)
  })

  it('has no dash (banks/OCR drop non-alnum)', () => {
    expect(generatePaymentRef(3)).not.toContain('-')
  })

  it('pads ids >= 4 digits without truncating', () => {
    const ref = generatePaymentRef(12345)
    expect(ref.startsWith('SPA12345')).toBe(true)
    expect(ref).toMatch(/^SPA[A-Z0-9]+$/)
  })

  it('varies the suffix across calls (crypto random)', () => {
    const refs = new Set(Array.from({ length: 20 }, () => generatePaymentRef(1)))
    // Extremely unlikely all 20 collide on a 2-char suffix.
    expect(refs.size).toBeGreaterThan(1)
  })
})

describe('buildVietQrUrl', () => {
  it('builds the SePay QR image URL with acc/bank/amount/des', () => {
    const url = buildVietQrUrl({
      bank: 'MBBank',
      accountNumber: '0123456789',
      accountName: 'SPA CO',
      amount: 250000,
      content: 'SPA0012AB',
    })
    expect(url.startsWith('https://qr.sepay.vn/img?')).toBe(true)
    const q = new URL(url).searchParams
    expect(q.get('acc')).toBe('0123456789')
    expect(q.get('bank')).toBe('MBBank')
    expect(q.get('amount')).toBe('250000')
    expect(q.get('des')).toBe('SPA0012AB')
  })
})

describe('matchWebhookToPayment', () => {
  const payments: MatchablePayment[] = [
    { id: 1, bookingId: 10, paymentRef: 'SPA0010AA', amount: 100000 },
    { id: 2, bookingId: 11, paymentRef: 'SPA0011BB', amount: 250000 },
    { id: 3, bookingId: 12, paymentRef: 'SPA0012CC', amount: 250000 },
  ]

  const inTx = (over: Partial<SepayWebhookPayload>): SepayWebhookPayload => ({
    id: 999,
    transferType: 'in',
    transferAmount: 250000,
    content: 'CT DEN SPA0011BB thanh toan',
    ...over,
  })

  it('matches by ref present in content + amount', () => {
    expect(matchWebhookToPayment(inTx({}), payments)?.id).toBe(2)
  })

  it('rejects a wrong amount even if the ref matches', () => {
    expect(matchWebhookToPayment(inTx({ transferAmount: 999 }), payments)).toBeNull()
  })

  it('rejects an outgoing (transferType out) transfer', () => {
    expect(matchWebhookToPayment(inTx({ transferType: 'out' }), payments)).toBeNull()
  })

  it('picks the right payment among several with the same amount', () => {
    // amount 250000 matches both id 2 and id 3; the ref in content decides.
    const m = matchWebhookToPayment(inTx({ content: 'ND SPA0012CC' }), payments)
    expect(m?.id).toBe(3)
  })

  it('returns null when no ref appears in the content', () => {
    expect(matchWebhookToPayment(inTx({ content: 'random deposit no ref' }), payments)).toBeNull()
  })

  it('matches when the ref is in description instead of content', () => {
    const m = matchWebhookToPayment(
      { id: 1, transferType: 'in', transferAmount: 100000, description: 'pay SPA0010AA' },
      payments,
    )
    expect(m?.id).toBe(1)
  })

  it('is case-insensitive on the ref', () => {
    const m = matchWebhookToPayment(inTx({ content: 'spa0011bb' }), payments)
    expect(m?.id).toBe(2)
  })
})
