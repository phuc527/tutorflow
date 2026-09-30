import { useState } from 'react'
import { addMonths } from 'date-fns'
import { CalendarDays } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States'
import { Card, CardContent } from '@/components/ui/card'
import { MonthSwitcher } from '@/features/payments/components/MonthSwitcher'
import { dayKey, parseDayKey } from '@/utils/calendar'
import { currentBillingMonth, formatInAppZone, formatTime } from '@/utils/datetime'
import type { PortalClass } from '@/services/portalService'
import { NotLinkedState } from '../components/NotLinkedState'
import { useMySchedule, useMyStudents } from '../hooks'

export default function MyClassesPage() {
  const [month, setMonth] = useState(currentBillingMonth)
  const students = useMyStudents()
  const from = parseDayKey(month)
  const range = { from: from.toISOString(), to: addMonths(from, 1).toISOString() }
  const linked = Boolean(students.data?.length)
  const classes = useMySchedule(range, { enabled: linked })
  const showStudent = (students.data?.length ?? 0) > 1

  const byDay = new Map<string, PortalClass[]>()
  for (const c of classes.data ?? []) {
    const key = dayKey(c.start_time)
    byDay.set(key, [...(byDay.get(key) ?? []), c])
  }

  let body
  if (students.isLoading || (linked && classes.isLoading)) body = <LoadingState />
  else if (students.error || classes.error) body = <ErrorState error={students.error ?? classes.error} onRetry={() => (students.error ? students.refetch() : classes.refetch())} />
  else if (!linked) body = <NotLinkedState />
  else if (!byDay.size) body = <EmptyState icon={CalendarDays} title="No classes this month" />
  else
    body = (
      <div className="grid gap-4">
        {[...byDay].map(([key, items]) => (
          <Card key={key}>
            <CardContent className="grid gap-3 p-4">
              <h2 className="text-sm font-semibold">{formatInAppZone(parseDayKey(key), 'EEEE, dd/MM')}</h2>
              {items.map((c) => (
                <div key={c.id} className="flex flex-col gap-0.5 border-l-2 border-primary pl-3 text-sm">
                  <span className="font-medium tabular-nums">
                    {formatTime(c.start_time)}–{formatTime(c.end_time)} · {c.subject}
                  </span>
                  <span>{c.title}</span>
                  <span className="text-muted-foreground">
                    {c.teacher_name}
                    {c.location ? ` · ${c.location}` : ''}
                  </span>
                  {showStudent && <span className="text-xs text-primary">{c.student_name}</span>}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    )

  return (
    <>
      <PageHeader title="My classes" actions={linked && <MonthSwitcher month={month} onChange={setMonth} />} />
      {body}
    </>
  )
}
