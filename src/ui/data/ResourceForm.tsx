'use client'

import { useId, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useCreate, useOne, useResource, useUpdate } from '../../data/hooks'
import type { FieldDescriptor, NormalizedError, ResourceDescriptor } from '../../data/types'
import { cn, toText } from '../../utils/cn'
import { Button, Card, EmptyState, ErrorMessage, Field, Input, Select, Textarea } from '../primitives'
import { titleize } from './ResourceTable'

export interface ResourceFormProps {
  resource: string
  /** Omit to create; supply to edit. */
  id?: string | number
  fields?: FieldDescriptor[]
  title?: ReactNode
  /** Called with the saved record. */
  onSaved?: (record: unknown) => void
  onCancel?: () => void
  className?: string
}

/**
 * A create/edit form generated from field descriptors.
 *
 * Field-level errors from the backend are mapped onto the inputs that caused
 * them — `map.error` on the resource says where they live in the response —
 * because a validation failure rendered as one banner at the top of a
 * twelve-field form makes the user hunt for their own mistake.
 */
export function ResourceForm({
  resource,
  id,
  fields,
  title,
  onSaved,
  onCancel,
  className,
}: ResourceFormProps) {
  const descriptor = useResource(resource)
  const editing = id != null

  const { data, loading: loadingRecord, error: loadError } = useOne<Record<string, unknown>>(resource, id, {
    enabled: editing,
  })
  const create = useCreate(resource)
  const update = useUpdate(resource)
  const mutation = editing ? update : create

  const editable = useMemo(() => fields ?? formFields(descriptor), [fields, descriptor])
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [filledFrom, setFilledFrom] = useState<unknown>(undefined)
  const formId = useId()

  // Fill the form the moment the record arrives, and refill when a different
  // record replaces it — which is what switching rows in a drawer does.
  // Adjusted during render rather than in an effect so the inputs are never
  // painted empty for a frame with the data already in hand.
  if (data && data !== filledFrom) {
    setFilledFrom(data)
    setValues(data)
  }

  const fieldErrors = (mutation.error as NormalizedError | undefined)?.fields

  if (editing && loadingRecord && !data) return <EmptyState>Loading…</EmptyState>
  if (!mutation.allowed) {
    return <EmptyState>You do not have permission to {editing ? 'edit' : 'create'} this record.</EmptyState>
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // Only send what the form owns; a record fetched for editing carries
    // read-only server fields that many APIs reject on write.
    const payload: Record<string, unknown> = {}
    for (const field of editable) payload[field.name] = values[field.name] ?? null

    try {
      const saved = editing
        ? await update.mutate({ id: id, data: payload })
        : await create.mutate({ data: payload })
      onSaved?.(saved)
    } catch {
      // Surfaced below.
    }
  }

  return (
    <Card
      className={cn(className)}
      title={title ?? `${editing ? 'Edit' : 'New'} ${descriptor?.label ?? titleize(resource)}`}
    >
      <form id={formId} onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
        <ErrorMessage error={loadError} />
        <ErrorMessage error={mutation.error} />

        {editable.map((field) => {
          const inputId = `${formId}-${field.name}`
          return (
            <Field
              key={field.name}
              label={field.label ?? titleize(field.name)}
              htmlFor={inputId}
              required={field.required}
              help={field.help}
              error={firstError(fieldErrors?.[field.name])}
            >
              <FormInput
                id={inputId}
                field={field}
                value={values[field.name]}
                onChange={(value) => setValues((v) => ({ ...v, [field.name]: value }))}
              />
            </Field>
          )
        })}

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          {onCancel ? <Button onClick={onCancel}>Cancel</Button> : null}
          <Button type="submit" variant="primary" loading={mutation.loading}>
            {mutation.loading ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </Card>
  )
}

function FormInput({
  id,
  field,
  value,
  onChange,
}: {
  id: string
  field: FieldDescriptor
  value: unknown
  onChange: (value: unknown) => void
}) {
  const common = {
    id,
    name: field.name,
    required: field.required,
    disabled: field.readOnly,
    placeholder: field.placeholder,
  }

  switch (field.type) {
    case 'text':
      return (
        <Textarea {...common} value={asString(value)} onChange={(e) => onChange(e.target.value)} />
      )
    case 'boolean':
      return (
        <input
          {...common}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
      )
    case 'number':
      return (
        <Input
          {...common}
          type="number"
          value={toText(value)}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
      )
    case 'select':
      return (
        <Select {...common} value={asString(value)} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {field.options?.map((option) => (
            <option key={String(option.value)} value={String(option.value)}>
              {option.label}
            </option>
          ))}
        </Select>
      )
    case 'date':
      return (
        <Input
          {...common}
          type="date"
          value={asDateInput(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case 'datetime':
      return (
        <Input
          {...common}
          type="datetime-local"
          value={asDateTimeInput(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case 'json':
      return (
        <Textarea
          {...common}
          style={{ fontFamily: 'var(--ak-font-mono)', fontSize: '0.8125rem' }}
          value={typeof value === 'string' ? value : JSON.stringify(value ?? null, null, 2)}
          onChange={(e) => onChange(tryParse(e.target.value))}
        />
      )
    case 'email':
      return <Input {...common} type="email" value={asString(value)} onChange={(e) => onChange(e.target.value)} />
    default:
      return <Input {...common} type="text" value={asString(value)} onChange={(e) => onChange(e.target.value)} />
  }
}

/** Fields that belong on a form: everything not read-only, unless told otherwise. */
export function formFields(descriptor: ResourceDescriptor | undefined): FieldDescriptor[] {
  const fields = descriptor?.fields ?? []
  const explicit = fields.filter((f) => f.inForm === true)
  if (explicit.length > 0) return explicit
  return fields.filter((f) => f.inForm !== false && !f.readOnly)
}

function firstError(value: string | string[] | undefined): string | undefined {
  if (value == null) return undefined
  return Array.isArray(value) ? value[0] : value
}

function asString(value: unknown): string {
  return toText(value)
}

function asDateInput(value: unknown): string {
  if (!value) return ''
  const text = toText(value)
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? text : date.toISOString().slice(0, 10)
}

function asDateTimeInput(value: unknown): string {
  if (!value) return ''
  const text = toText(value)
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? text : date.toISOString().slice(0, 16)
}

/** Keep invalid JSON as text so the user can fix it rather than losing it. */
function tryParse(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}
