import { defineAdminServerConfig } from '@cortejojicoy/admin-kit'

/**
 * Server-only configuration. Never imported from a client component, which is
 * what keeps the signing key out of the browser bundle.
 */
export const serverConfig = defineAdminServerConfig({
  jwt: {
    secret: process.env.JWT_SECRET ?? 'example-development-secret-not-for-production',
    algorithms: ['HS256'],
    cookieName: 'axiomkit_session',
  },
})
