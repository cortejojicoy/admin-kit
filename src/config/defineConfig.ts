import type { AdminConfig, AdminServerConfig } from './types'

/**
 * Identity helper that gives consumers full type-checking on their config.
 *
 *   export const adminConfig = defineAdminConfig({
 *     app: { name: 'Acme Admin' },
 *     auth: { provider: 'jwt', jwt: { endpoints: { login: '…', me: '…' } } },
 *   })
 */
export function defineAdminConfig<T extends AdminConfig>(config: T): T {
  return config
}

/**
 * The server-only half. Keep it in its own file — `admin.server.ts` — and never
 * import that file from a client component:
 *
 *   // admin.server.ts
 *   export const serverConfig = defineAdminServerConfig({
 *     jwt: { secret: process.env.JWT_SECRET, algorithms: ['HS256'] },
 *   })
 */
export function defineAdminServerConfig<T extends AdminServerConfig>(config: T): T {
  return config
}
