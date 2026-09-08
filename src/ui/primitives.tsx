'use client'

import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '../utils/cn'
import { Icon } from '../icons/registry'

/**
 * The small set of primitives the kit's own screens are built from.
 *
 * Not a component library — just enough that the panels, the login page and the
 * generated CRUD screens look deliberate out of the box. Every one takes
 * `className`, so a consumer with their own design system restyles rather than
 * reimplements.
 */

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'danger' | 'ghost'
  size?: 'md' | 'sm'
  iconKey?: string
  /** Icon-only: renders a square button and requires `aria-label`. */
  iconOnly?: boolean
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'default', size = 'md', iconKey, iconOnly, loading, children, className, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={rest.type ?? 'button'}
      className={cn('ak-btn', className)}
      data-variant={variant}
      data-size={size}
      data-icon={iconOnly || undefined}
      data-loading={loading || undefined}
      disabled={disabled || loading}
      {...rest}
    >
      {iconKey ? <Icon iconKey={iconKey} /> : null}
      {children}
    </button>
  )
})

export function Card({
  title,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn('ak-card', className)}>
      {title || actions ? (
        <header className="ak-card__header">
          {title ? <h2 className="ak-card__title">{title}</h2> : null}
          <span className="ak-topbar__spacer" />
          {actions}
        </header>
      ) : null}
      {children != null ? <div className={cn('ak-card__body', bodyClassName)}>{children}</div> : null}
    </section>
  )
}

export function Badge({
  tone = 'default',
  children,
  className,
}: {
  tone?: 'default' | 'primary' | 'danger' | 'success' | 'warning'
  children: ReactNode
  className?: string
}) {
  return (
    <span className={cn('ak-badge', className)} data-tone={tone}>
      {children}
    </span>
  )
}

export interface FieldProps {
  label?: ReactNode
  htmlFor?: string
  help?: ReactNode
  error?: ReactNode
  required?: boolean
  children: ReactNode
  className?: string
}

export function Field({ label, htmlFor, help, error, required, children, className }: FieldProps) {
  return (
    <div className={cn('ak-field', className)}>
      {label ? (
        <label className="ak-label" htmlFor={htmlFor}>
          {label}
          {required ? <span aria-hidden> *</span> : null}
        </label>
      ) : null}
      {children}
      {help && !error ? <span className="ak-field__help">{help}</span> : null}
      {error ? <span className="ak-field__error">{error}</span> : null}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn('ak-input', className)} {...rest} />
  },
)

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn('ak-textarea', className)} {...rest} />
  },
)

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...rest }, ref) {
    return <select ref={ref} className={cn('ak-select', className)} {...rest} />
  },
)

export function SearchInput({
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn('ak-search', className)}>
      <Icon iconKey="search" />
      <input type="search" className="ak-input" {...rest} />
    </div>
  )
}

export function ErrorMessage({ error, className }: { error: unknown; className?: string }) {
  if (!error) return null
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Something went wrong.'
  return (
    <p className={cn('ak-error', className)} role="alert">
      {message}
    </p>
  )
}

export function EmptyState({ children, className }: { children?: ReactNode; className?: string }) {
  return <div className={cn('ak-empty', className)}>{children ?? 'Nothing here yet.'}</div>
}

export function Skeleton({ height = '1rem', width = '100%' }: { height?: string; width?: string }) {
  return <div className="ak-skeleton" style={{ height, width }} aria-hidden />
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  breadcrumb?: ReactNode
}) {
  return (
    <header className="ak-page__header">
      {breadcrumb}
      <div className="ak-topbar" style={{ height: 'auto', border: 0, background: 'none', padding: 0 }}>
        <div>
          <h1 className="ak-page__title">{title}</h1>
          {description ? <p className="ak-page__description">{description}</p> : null}
        </div>
        <span className="ak-topbar__spacer" />
        {actions}
      </div>
    </header>
  )
}
