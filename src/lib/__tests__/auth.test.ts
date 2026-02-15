import { describe, it, expect } from 'vitest'
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  generateDpopKeyPair,
  restoreDpopKeyPair,
  createDpopProof,
} from '../auth'

describe('PKCE helpers', () => {
  it('generateCodeVerifier returns a base64url string', () => {
    const verifier = generateCodeVerifier()
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(verifier.length).toBeGreaterThan(0)
  })

  it('generateCodeVerifier produces unique values', () => {
    const a = generateCodeVerifier()
    const b = generateCodeVerifier()
    expect(a).not.toBe(b)
  })

  it('generateCodeChallenge produces a base64url SHA-256 hash', () => {
    const verifier = generateCodeVerifier()
    const challenge = generateCodeChallenge(verifier)
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(challenge.length).toBe(43) // SHA-256 base64url = 43 chars
  })

  it('generateCodeChallenge is deterministic', () => {
    const verifier = 'test-verifier'
    const a = generateCodeChallenge(verifier)
    const b = generateCodeChallenge(verifier)
    expect(a).toBe(b)
  })

  it('different verifiers produce different challenges', () => {
    const a = generateCodeChallenge('verifier-a')
    const b = generateCodeChallenge('verifier-b')
    expect(a).not.toBe(b)
  })
})

describe('generateState', () => {
  it('returns a base64url string', () => {
    const state = generateState()
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('produces unique values', () => {
    const a = generateState()
    const b = generateState()
    expect(a).not.toBe(b)
  })
})

describe('DPoP key pair', () => {
  it('generateDpopKeyPair returns public and private keys', () => {
    const { publicKey, privateKey, publicJwk, privateJwk } = generateDpopKeyPair()
    expect(publicKey).toBeDefined()
    expect(privateKey).toBeDefined()
    expect(publicJwk.kty).toBe('EC')
    expect(publicJwk.crv).toBe('P-256')
    expect(privateJwk.d).toBeDefined() // private key has d parameter
  })

  it('restoreDpopKeyPair roundtrips correctly', () => {
    const original = generateDpopKeyPair()
    const restored = restoreDpopKeyPair(original.privateJwk)
    expect(restored.publicJwk.x).toBe(original.publicJwk.x)
    expect(restored.publicJwk.y).toBe(original.publicJwk.y)
  })
})

describe('createDpopProof', () => {
  it('returns a valid JWT structure (3 base64url parts)', () => {
    const { privateKey, publicJwk } = generateDpopKeyPair()
    const proof = createDpopProof({
      privateKey,
      jwk: publicJwk,
      method: 'POST',
      url: 'https://example.com/token',
    })

    const parts = proof.split('.')
    expect(parts).toHaveLength(3)
    parts.forEach(part => {
      expect(part).toMatch(/^[A-Za-z0-9_-]+$/)
    })
  })

  it('header contains correct typ and alg', () => {
    const { privateKey, publicJwk } = generateDpopKeyPair()
    const proof = createDpopProof({
      privateKey,
      jwk: publicJwk,
      method: 'POST',
      url: 'https://example.com/token',
    })

    const header = JSON.parse(Buffer.from(proof.split('.')[0], 'base64url').toString())
    expect(header.alg).toBe('ES256')
    expect(header.typ).toBe('dpop+jwt')
    expect(header.jwk).toBeDefined()
    expect(header.jwk.kty).toBe('EC')
  })

  it('payload contains required claims', () => {
    const { privateKey, publicJwk } = generateDpopKeyPair()
    const proof = createDpopProof({
      privateKey,
      jwk: publicJwk,
      method: 'POST',
      url: 'https://example.com/token',
    })

    const payload = JSON.parse(Buffer.from(proof.split('.')[1], 'base64url').toString())
    expect(payload.jti).toBeDefined()
    expect(payload.htm).toBe('POST')
    expect(payload.htu).toBe('https://example.com/token')
    expect(payload.iat).toBeTypeOf('number')
  })

  it('includes nonce when provided', () => {
    const { privateKey, publicJwk } = generateDpopKeyPair()
    const proof = createDpopProof({
      privateKey,
      jwk: publicJwk,
      method: 'POST',
      url: 'https://example.com/token',
      nonce: 'test-nonce-123',
    })

    const payload = JSON.parse(Buffer.from(proof.split('.')[1], 'base64url').toString())
    expect(payload.nonce).toBe('test-nonce-123')
  })

  it('includes ath when accessToken provided', () => {
    const { privateKey, publicJwk } = generateDpopKeyPair()
    const proof = createDpopProof({
      privateKey,
      jwk: publicJwk,
      method: 'GET',
      url: 'https://example.com/resource',
      accessToken: 'test-access-token',
    })

    const payload = JSON.parse(Buffer.from(proof.split('.')[1], 'base64url').toString())
    expect(payload.ath).toBeDefined()
    expect(payload.ath).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('generates unique jti for each proof', () => {
    const { privateKey, publicJwk } = generateDpopKeyPair()
    const proof1 = createDpopProof({ privateKey, jwk: publicJwk, method: 'POST', url: 'https://example.com' })
    const proof2 = createDpopProof({ privateKey, jwk: publicJwk, method: 'POST', url: 'https://example.com' })

    const payload1 = JSON.parse(Buffer.from(proof1.split('.')[1], 'base64url').toString())
    const payload2 = JSON.parse(Buffer.from(proof2.split('.')[1], 'base64url').toString())
    expect(payload1.jti).not.toBe(payload2.jti)
  })
})
