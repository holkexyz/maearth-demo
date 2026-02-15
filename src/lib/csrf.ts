import * as crypto from 'crypto'

const CSRF_SECRET = process.env.CSRF_SECRET || 'dev-csrf-secret-change-in-production'
const TOKEN_MAX_AGE_MS = 60 * 60 * 1000 // 1 hour

export function generateCsrfToken(): string {
  const timestamp = Date.now().toString(36)
  const random = crypto.randomBytes(16).toString('base64url')
  const payload = `${timestamp}.${random}`
  const hmac = crypto.createHmac('sha256', CSRF_SECRET).update(payload).digest('base64url')
  return `${payload}.${hmac}`
}

export function validateCsrfToken(token: string): boolean {
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 3) return false
  const [timestamp, random, providedHmac] = parts
  if (!timestamp || !random || !providedHmac) return false

  // Verify HMAC
  const payload = `${timestamp}.${random}`
  const expectedHmac = crypto.createHmac('sha256', CSRF_SECRET).update(payload).digest('base64url')
  if (expectedHmac.length !== providedHmac.length) return false
  if (!crypto.timingSafeEqual(Buffer.from(expectedHmac), Buffer.from(providedHmac))) return false

  // Check age
  const created = parseInt(timestamp, 36)
  if (isNaN(created)) return false
  if (Date.now() - created > TOKEN_MAX_AGE_MS) return false

  return true
}
