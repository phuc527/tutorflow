import { UserX } from 'lucide-react'
import { EmptyState } from '@/components/common/States'

export function NotLinkedState() {
  return (
    <EmptyState
      icon={UserX}
      title="Your account isn’t linked to a student yet"
      description="Contact your tutoring center and ask them to add your email to the student’s record."
    />
  )
}
