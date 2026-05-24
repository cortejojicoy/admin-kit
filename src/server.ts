/**
 * Server entry — Node/edge-safe helpers usable in server components,
 * route handlers, getServerSideProps, and middleware.
 *
 * Never import this from a client component (it intentionally has no
 * "use client" directive and pulls in server-side primitives).
 */

export { getServerSession } from './auth/server/getServerSession'
export { verifyJWT } from './auth/server/verifyJWT'
export type { JWTPayload, VerifyResult } from './auth/server/verifyJWT'
export { serializeCookie, parseCookies, readCookieFromRequest } from './auth/server/cookies'
export type { CookieOptions } from './auth/server/cookies'
