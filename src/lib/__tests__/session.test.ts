import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createOAuthSession, getOAuthSession, deleteOAuthSession,
  createUserSession, getUserSession, deleteUserSession,
  verifySignedId, getSessionFromCookie,
} from '../session'
import type { OAuthSession, UserSession } from '../session'

const sampleOAuthSession: OAuthSession = {
  state: 'test-state',
  codeVerifier: 'test-verifier',
  dpopPrivateJwk: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y', d: 'd' },
  tokenEndpoint: 'https://pds.example.com/oauth/token',
  email: 'test@example.com',
  expectedDid: 'did:plc:test123',
  expectedPdsUrl: 'https://pds.example.com',
}

const sampleUserSession: UserSession = {
  userDid: 'did:plc:test123',
  userHandle: 'test.example.com',
  createdAt: Date.now(),
}

describe('session signing', () => {
  it('creates signed session IDs', () => {
    const signed = createOAuthSession(sampleOAuthSession)
    expect(signed).toContain('.')
    const parts = signed.split('.')
    expect(parts.length).toBe(2)
  })

  it('verifies valid signed IDs', () => {
    const signed = createOAuthSession(sampleOAuthSession)
    const sessionId = verifySignedId(signed)
    expect(sessionId).not.toBeNull()
    expect(sessionId!.length).toBeGreaterThan(0)
  })

  it('rejects tampered signed IDs', () => {
    const signed = createOAuthSession(sampleOAuthSession)
    const tampered = signed.replace(/.$/, signed.endsWith('a') ? 'b' : 'a')
    expect(verifySignedId(tampered)).toBeNull()
  })

  it('rejects unsigned values', () => {
    expect(verifySignedId('no-dot-here')).toBeNull()
  })
})

describe('OAuth sessions', () => {
  it('creates and retrieves OAuth sessions', () => {
    const signed = createOAuthSession(sampleOAuthSession)
    const retrieved = getOAuthSession(signed)
    expect(retrieved).not.toBeNull()
    expect(retrieved!.state).toBe('test-state')
    expect(retrieved!.expectedDid).toBe('did:plc:test123')
  })

  it('returns null for deleted sessions', () => {
    const signed = createOAuthSession(sampleOAuthSession)
    deleteOAuthSession(signed)
    expect(getOAuthSession(signed)).toBeNull()
  })

  it('returns null for non-existent sessions', () => {
    expect(getOAuthSession('fake.signature')).toBeNull()
  })
})

describe('user sessions', () => {
  it('creates and retrieves user sessions', () => {
    const signed = createUserSession(sampleUserSession)
    const retrieved = getUserSession(signed)
    expect(retrieved).not.toBeNull()
    expect(retrieved!.userDid).toBe('did:plc:test123')
    expect(retrieved!.userHandle).toBe('test.example.com')
  })

  it('returns null for deleted sessions', () => {
    const signed = createUserSession(sampleUserSession)
    deleteUserSession(signed)
    expect(getUserSession(signed)).toBeNull()
  })

  it('does not cross session types', () => {
    const oauthSigned = createOAuthSession(sampleOAuthSession)
    const userSigned = createUserSession(sampleUserSession)
    // OAuth signed ID should not return a user session
    expect(getUserSession(oauthSigned)).toBeNull()
    // User signed ID should not return an OAuth session
    expect(getOAuthSession(userSigned)).toBeNull()
  })
})

describe('getSessionFromCookie', () => {
  it('returns session when valid cookie exists', async () => {
    const signed = createUserSession(sampleUserSession)
    const mockCookieStore = { get: (name: string) => name === 'session_id' ? { value: signed } : undefined }
    const session = await getSessionFromCookie(mockCookieStore)
    expect(session).not.toBeNull()
    expect(session!.userDid).toBe('did:plc:test123')
  })

  it('returns null when no cookie', async () => {
    const mockCookieStore = { get: () => undefined }
    const session = await getSessionFromCookie(mockCookieStore)
    expect(session).toBeNull()
  })

  it('returns null when cookie has invalid value', async () => {
    const mockCookieStore = { get: () => ({ value: 'bad.signature' }) }
    const session = await getSessionFromCookie(mockCookieStore)
    expect(session).toBeNull()
  })
})
