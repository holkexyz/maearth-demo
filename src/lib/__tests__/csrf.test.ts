import { describe, it, expect } from 'vitest'
import { generateCsrfToken, validateCsrfToken } from '../csrf'

describe('CSRF tokens', () => {
  it('generates valid tokens', () => {
    const token = generateCsrfToken()
    expect(token).toBeTruthy()
    expect(token.split('.')).toHaveLength(3)
  })

  it('validates valid tokens', () => {
    const token = generateCsrfToken()
    expect(validateCsrfToken(token)).toBe(true)
  })

  it('rejects tampered tokens', () => {
    const token = generateCsrfToken()
    const tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a')
    expect(validateCsrfToken(tampered)).toBe(false)
  })

  it('rejects empty tokens', () => {
    expect(validateCsrfToken('')).toBe(false)
  })

  it('rejects malformed tokens', () => {
    expect(validateCsrfToken('not-a-token')).toBe(false)
    expect(validateCsrfToken('a.b')).toBe(false)
    expect(validateCsrfToken('a.b.c.d')).toBe(false)
  })

  it('generates unique tokens', () => {
    const a = generateCsrfToken()
    const b = generateCsrfToken()
    expect(a).not.toBe(b)
  })
})
