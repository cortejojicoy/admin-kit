import { Card, PageHeader } from '@cortejojicoy/admin-kit/ui'

export default function AdminOverviewPage() {
  return (
    <>
      <PageHeader
        title="Administration"
        description="Configuration that supports the day-to-day work, not the work itself."
      />
      <Card title="About this panel">
        <p style={{ margin: 0, color: 'var(--ak-text-muted)' }}>
          Everything here is admin-gated at the layout. Daily operations live in the app
          panel — use the account menu to cross back.
        </p>
      </Card>
    </>
  )
}
