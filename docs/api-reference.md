# API reference

Every export, by sub-path. The sub-path is not cosmetic: it names the
environment the module belongs to, which is what stops a server-only module from
drifting into a client bundle unnoticed.

| Sub-path | Contents | Environment |
| --- | --- | --- |
| `@cortejojicoy/admin-kit` | Config helpers, types, pure logic | Anywhere, including plain Node |
| `…/client` | `AdminProvider`, contexts, hooks | Client |
| `…/data` | CRUD hooks, data provider, resource types | Client |
| `…/access` | Engine, `<Can>`, guards | Client |
| `…/ui` | Panels, primitives, generated screens | Client |
| `…/server` | Session, access gates, cookies | Server |
| `…/middleware` | `createAdminMiddleware` | Edge |
| `…/styles.css` | The stylesheet | — |

Both ESM and CJS are published, with types for each.

## `@cortejojicoy/admin-kit`

Free of React and DOM code on purpose — the CLI imports your config through it,
and edge middleware loads it too.

### Config

| Export | Signature |
| --- | --- |
| `defineAdminConfig` | `(config: AdminConfig) => AdminConfig` |
| `defineAdminServerConfig` | `(config: AdminServerConfig) => AdminServerConfig` |
| `resolveConfig` | `(config: AdminConfig) => ResolvedAdminConfig` |
| `serializeConfig` | `(config: AdminConfig) => AdminConfig` — strips maps, `auth.custom`, plugins, secrets |
| `findUnserializable` | `(value: unknown, path?: string) => string[]` |

Constants: `DEFAULT_LOGIN_PATH`, `DEFAULT_AFTER_LOGIN`, `DEFAULT_AFTER_LOGOUT`,
`DEFAULT_APP_HOME`, `DEFAULT_ADMIN_BASE`.

### Navigation and modules

| Export | Signature |
| --- | --- |
| `buildNav` | Config sections plus plugin sections, merged by id |
| `modulesToSections` | Module descriptors → nav sections |
| `filterNav` | `(nav, engine) => NavSection[]` |
| `buildModules` | Catalog entries + descriptors → modules |
| `tileModules` / `dockModules` | Placement-filtered views |
| `catalogFromDescriptors` | A catalog from descriptors alone, for a static install |
| `copyFor` | `(copy: FlavoredCopy, flavor?) => string \| undefined` |
| `createPluginRegistry` / `createModuleRegistry` | Registry helpers |

### Access

| Export | Signature |
| --- | --- |
| `createAccessEngine` | `(snapshot: AccessSnapshot, config?: AccessConfig) => AccessEngine` |
| `expandRoles` | `(roles, { roles, hierarchy }) => { roles, grants }` |
| `matchesPattern` | `(pattern: string, code: string) => boolean` |
| `ACCESS_LEVELS` | `readonly ['none', 'view', 'full']` |
| `atLeast` | `(level, required) => boolean` |
| `rankOf` / `strongest` / `isAccessLevel` | Level arithmetic |
| `toAccessLevel` | Coerce any backend shape into a level |
| `toPermissionsMap` | Normalize a whole permissions payload |
| `EMPTY_SNAPSHOT` | A snapshot that grants nothing and claims nothing |

`AccessEngine`: `isAdmin`, `roles`, `levelFor`, `can`, `canAny`, `canAll`,
`levelForModule`, `entitled`, `moduleVisible`.

### Data and HTTP

| Export | Signature |
| --- | --- |
| `createRestDataProvider` | `({ resources, baseUrl }) => DataProvider` |
| `buildListQuery` | List params → query string, per `QueryNaming` |
| `fillPath` | Fill `:param` segments in a path template |
| `createHttpClient` | A small fetch wrapper |
| `HttpError` | Thrown by the client; carries `status` |
| `joinUrl` / `appendQuery` | URL helpers |
| `DataStore` | The cache |
| `cacheKey` / `resourcePrefix` | Cache key helpers |

### Theme and utils

`DEFAULT_TOKENS`, `DARK_TOKENS`, `tokensToStyle`, `tokensFromPrimary`, `cn`.

### Types

`AdminConfig`, `AdminServerConfig`, `ResolvedAdminConfig`, `AuthConfig`,
`AppConfig`, `LayoutConfig`, `ThemeConfig`, `LoginPageConfig`, `LoginPageProps`,
`RouterFlavor`, `PanelsConfig`, `AppPanelConfig`, `AdminPanelConfig`,
`AuthUser`, `AuthSession`, `AuthState`, `AuthStatus`, `AuthActions`,
`AuthContextValue`, `AuthProvider`, `JWTAuthConfig`, `JWTEndpoints`,
`TokenStorage`, `OAuthConfig`, `OAuthProviderConfig`, `NavItem`, `NavSection`,
`AdminPlugin`, `ModuleDescriptor`, `ModulePlacement`, `FlavoredCopy`,
`AccessConfig`, `AccessSnapshot`, `AccessLevel`, `PermissionsMap`,
`ModuleCatalogEntry`, `OnUnavailable`, `PermissionsAxisConfig`,
`EntitlementsAxisConfig`, `CatalogAxisConfig`, `AccessEngine`,
`ModuleAccessShape`, `DataProvider`, `ResourceDescriptor`, `ResourceEndpoints`,
`ResourceMappers`, `EndpointDescriptor`, `FieldDescriptor`, `ListParams`,
`ListResult`, `NormalizedError`, `QueryNaming`, `CrudOperation`, `HttpMethod`,
`HttpClient`, `HttpClientOptions`, `HttpRequest`.

`AdminModule` is a deprecated alias of `AdminPlugin`, kept until 1.0.

## `…/client`

Everything here is a client module; the published bundle carries the
`"use client"` directive.

### Provider

```tsx
<AdminProvider
  config={adminConfig}
  initialSession={session}
  snapshot={snapshot}
  icons={icons}
  plugins={[billing]}
  dataProvider={provider}
  router={appRouterAdapter}
  components={{ LoginPage }}
>
```

`snapshotFromUser()` derives a snapshot from a user object, for apps whose `/me`
payload already carries roles and permissions.

### Contexts and hooks

| Export | Purpose |
| --- | --- |
| `useAdminConfig` / `useOptionalAdminConfig` | The resolved config |
| `AdminConfigProvider` | Config alone, without the rest |
| `RouterProvider`, `useRouterBridge`, `useCurrentPath`, `isActivePath` | Routing bridge |
| `AuthContextProvider`, `AuthContext`, `useAuth`, `useOptionalAuth` | Auth state and actions |
| `createJWTProvider`, `createOAuthProvider`, `createCustomProvider` | Provider factories |
| `AccessProvider`, `useAccess`, `usePermissions`, `useCan`, `useModuleVisible`, `Can`, `IfAdmin` | Access bindings |
| `PluginProvider`, `usePlugins`, `useModules`, `WidgetSlot` | Plugins and widgets |
| `IconProvider`, `Icon`, `useIcon`, `useIconRegistry`, `BUILTIN_ICONS` | Icons |
| `ThemeProvider`, `ThemeContext`, `useTheme` | Theme |
| `DataProviderContext`, `DataStoreProvider`, `useDataProvider`, `useDataStore` | Data plumbing |
| `useAppRouter`, `useAppPathname`, `useAppSearchParams`, `AppLink`, `appRouterAdapter` | App Router |
| `usePagesRouter`, `usePagesPathname`, `usePagesSearchParams`, `PagesLink`, `pagesRouterAdapter` | Pages Router |

Types: `AdminProviderProps`, `RouterBridge`, `IconComponent`, `IconRegistry`,
`ThemeMode`, `ThemeContextValue`.

## `…/data`

| Export | Signature |
| --- | --- |
| `useList` | `(resource, options?) => UseListResult<T>` |
| `useOne` | `(resource, id) => UseOneResult<T>` |
| `useCreate` / `useUpdate` / `useDelete` | `(resource) => MutationResult` |
| `useAction` | `(resource, action) => MutationResult` |
| `useResource` | `(name) => ResourceDescriptor \| undefined` |
| `defineResource` | Identity helper, for the inference |
| `createRestDataProvider`, `buildListQuery`, `fillPath`, `defaultListMapper` | REST provider |
| `DataStore`, `cacheKey`, `resourcePrefix`, `stableStringify` | Cache |
| `createHttpClient`, `HttpError` | HTTP |

`UseListResult`: `rows`, `total`, `loading`, `validating`, `error`, `allowed`,
`page`, `perPage`, `pageCount`, `setPage`, `refetch`.

See [Resources & CRUD](./resources.md).

## `…/access`

`AccessProvider`, `useAccess`, `usePermissions`, `useCan`, `useModuleVisible`,
`Can`, `IfAdmin`, `RequireAuth`, `RequirePermission`, `AppRouterGuard`,
`PagesRouterGuard`, plus the engine and level helpers re-exported from the core
entry.

Types: `AccessProviderProps`, `CanProps`.

These hide controls and redirect browsers. They do not protect endpoints — see
[Access control](./access-control.md).

## `…/ui`

### Panels

`AdminShell`, `Sidebar`, `Brand`, `SidebarNav`, `SidebarItem`, `AppShell`,
`AppLauncher`, `LauncherTile`, `LauncherGreeting`, `Dock`, `QuickAccessBar`,
`QuickAccessDock`, `UserMenu`.

### Auth

`LoginPage`, `nextDestination`, `RequireAuth`, `RequirePermission`.

### Generated screens

| Component | Props |
| --- | --- |
| `ResourceTable` | `resource`, `title`, `fields`, `hrefFor`, `actions`, `rowActions`, `searchable`, `className` |
| `ResourceForm` | `resource`, `id`, `fields`, `title`, `onSaved`, `onCancel`, `className` |
| `ResourceShow` | `resource`, `id`, `fields`, `title`, `actions`, `className` |

Helpers: `listColumns`, `formatCell`, `titleize`, `formFields`.

### Primitives

`Button`, `Card`, `Badge`, `Field`, `Input`, `Textarea`, `Select`,
`SearchInput`, `ErrorMessage`, `EmptyState`, `Skeleton`, `PageHeader`.

### Hooks

`useDisclosure`, `useMediaQuery`, `useLocalStorage`, `useSlideTransition`,
`useDismiss`.

## `…/server`

No `"use client"` directive, and it deliberately pulls in server-side
primitives. Never import it from a client component.

| Export | Signature |
| --- | --- |
| `getServerSession` | `(config, req, options?) => Promise<AuthSession \| null>` |
| `rolesFromSession` | `(config, session) => string[]` |
| `verifyJWT` | `(token, secret, options?) => Promise<VerifyResult>` |
| `serializeCookie` | `(name, value, opts?) => string` |
| `parseCookies` | `(header) => Record<string, string>` |
| `readCookieFromRequest` | `(req, name) => string \| null` |
| `sessionCookie` | HttpOnly, Secure, SameSite=Lax by default |
| `clearSessionCookie` | The same, with `Max-Age=0` |
| `resolveAccess` | `(config, options) => Promise<AccessSnapshot>` |
| `resolveCatalog` | Catalog axis alone |
| `checkModule` | `=> { ok: true } \| { ok: false, error }` |
| `requireModule` | Throws `AccessDeniedError` |
| `requireEntitlement` | Tenant axis only |
| `requireAdmin` | Fails **closed** |
| `assertPermission` | `(config, code, { level?, roles?, snapshot? })` |
| `resolveModules` | Modules visible to this snapshot |
| `AccessDeniedError` | `reason`, `code`, `redirectTo` |

Also re-exported for server use: `resolveConfig`, `serializeConfig`,
`buildModules`, `tileModules`, `dockModules`, `buildNav`, `filterNav`,
`createAccessEngine`.

Types: `ServerSessionOptions`, `RequestLike`, `JWTPayload`, `VerifyResult`,
`VerifyOptions`, `CookieOptions`, `ResolveAccessOptions`, `GuardOptions`.

## `…/middleware`

```ts
createAdminMiddleware(config: AdminConfig, options?: AdminMiddlewareOptions)
```

| Option | Default | Meaning |
| --- | --- | --- |
| `secret` | — | HMAC secret; prefer this over `config.auth.jwt.secret` |
| `algorithms` | `['HS256']` | Accepted algorithms |
| `verify` | — | Replace verification entirely, e.g. RS256 via `jose` |
| `publicRoutes` | — | Merged with `config.auth.publicRoutes` |
| `serverConfig` | — | Pass the whole server config instead |
| `returnParam` | `'next'` | Query param carrying the post-login destination |

It is a UX redirect, not the authorization boundary. See
[Access control](./access-control.md).

## `…/styles.css`

```tsx
import '@cortejojicoy/admin-kit/styles.css'
```

One stylesheet, driven by CSS custom properties. See [Theming](./theming.md).
