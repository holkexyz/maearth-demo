import { NextResponse } from 'next/server'
import {
  getBaseUrl, generateCodeVerifier, generateCodeChallenge,
  generateState, generateDpopKeyPair, createDpopProof,
  PAR_ENDPOINT, AUTH_ENDPOINT, TOKEN_ENDPOINT,
  resolveHandleToDid, resolveDidToPds, discoverOAuthEndpoints,
} from '@/lib/auth'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const baseUrl = getBaseUrl()

  try {
    const url = new URL(request.url)
    const email = url.searchParams.get('email') || ''
    const handle = (url.searchParams.get('handle') || '').replace(/^@/, '').trim()

    // Determine endpoints: dynamic for handle, hardcoded for email
    let parEndpoint = PAR_ENDPOINT
    let authEndpoint = AUTH_ENDPOINT
    let tokenEndpoint = TOKEN_ENDPOINT

    if (handle) {
      console.log('[oauth/login] Resolving handle:', handle)
      const did = await resolveHandleToDid(handle)
      console.log('[oauth/login] Resolved DID:', did)
      const pdsUrl = await resolveDidToPds(did)
      console.log('[oauth/login] Resolved PDS:', pdsUrl)
      const endpoints = await discoverOAuthEndpoints(pdsUrl)
      console.log('[oauth/login] Discovered endpoints:', endpoints)
      parEndpoint = endpoints.parEndpoint
      authEndpoint = endpoints.authEndpoint
      tokenEndpoint = endpoints.tokenEndpoint
    }

    const clientId = `${baseUrl}/client-metadata.json`
    const redirectUri = `${baseUrl}/api/oauth/callback`

    // Generate PKCE
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)
    const state = generateState()

    // Generate DPoP proof for PAR
    const { privateKey, publicJwk, privateJwk } = generateDpopKeyPair()
    const dpopProof = createDpopProof({
      privateKey, jwk: publicJwk,
      method: 'POST',
      url: parEndpoint,
    })

    // Push Authorization Request (PAR)
    const parBody = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'atproto transition:generic',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    })

    console.log('[oauth/login] Sending PAR to', parEndpoint)

    const parRes = await fetch(parEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'DPoP': dpopProof,
      },
      body: parBody.toString(),
    })

    if (!parRes.ok) {
      const errText = await parRes.text()
      console.error('[oauth/login] PAR failed:', parRes.status, errText)

      // Check for DPoP nonce requirement
      const dpopNonce = parRes.headers.get('dpop-nonce')
      if (dpopNonce && parRes.status === 400) {
        console.log('[oauth/login] Retrying with DPoP nonce...')
        const dpopProof2 = createDpopProof({
          privateKey, jwk: publicJwk,
          method: 'POST',
          url: parEndpoint,
          nonce: dpopNonce,
        })

        const parRes2 = await fetch(parEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'DPoP': dpopProof2,
          },
          body: parBody.toString(),
        })

        if (!parRes2.ok) {
          const errText2 = await parRes2.text()
          console.error('[oauth/login] PAR retry failed:', parRes2.status, errText2)
          return NextResponse.redirect(new URL(`/?error=${encodeURIComponent('PAR failed: ' + errText2)}`, baseUrl))
        }

        const parData2 = await parRes2.json() as { request_uri: string }
        const loginHint = email ? `&login_hint=${encodeURIComponent(email)}` : ''
        const authUrl = `${authEndpoint}?client_id=${encodeURIComponent(clientId)}&request_uri=${encodeURIComponent(parData2.request_uri)}${loginHint}`
        console.log('[oauth/login] Redirecting to auth (after nonce retry)')
        const resp2 = NextResponse.redirect(authUrl)
        resp2.cookies.set('oauth_state', JSON.stringify({ state, codeVerifier, dpopPrivateJwk: privateJwk, tokenEndpoint }), { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/' })
        return resp2
      }

      return NextResponse.redirect(new URL(`/?error=${encodeURIComponent('PAR failed: ' + errText)}`, baseUrl))
    }

    const parData = await parRes.json() as { request_uri: string }
    const loginHintParam = email ? `&login_hint=${encodeURIComponent(email)}` : ''
    const authUrl = `${authEndpoint}?client_id=${encodeURIComponent(clientId)}&request_uri=${encodeURIComponent(parData.request_uri)}${loginHintParam}`

    console.log('[oauth/login] Redirecting to auth:', authUrl.substring(0, 200))
    const response = NextResponse.redirect(authUrl)
    response.cookies.set('oauth_state', JSON.stringify({ state, codeVerifier, dpopPrivateJwk: privateJwk, tokenEndpoint }), { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/' })
    return response
  } catch (err) {
    console.error('[oauth/login] Error:', err)
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(errorMsg)}`, baseUrl))
  }
}
