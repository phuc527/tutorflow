import { Construction } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/States'
import { Card } from '@/components/ui/card'

// Placeholder: replaced with the real feature in Phase 3.
export default function TeachersPage() {
  return (
    <>
      <PageHeader title="Teachers" description="Manage teacher records." />
      <Card>
        <EmptyState icon={Construction} title="Not built yet" description="This page is implemented in Phase 3." />
      </Card>
    </>
  )
}
