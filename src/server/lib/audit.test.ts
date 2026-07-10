import { describe, expect, it, vi } from 'vitest'
import { serializeAuditValue, writeAudit } from './audit'
import { scopeTechnicianId } from './rbac'

// ---------------------------------------------------------------------------
// serializeAuditValue — old/new value serialization
// ---------------------------------------------------------------------------
describe('serializeAuditValue', () => {
  it('JSON.stringifies an object', () => {
    expect(serializeAuditValue({ status: 'scheduled' })).toBe('{"status":"scheduled"}')
  })

  it('maps undefined to null (empty column)', () => {
    expect(serializeAuditValue(undefined)).toBeNull()
  })

  it('serializes null as JSON null (distinct from undefined)', () => {
    expect(serializeAuditValue(null)).toBe('null')
  })

  it('round-trips a booking-like object', () => {
    const booking = { id: 7, status: 'cancelled', startMin: 540 }
    expect(JSON.parse(serializeAuditValue(booking)!)).toEqual(booking)
  })
})

// ---------------------------------------------------------------------------
// writeAudit — insert shape + best-effort (never throws)
// ---------------------------------------------------------------------------
describe('writeAudit', () => {
  function fakeDb(insertImpl: () => unknown) {
    return {
      insert: () => ({ values: insertImpl }),
    } as any
  }

  it('inserts a row with serialized old/new values', async () => {
    const values = vi.fn().mockResolvedValue(undefined)
    const db = { insert: () => ({ values }) } as any

    await writeAudit(db, {
      bookingId: 3,
      userId: 42,
      action: 'cancel',
      oldValues: { status: 'scheduled' },
      newValues: { status: 'cancelled' },
    })

    expect(values).toHaveBeenCalledWith({
      bookingId: 3,
      userId: 42,
      action: 'cancel',
      oldValues: '{"status":"scheduled"}',
      newValues: '{"status":"cancelled"}',
    })
  })

  it('passes null userId for customer self-service', async () => {
    const values = vi.fn().mockResolvedValue(undefined)
    const db = { insert: () => ({ values }) } as any

    await writeAudit(db, { bookingId: 1, userId: null, action: 'create', newValues: { id: 1 } })

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ userId: null, action: 'create', oldValues: null }),
    )
  })

  it('is best-effort: swallows a DB error instead of throwing', async () => {
    const db = fakeDb(() => {
      throw new Error('D1 write failed')
    })
    await expect(
      writeAudit(db, { bookingId: 1, userId: 1, action: 'create' }),
    ).resolves.toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// scopeTechnicianId — RBAC filter helper. A technician is force-scoped to
// their own technicianId; asking for another tech is forbidden.
// ---------------------------------------------------------------------------
describe('scopeTechnicianId', () => {
  const tech = { id: 10, role: 'technician', technicianId: 5 } as any
  const admin = { id: 1, role: 'admin', technicianId: null } as any
  const letan = { id: 2, role: 'receptionist', technicianId: null } as any

  it('forces a technician to their own id when no filter requested', () => {
    expect(scopeTechnicianId(tech, undefined)).toBe(5)
  })

  it('allows a technician to request their own id', () => {
    expect(scopeTechnicianId(tech, 5)).toBe(5)
  })

  it('forbids a technician requesting another tech (throws AUTH_FORBIDDEN)', () => {
    expect(() => scopeTechnicianId(tech, 6)).toThrow(
      expect.objectContaining({ code: 'AUTH_FORBIDDEN' }),
    )
  })

  it('admin sees all when no filter requested', () => {
    expect(scopeTechnicianId(admin, undefined)).toBeUndefined()
  })

  it('admin may filter to any tech', () => {
    expect(scopeTechnicianId(admin, 6)).toBe(6)
  })

  it('receptionist may filter to any tech', () => {
    expect(scopeTechnicianId(letan, 3)).toBe(3)
  })

  it('unauthed (null user) is unrestricted by this helper', () => {
    expect(scopeTechnicianId(null, undefined)).toBeUndefined()
  })
})
