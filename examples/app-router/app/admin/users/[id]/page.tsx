import { PageHeader, ResourceForm, ResourceShow } from '@cortejojicoy/admin-kit/ui'

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <>
      <PageHeader title="Person" description={`Record ${id}`} />
      <div style={{ display: 'grid', gap: '1.25rem' }}>
        <ResourceShow resource="users" id={id} />
        <ResourceForm resource="users" id={id} />
      </div>
    </>
  )
}
