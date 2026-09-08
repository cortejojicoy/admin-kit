import { serverConfig } from '@/admin.server'

/**
 * Minimal HS256 signing, so the example needs no JWT dependency. A real app
 * would sign upstream or use `jose`.
 */
export async function signToken(payload: Record<string, unknown>): Promise<string> {
  const secret = serverConfig.jwt?.secret ?? ''
  const encode = (value: object) => base64url(new TextEncoder().encode(JSON.stringify(value)))
  const data = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}`

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return `${data}.${base64url(new Uint8Array(signature))}`
}

function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
