// ---------------------------------------------------------------------------
// SePay payment helpers (Phase 2). Pure/DB-free so they unit-test easily.
//
// SePay is NOT a redirect gateway: it watches a bank account and POSTs each
// incoming transfer to our webhook. Reconciliation is by the transfer CONTENT
// containing our paymentRef. See routes/webhooks.ts for the DB-touching side.
// ---------------------------------------------------------------------------

// A-Z0-9 only — banks/OCR drop non-alnum, so no '-' (do NOT reuse booking.code).
const REF_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

/**
 * Generate a payment reference for a booking: `SPA` + zero-padded booking id
 * (min 4 digits) + 2 random uppercase alnum, e.g. `SPA0012AB`. A-Z0-9 only.
 * Suffix uses crypto.getRandomValues (not Math.random) for collision resistance;
 * uniqueness is ultimately enforced by the payments.paymentRef unique index.
 */
export function generatePaymentRef(bookingId: number): string {
  const buf = new Uint8Array(2)
  crypto.getRandomValues(buf)
  const suffix = Array.from(buf, (b) => REF_ALPHABET[b % REF_ALPHABET.length]).join('')
  return `SPA${String(bookingId).padStart(4, '0')}${suffix}`
}

/**
 * Build the SePay VietQR image URL the customer scans. The transfer `content`
 * (des) MUST be the paymentRef so the webhook can reconcile it.
 * Docs: https://qr.sepay.vn/img?acc=<account>&bank=<bank>&amount=<vnd>&des=<ref>
 */
export function buildVietQrUrl(params: {
  bank: string
  accountNumber: string
  accountName: string
  amount: number
  content: string
}): string {
  const q = new URLSearchParams({
    acc: params.accountNumber,
    bank: params.bank,
    amount: String(params.amount),
    des: params.content,
  })
  // accountName is not a QR image param but is shown to the customer separately;
  // include it for completeness so callers can surface the payee name.
  if (params.accountName) q.set('template', 'compact')
  return `https://qr.sepay.vn/img?${q.toString()}`
}

// ---------------------------------------------------------------------------
// Webhook matching. SePay payload fields vary; handle defensively.
// ---------------------------------------------------------------------------
export interface SepayWebhookPayload {
  id?: number | string // SePay transaction id
  transferType?: string // 'in' | 'out'
  transferAmount?: number // VND
  content?: string // free-text transfer content — contains the paymentRef
  description?: string // some payloads use description instead of content
  referenceCode?: string
  [k: string]: unknown
}

// The minimal shape of a pending payment row the matcher needs.
export interface MatchablePayment {
  id: number
  bookingId: number
  paymentRef: string
  amount: number
}

/**
 * Pure matcher: given a webhook body and the list of PENDING payments, return
 * the one payment whose paymentRef appears in the transfer content AND whose
 * amount equals transferAmount — only for incoming transfers (transferType
 * 'in'). Returns null if nothing matches.
 */
export function matchWebhookToPayment<T extends MatchablePayment>(
  payload: SepayWebhookPayload,
  payments: T[],
): T | null {
  if (payload.transferType !== 'in') return null

  const content = `${payload.content ?? ''} ${payload.description ?? ''}`.toUpperCase()
  const amount = Number(payload.transferAmount)
  if (!Number.isFinite(amount)) return null

  for (const p of payments) {
    if (content.includes(p.paymentRef.toUpperCase()) && p.amount === amount) {
      return p
    }
  }
  return null
}
