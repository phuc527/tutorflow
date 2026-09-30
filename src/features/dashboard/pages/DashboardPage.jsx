import { Construction } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/States'
import { Card } from '@/components/ui/card'

// Placeholder: replaced with the real feature in Phase 5.
export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" description="Overview of your tutoring center." />
      <Card>
        <EmptyState icon={Construction} title="Not built yet" description="This page is implemented in Phase 5." />
      </Card>
    </>
  )
}
