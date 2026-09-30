import { Construction } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/States'
import { Card } from '@/components/ui/card'

// Placeholder: replaced with the real feature in Phase 4.
export default function SchedulesPage() {
  return (
    <>
      <PageHeader title="Schedules" description="Class calendar and schedule list." />
      <Card>
        <EmptyState icon={Construction} title="Not built yet" description="This page is implemented in Phase 4." />
      </Card>
    </>
  )
}
