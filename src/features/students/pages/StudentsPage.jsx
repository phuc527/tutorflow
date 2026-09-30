import { Construction } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/States'
import { Card } from '@/components/ui/card'

// Placeholder: replaced with the real feature in Phase 3.
export default function StudentsPage() {
  return (
    <>
      <PageHeader title="Students" description="Manage students and teacher assignments." />
      <Card>
        <EmptyState icon={Construction} title="Not built yet" description="This page is implemented in Phase 3." />
      </Card>
    </>
  )
}
