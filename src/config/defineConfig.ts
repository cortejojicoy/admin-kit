import type { AdminConfig } from './types'

/**
 * Identity helper that gives consumers full type-checking on their admin config.
 *
 *   export const adminConfig = defineAdminConfig({
 *     app: { name: 'My Admin' },
 *     auth: { provider: 'jwt', jwt: { endpoints: { login: '/api/auth/login', me: '/api/auth/me' } } },
 *     navigation: { sections: [...] },
 *   })
 */
export function defineAdminConfig<T extends AdminConfig>(config: T): T {
  return config
}
