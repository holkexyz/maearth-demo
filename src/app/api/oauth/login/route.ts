import { NextResponse } from 'next/server'
import { getOAuthClient, getBaseUrl } from '@/lib/auth'

export const runtime = 'nodejs'

export async function GET() {
  try {
    console.log('[oauth/login] Starting OAuth flow...')
    const client = await getOAuthClient()
    console.log('[oauth/login] OAuth client created, authorizing against pds.certs.network...')

    const url = await client.authorize('pds.certs.network', {
      scope: 'atproto transition:generic',
    })

    console.log('[oauth/login] Got authorize URL:', url.toString().substring(0, 200))
    return NextResponse.redirect(url.toString())
  } catch (err) {
    console.error('[oauth/login] Error:', err instanceof Error ? err.message : err)
    console.error('[oauth/login] Stack:', err instanceof Error ? err.stack : 'no stack')
    // Return error details in dev/debug mode
    const baseUrl = getBaseUrl()
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(errorMsg)}`, baseUrl)
    )
  }
}
