import { Badge } from '@/components/ui/badge'

// One place that decides how every status in the app looks.
const STATUS_STYLES = {
  paid: { tone: 'success', label: 'Paid' },
  unpaid: { tone: 'danger', label: 'Unpaid' },
  active: { tone: 'success', label: 'Active' },
  inactive: { tone: 'neutral', label: 'Inactive' },
  on_leave: { tone: 'warning', label: 'On leave' },
  admin: { tone: 'primary', label: 'Admin' },
  teacher: { tone: 'neutral', label: 'Teacher' },
}

export function StatusBadge({ status, className }) {
  const style = STATUS_STYLES[status] ?? { tone: 'neutral', label: status ?? 'Unknown' }
  return (
    <Badge tone={style.tone} className={className}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {style.label}
    </Badge>
  )
}
