'use client'

import { useState, useId } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../useAuth'
import type { LoginPageConfig, LoginPageProps } from '../../config/types'
import { cn } from '../../utils/cn'

export interface AdminLoginPageProps extends LoginPageProps {
  config?: LoginPageConfig
  /** OAuth provider buttons to render alongside the form. */
  oauthProviders?: Array<{ id: string; name: string; icon?: React.ReactNode }>
  /** Called when an OAuth button is clicked. */
  onOAuthClick?: (providerId: string) => void
  className?: string
}

/**
 * Default login page. Consumers can replace it entirely via
 * `config.auth.loginPage.component`, or keep this shell and just override
 * the logo/title via `config.auth.loginPage`.
 */
export function LoginPage({ config, oauthProviders, onOAuthClick, className }: AdminLoginPageProps) {
  const { login, isLoading, error } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const emailId = useId()
  const passwordId = useId()

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      await login({ email, password })
    } catch {
      // Error is already surfaced via context state.
    }
  }

  return (
    <div className={cn('admin-kit-login', 'min-h-screen flex items-center justify-center p-6 bg-neutral-50', className)}>
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        {config?.logo ? <div className="mb-4 flex justify-center">{config.logo}</div> : null}
        <h1 className="text-xl font-semibold text-neutral-900">{config?.title ?? 'Sign in'}</h1>
        {config?.subtitle ? <p className="mt-1 text-sm text-neutral-500">{config.subtitle}</p> : null}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor={emailId} className="block text-sm font-medium text-neutral-700">Email</label>
            <input
              id={emailId}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>
          <div>
            <label htmlFor={passwordId} className="block text-sm font-medium text-neutral-700">Password</label>
            <input
              id={passwordId}
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
          >
            {isLoading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {oauthProviders?.length ? (
          <div className="mt-6">
            <div className="relative my-4 text-center text-xs uppercase text-neutral-400">
              <span className="bg-white px-2">or continue with</span>
              <span className="absolute inset-x-0 top-1/2 -z-10 h-px bg-neutral-200" />
            </div>
            <div className="flex flex-col gap-2">
              {oauthProviders.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onOAuthClick?.(p.id)}
                  className="flex items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
                >
                  {p.icon}
                  <span>Continue with {p.name}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
