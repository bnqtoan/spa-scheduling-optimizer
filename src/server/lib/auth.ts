// ---------------------------------------------------------------------------
// Auth primitives (Phase 2) — Web Crypto only, no heavy libs. Runs on the
// Cloudflare Worker via `crypto.subtle`.
//
// Password hashing: PBKDF2/SHA-256 with a random salt. Stored self-describing
// as `pbkdf2$<iterations>$<saltB64>$<hashB64>` so verify needs no external
// config. verifyPassword compares derived bits in constant time.
// ---------------------------------------------------------------------------

export const COOKIE_NAME = 'spa_session'
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60 // 7 days

const PBKDF2_ITERATIONS = 100_000
const PBKDF2_HASH = 'SHA-256'
const DERIVED_BITS = 256 // 32-byte derived key
const SALT_BYTES = 16
const TOKEN_BYTES = 32

// ---------------------------------------------------------------------------
// base64 helpers (standard, for hash/salt) + base64url (for session tokens)
// ---------------------------------------------------------------------------
function bytesToB64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function b64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function bytesToB64Url(bytes: Uint8Array): string {
  return bytesToB64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// ---------------------------------------------------------------------------
// PBKDF2 derivation
// ---------------------------------------------------------------------------
async function deriveBits(plain: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(plain),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: PBKDF2_HASH },
    keyMaterial,
    DERIVED_BITS,
  )
  return new Uint8Array(bits)
}

/** Hash a plaintext password → `pbkdf2$<iterations>$<saltB64>$<hashB64>`. */
export async function hashPassword(plain: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const derived = await deriveBits(plain, salt, PBKDF2_ITERATIONS)
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToB64(salt)}$${bytesToB64(derived)}`
}

/** Constant-time compare of two byte arrays. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

/**
 * Verify a plaintext password against a stored `pbkdf2$...` string.
 * Returns false (never throws) on any malformed stored value.
 */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iterations = Number(parts[1])
  if (!Number.isInteger(iterations) || iterations <= 0) return false
  let salt: Uint8Array
  let expected: Uint8Array
  try {
    salt = b64ToBytes(parts[2])
    expected = b64ToBytes(parts[3])
  } catch {
    return false
  }
  const derived = await deriveBits(plain, salt, iterations)
  return timingSafeEqual(derived, expected)
}

/** Opaque session token: ≥32 random bytes, base64url-encoded. */
export function generateSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES))
  return bytesToB64Url(bytes)
}
