# Authentication

The kit ships three auth providers — `jwt`, `oauth` and `custom` — and treats
sign-in as one more endpoint you declare rather than a convention it invents.

Authentication answers *who is this*. [Access control](./access-control.md)
answers *what may they do*; the two are configured separately and enforced in
different places.

## Choosing a provider

| Provider | Use it when | Session read on the server by |
| --- | --- | --- |
| `jwt` | Your backend issues a signed token | `getServerSession()` verifying the cookie |
| `oauth` | Sign-in is delegated to an identity provider | Your own callback and session store |
| `custom` | Anything else — an SDK, a session service | Your provider's `getSession()` |

## JWT

```ts
auth: {
  provider: 'jwt',
  jwt: {
    endpoints: {
      login:   '/api/auth/login',
      me:      '/api/auth/me',
      logout:  '/api/auth/logout',   // optional
      refresh: '/api/auth/refresh',  // optional
    },
    tokenStorage: 'server-cookie',
    cookieName: 'axiomkit_session',
    header: { name: 'Authorization', prefix: 'Bearer ' },
    mapUser: (raw) => ({ id: raw.sub, email: raw.email, roles: raw.roles }),
    mapTokens: (raw) => ({ accessToken: raw.access_token, expiresAt: raw.exp }),
  },
  loginPage: { path: '/login', subtitle: 'Sign in to continue' },
  rolesField: 'roles',
}
```

The signing secret does **not** go here:

```ts
// admin.server.ts
export const serverConfig = defineAdminServerConfig({
  jwt: { secret: process.env.JWT_SECRET, algorithms: ['HS256'], cookieName: 'axiomkit_session' },
})
```

In 0.1.x the secret sat on `config.auth.jwt.secret`. That survived only because
Next strips non-`NEXT_PUBLIC_` environment variables from client bundles — one
hardcoded string or one `NEXT_PUBLIC_` prefix away from shipping the signing key
to the browser. It is still read as a deprecated fallback, and
`serializeConfig()` strips it defensively.

### Where the token lives

`tokenStorage` is the security decision on this page.

| Value | Who can read the token | Notes |
| --- | --- | --- |
| `server-cookie` *(default)* | Nobody in the browser | The login route sets `HttpOnly; Secure`. The only option not readable by injected script |
| `js-cookie` | Any script on the origin | Opt in only when the token must be read from JS |
| `localStorage` | Any script on the origin | Also invisible to middleware and server components, so route protection must be client-side |
| `memory` | The page, until reload | Useful for embedded or test usage |

With `server-cookie`, your login route sets the cookie and the client never
touches the token:

```ts
// app/api/auth/login/route.ts
import { sessionCookie } from '@cortejojicoy/admin-kit/server'

export async function POST(request: Request) {
  const { email, password } = await request.json()
  const token = await signInAgainstYourBackend(email, password)
  if (!token) return Response.json({ message: 'Invalid credentials' }, { status: 401 })

  return Response.json(
    { ok: true },
    { headers: { 'Set-Cookie': sessionCookie(token, { name: 'axiomkit_session', maxAge: 60 * 60 * 8 }) } },
  )
}
```

`sessionCookie()` defaults to `HttpOnly`, `Secure`, `SameSite=Lax` and `Path=/`.
`clearSessionCookie()` is its counterpart for logout — same attributes,
`Max-Age=0`.

### Reading the session on the server

```ts
import { getServerSession, rolesFromSession } from '@cortejojicoy/admin-kit/server'

// App Router: a server component or route handler
const session = await getServerSession(adminConfig, { headers: await headers() }, { serverConfig })

// Pages Router: getServerSideProps
const session = await getServerSession(adminConfig, { headers: req.headers }, { serverConfig })

const roles = rolesFromSession(adminConfig, session)   // uses auth.rolesField
```

It verifies the cookie, so a missing or invalid token returns `null` rather than
a session you have to second-guess. It throws if no secret was supplied — an
explicit error beats silently treating every request as signed out.

`verifyJWT(token, secret, { algorithms })` is exported if you need it directly.
It handles HMAC (`HS256` and friends); for RS256, pass your own `verify` to the
middleware and verify with `jose` in your route handlers.

## OAuth

```ts
auth: {
  provider: 'oauth',
  oauth: {
    providers: [
      {
        id: 'google',
        name: 'Google',
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
        clientId: process.env.GOOGLE_CLIENT_ID!,
        scopes: ['openid', 'email', 'profile'],
        mapUser: (raw) => ({ id: raw.sub, email: raw.email, name: raw.name }),
      },
    ],
    callbackPath: '/api/auth/callback/:provider',
  },
}
```

The kit renders the provider buttons and starts the flow. The callback, the
token exchange and the session store stay in your app — which is why
`getServerSession()` returns `null` for this provider: there is no token here
for it to verify without your store. Read the session your way and pass it to
`<AdminProvider initialSession={…}>`.

`clientSecret` belongs in a server-only module, never in the config the client
imports.

## Custom

Implement the strategy interface and hand it over:

```ts
import type { AuthProvider } from '@cortejojicoy/admin-kit'

const provider: AuthProvider = {
  name: 'session-service',
  initialize: () => restoreFromSdk(),
  login: (credentials) => sdk.signIn(credentials),
  logout: () => sdk.signOut(),
  getSession: () => sdk.currentSession(),
  refresh: () => sdk.refresh(),
}

auth: { provider: 'custom', custom: provider }
```

`custom` holds a live object, so it is client-side config only —
`serializeConfig()` strips it at the RSC boundary, and the client re-attaches it
from its own import of the same module.

## In the client

```tsx
'use client'
import { useAuth } from '@cortejojicoy/admin-kit/client'

function Header() {
  const { user, status, isAuthenticated, isLoading, login, logout, error } = useAuth()
  if (isLoading) return <Skeleton />
  return isAuthenticated ? <UserMenu /> : <a href="/login">Sign in</a>
}
```

`status` is `'idle' | 'loading' | 'authenticated' | 'unauthenticated'`.
`useOptionalAuth()` is the same hook outside a provider, returning `null`
instead of throwing.

## The login page

```tsx
// app/login/page.tsx
import { LoginPage } from '@cortejojicoy/admin-kit/ui'
export default function Page() {
  return <LoginPage />
}
```

Title, subtitle, logo key and path come from `auth.loginPage`. To replace the
page entirely, pass a component where components belong:

```tsx
<AdminProvider config={adminConfig} components={{ LoginPage: MyLoginPage }}>
```

After a successful sign-in the user goes to `auth.afterLoginRedirect` (defaults
to the app panel's home), or to the `next` query parameter the middleware set
when it redirected them.

## Middleware

```ts
// middleware.ts
import { createAdminMiddleware } from '@cortejojicoy/admin-kit/middleware'
import { adminConfig } from './admin.config'

export default createAdminMiddleware(adminConfig, {
  secret: process.env.JWT_SECRET,
  algorithms: ['HS256'],
  publicRoutes: ['/health'],     // merged with auth.publicRoutes
  returnParam: 'next',
  verify: async (token) => ({ valid: await verifyRs256(token) }),   // replaces verification
})

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'] }
```

It does one job: send a browser with no usable session to the login page instead
of rendering a shell that will fail every request it makes. It is a **UX
redirect**. For the `oauth` and `custom` providers it has no way to check
anything beyond "a cookie is present", and presence is not authentication.

Put the real checks in route handlers and server components —
`getServerSession()` then `assertPermission()`. See [Access
control](./access-control.md).

## Environment variables

| Variable | Used by | Required |
| --- | --- | --- |
| `JWT_SECRET` | `getServerSession`, `createAdminMiddleware` | With the `jwt` provider |
| `API_BASE_URL` | Server-side access-axis fetches | When the API is not same-origin |

`npx admin-kit docs` writes an `auth.md` listing your endpoint table, your
session storage and its exposure, and the environment variables your config
implies.
