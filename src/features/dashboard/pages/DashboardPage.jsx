import { Link } from 'react-router'
import { CalendarClock, CalendarDays, CheckCircle2, CircleDashed, GraduationCap, MapPin, Users } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PERMISSIONS } from '@/constants/permissions'
import { useAuth } from '@/features/auth/authContext'
import { eventColor, studentName, timeRange } from '@/features/schedules/components/eventStyle'
import { usePermission } from '@/hooks/usePermission'
import { cn } from '@/lib/utils'
import { dayKey, todayKey } from '@/utils/calendar'
import { formatBillingMonth, formatInAppZone } from '@/utils/datetime'
import { PaymentTrendChart } from '../components/PaymentTrendChart'
import { StatCard } from '../components/StatCard'
import { useDashboardSummary, useUpcomingClasses } from '../hooks'

function greeting() {
  const hour = Number(formatInAppZone(new Date(), 'H'))
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function DashboardPage() {
  const { profile } = useAuth()
  const isAdmin = usePermission(PERMISSIONS.VIEW_TEACHERS)
  const summaryQuery = useDashboardSummary()
  const upcomingQuery = useUpcomingClasses()

  const s = summaryQuery.data
  const loading = summaryQuery.isPending
  const monthLabel = s ? formatBillingMonth(s.billing_month) : ''

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${profile.full_name.split(' ').at(-1) || profile.email}`}
        description={`${formatInAppZone(new Date(), 'EEEE, dd MMMM yyyy')} · ${isAdmin ? 'Centre overview' : 'Your teaching overview'}`}
      />

      {summaryQuery.error ? (
        <Card className="mb-6">
          <ErrorState title="Couldn't load statistics" error={summaryQuery.error} onRetry={summaryQuery.refetch} />
        </Card>
      ) : (
        <div className={cn('mb-6 grid grid-cols-2 gap-3', isAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-4')}>
          {isAdmin && <StatCard icon={GraduationCap} label="Teachers" value={s?.teachers} hint="Active & on leave" isLoading={loading} />}
          <StatCard icon={Users} label={isAdmin ? 'Active students' : 'My students'} value={s?.students} isLoading={loading} />
          <StatCard icon={CalendarDays} label="Today's classes" value={s?.today_classes} isLoading={loading} />
          <StatCard
            icon={CheckCircle2}
            label="Paid students"
            value={s?.paid_students}
            hint={monthLabel && `Fully paid for ${monthLabel}`}
            iconClassName="bg-success-soft text-success"
            isLoading={loading}
          />
          <StatCard
            icon={CircleDashed}
            label="Unpaid students"
            value={s?.unpaid_students}
            hint={monthLabel && `Outstanding for ${monthLabel}`}
            iconClassName="bg-warning-soft text-warning"
            isLoading={loading}
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Monthly payment summary</CardTitle>
            <CardDescription>Amounts billed over the last 6 months (VND)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <LoadingState rows={4} className="p-0" /> : s ? <PaymentTrendChart data={s.monthly ?? []} /> : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Upcoming classes</CardTitle>
              <CardDescription>{isAdmin ? 'Next classes across the centre' : 'Your next classes'}</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/schedules?view=list">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0">
            {upcomingQuery.isPending ? (
              <LoadingState rows={4} className="py-0" />
            ) : upcomingQuery.error ? (
              <ErrorState error={upcomingQuery.error} onRetry={upcomingQuery.refetch} />
            ) : upcomingQuery.data.length === 0 ? (
              <EmptyState icon={CalendarClock} title="No upcoming classes" className="py-8" />
            ) : (
              <ul className="divide-y">
                {upcomingQuery.data.map((c) => {
                  const isToday = dayKey(c.start_time) === todayKey()
                  return (
                    <li key={c.id} className="flex items-start gap-3 px-5 py-3">
                      <div className={cn('w-14 shrink-0 rounded border-l-4 px-1.5 py-1 text-center text-xs', eventColor(c.teacher_id))}>
                        <div className="font-semibold">{formatInAppZone(c.start_time, 'dd/MM')}</div>
                        <div className="opacity-80">{formatInAppZone(c.start_time, 'EEE')}</div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium">{c.title}</p>
                          {isToday && <Badge tone="primary">Today</Badge>}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          <span className="tabular-nums">{timeRange(c)}</span> · {studentName(c)}
                          {isAdmin && c.teacher && ` · ${c.teacher.full_name}`}
                        </p>
                        {c.location && (
                          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <MapPin className="size-3" /> {c.location}
                          </p>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
