/**
 * Server entry — session reading, the access gates, and cookie helpers.
 *
 * Never import this from a client component: it has no `"use client"`
 * directive and deliberately pulls in server-side primitives.
 */

export { getServerSession, rolesFromSession } from './auth/server/getServerSession'
export type { ServerSessionOptions, RequestLike } from './auth/server/getServerSession'

export { verifyJWT } from './auth/server/verifyJWT'
export type { JWTPayload, VerifyResult, VerifyOptions } from './auth/server/verifyJWT'

export {
  serializeCookie,
  parseCookies,
  readCookieFromRequest,
  sessionCookie,
  clearSessionCookie,
} from './auth/server/cookies'
export type { CookieOptions } from './auth/server/cookies'

export { resolveAccess, resolveCatalog } from './access/server/resolve'
export type { ResolveAccessOptions } from './access/server/resolve'

export {
  AccessDeniedError,
  checkModule,
  requireModule,
  requireEntitlement,
  requireAdmin,
  assertPermission,
  resolveModules,
} from './access/server/guards'
export type { GuardOptions } from './access/server/guards'

export { resolveConfig } from './config/defaults'
export { serializeConfig } from './config/serialize'
export { buildModules, tileModules, dockModules } from './modules/catalog'
export { buildNav } from './navigation/buildNav'
export { filterNav } from './navigation/filterNav'
export { createAccessEngine } from './access/engine'
