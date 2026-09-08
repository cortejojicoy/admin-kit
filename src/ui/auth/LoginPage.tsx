'use client'

import { useId, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useAuth } from '../../auth/useAuth'
import { useAdminConfig } from '../../context/AdminConfigContext'
import { useRouterBridge } from '../../context/RouterContext'
import { Icon } from '../../icons/registry'
import { cn } from '../../utils/cn'
import { Button, ErrorMessage, Field, Input } from '../primitives'

export interface LoginPageProps {
  /** Extra content below the form. */
  children?: ReactNode
  /** OAuth buttons. */
  providers?: Array<{ id: string; name: string; iconKey?: string }>
  onProviderClick?: (id: string) => void
  /** Field the credential form submits as the identifier. Default `email`. */
  identifierField?: string
  identifierLabel?: string
  identifierType?: 'email' | 'text'
  className?: string
}

/**
 * The default sign-in page.
 *
 * Replace it wholesale by passing `components={{ LoginPage }}` to
 * `<AdminProvider>` — a component override belongs there, not in config, which
 * has to stay serializable.
 *
 * After a successful sign-in it honours the `next` parameter the middleware set
 * when it bounced the user here, so a deep link survives the round trip through
 * the login page.
 */
export function LoginPage({
  children,
  providers,
  onProviderClick,
  identifierField = 'email',
  identifierLabel = 'Email',
  identifierType = 'email',
  className,
}: LoginPageProps) {
  const config = useAdminConfig()
  const { login, isLoading, error } = useAuth()
  const { replace } = useRouterBridge()

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const identifierId = useId()
  const passwordId = useId()

  const page = config.auth.loginPage

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      await login({ [identifierField]: identifier, password })
      replace(nextDestination(config.auth.afterLoginRedirect))
    } catch {
      // Already surfaced through auth context state.
    }
  }

  return (
    <div className={cn('ak-login', className)}>
      <div className="ak-login__card">
        {page.logoIconKey ? (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <Icon iconKey={page.logoIconKey} style={{ width: '2rem', height: '2rem' }} />
          </div>
        ) : null}

        <h1 className="ak-login__title">{page.title ?? 'Sign in'}</h1>
        {page.subtitle ? <p className="ak-login__subtitle">{page.subtitle}</p> : null}

        <form className="ak-login__form" onSubmit={handleSubmit}>
          <Field label={identifierLabel} htmlFor={identifierId} required>
            <Input
              id={identifierId}
              type={identifierType}
              autoComplete={identifierType === 'email' ? 'email' : 'username'}
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </Field>

          <Field label="Password" htmlFor={passwordId} required>
            <Input
              id={passwordId}
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          <ErrorMessage error={error} />

          <Button type="submit" variant="primary" loading={isLoading} disabled={isLoading}>
            {isLoading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        {providers?.length ? (
          <div>
            <div className="ak-login__divider">
              <span>or continue with</span>
            </div>
            <div className="ak-login__providers">
              {providers.map((provider) => (
                <Button
                  key={provider.id}
                  iconKey={provider.iconKey}
                  onClick={() => onProviderClick?.(provider.id)}
                >
                  Continue with {provider.name}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        {children}
      </div>
    </div>
  )
}

/**
 * Read the post-login destination from the URL, refusing anything that isn't a
 * same-site path — an open redirect through `?next=` is the classic way a login
 * page becomes a phishing tool.
 */
export function nextDestination(fallback: string, search?: string): string {
  const query = search ?? (typeof window === 'undefined' ? '' : window.location.search)
  if (!query) return fallback
  const next = new URLSearchParams(query).get('next')
  if (!next) return fallback
  if (!next.startsWith('/') || next.startsWith('//')) return fallback
  return next
}
