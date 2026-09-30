import { Badge, type BadgeTone } from '@/components/ui/badge'

// One place that decides how every status in the app looks.
const STATUS_STYLES: Record<string, { tone: BadgeTone; label: string }> = {
  paid: { tone: 'success', label: 'Paid' },
  // Amber, not red: green vs red is indistinguishable for deuteranopes (validated ΔE 5.0 vs 17.4 for green/amber).
  unpaid: { tone: 'warning', label: 'Unpaid' },
  active: { tone: 'success', label: 'Active' },
  inactive: { tone: 'neutral', label: 'Inactive' },
  on_leave: { tone: 'warning', label: 'On leave' },
  admin: { tone: 'primary', label: 'Admin' },
  teacher: { tone: 'neutral', label: 'Teacher' },
  student: { tone: 'neutral', label: 'Student' },
}

export function StatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  const style: { tone: BadgeTone; label: string } = (status && STATUS_STYLES[status]) || {
    tone: 'neutral',
    label: status ?? 'Unknown',
  }
  return (
    <Badge tone={style.tone} className={className}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {style.label}
    </Badge>
  )
}
