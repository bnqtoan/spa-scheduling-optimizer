import { describe, expect, it } from 'vitest'
import { generateSessionToken, hashPassword, verifyPassword } from './auth'

describe('hashPassword / verifyPassword', () => {
  it('round-trips: hash then verify with the same password is true', async () => {
    const stored = await hashPassword('spa123')
    expect(await verifyPassword('spa123', stored)).toBe(true)
  })

  it('produces the self-describing pbkdf2$<iters>$<salt>$<hash> format', async () => {
    const stored = await hashPassword('spa123')
    const parts = stored.split('$')
    expect(parts).toHaveLength(4)
    expect(parts[0]).toBe('pbkdf2')
    expect(Number(parts[1])).toBeGreaterThan(0)
    expect(parts[2].length).toBeGreaterThan(0) // salt b64
    expect(parts[3].length).toBeGreaterThan(0) // hash b64
  })

  it('wrong password verifies false', async () => {
    const stored = await hashPassword('spa123')
    expect(await verifyPassword('wrong', stored)).toBe(false)
  })

  it('uses a random salt: two hashes of the same password differ but both verify', async () => {
    const a = await hashPassword('spa123')
    const b = await hashPassword('spa123')
    expect(a).not.toBe(b)
    expect(await verifyPassword('spa123', a)).toBe(true)
    expect(await verifyPassword('spa123', b)).toBe(true)
  })

  it('tampered hash verifies false', async () => {
    const stored = await hashPassword('spa123')
    const parts = stored.split('$')
    // Flip the first char of the hash segment.
    const flipped = parts[3][0] === 'A' ? 'B' : 'A'
    parts[3] = flipped + parts[3].slice(1)
    expect(await verifyPassword('spa123', parts.join('$'))).toBe(false)
  })

  it('malformed stored values verify false (never throw)', async () => {
    expect(await verifyPassword('spa123', 'not-a-hash')).toBe(false)
    expect(await verifyPassword('spa123', 'pbkdf2$100000$onlythree')).toBe(false)
    expect(await verifyPassword('spa123', 'bcrypt$1$x$y')).toBe(false)
    expect(await verifyPassword('spa123', 'pbkdf2$0$AAAA$AAAA')).toBe(false)
  })

  it("the seed.sql hash verifies against 'spa123' (and not against a wrong pw)", async () => {
    // Exact string stored for all 7 seed users in src/server/db/seed.sql.
    const SEED_HASH =
      'pbkdf2$100000$6xokYqdoV1wxMvLb1QgoMw==$PFLehbDcBvILzj3XuIyXwy0ZvaqvN6YCOn9/R8UBBoA='
    expect(await verifyPassword('spa123', SEED_HASH)).toBe(true)
    expect(await verifyPassword('spa124', SEED_HASH)).toBe(false)
  })
})

describe('generateSessionToken', () => {
  it('is long (≥32 bytes → ≥43 base64url chars) and url-safe', () => {
    const token = generateSessionToken()
    expect(token.length).toBeGreaterThanOrEqual(43)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('is unique across many calls', () => {
    const set = new Set(Array.from({ length: 1000 }, () => generateSessionToken()))
    expect(set.size).toBe(1000)
  })
})
