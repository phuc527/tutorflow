import { useState } from 'react'
import { Info, Plus } from 'lucide-react'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { FilterSelect } from '@/components/common/ListControls'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorState, LoadingState } from '@/components/common/States'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PERMISSIONS } from '@/constants/permissions'
import { useAuth } from '@/features/auth/authContext'
import { useStudentOptions } from '@/features/students/hooks'
import { useTeacherOptions } from '@/features/teachers/hooks'
import { usePermission } from '@/hooks/usePermission'
import { daysBetween, shiftAnchor, todayKey } from '@/utils/calendar'
import type { Schedule } from '@/services/schedulesService'
import { formatDateTime } from '@/utils/datetime'
import { CalendarToolbar } from '../components/CalendarToolbar'
import { MonthView } from '../components/MonthView'
import { ScheduleDetailsDialog } from '../components/ScheduleDetailsDialog'
import { ScheduleFormModal } from '../components/ScheduleFormModal'
import { ScheduleListView } from '../components/ScheduleListView'
import { TimeGridView } from '../components/TimeGridView'
import { useCalendarParams, useDeleteSchedule, useSchedulesInRange } from '../hooks'

type DialogState =
  | { mode: 'details' | 'edit' | 'delete'; schedule: Schedule }
  | { mode: 'create'; initial: { date: string; start: string } }
  | null

export default function SchedulesPage() {
  const { profile, teacherId } = useAuth()
  const hasPermission = usePermission(PERMISSIONS.MANAGE_SCHEDULES)
  const isAdminView = usePermission(PERMISSIONS.VIEW_TEACHERS)
  // A teacher login must be linked to an active teacher record to create classes (RLS requires the same).
  // The admin manages every teacher's classes and picks the teacher in the form.
  const teacherInactive = profile?.teacher?.status === 'inactive'
  const canManage = hasPermission && (isAdminView || (Boolean(teacherId) && !teacherInactive))

  const { params, setParams } = useCalendarParams()
  const schedulesQuery = useSchedulesInRange(params)
  const teacherOptions = useTeacherOptions({ enabled: isAdminView })
  const studentOptions = useStudentOptions()

  const [dialog, setDialog] = useState<DialogState>(null)
  const close = () => setDialog(null)
  const deleteSchedule = useDeleteSchedule({ onSuccess: close })

  const openDetails = (schedule: Schedule) => setDialog({ mode: 'details', schedule })
  const openCreate = (date: string, start: string) => setDialog({ mode: 'create', initial: { date, start } })
  const selected = dialog && dialog.mode !== 'create' ? dialog.schedule : null

  const schedules = schedulesQuery.data ?? []
  const days = daysBetween(schedulesQuery.range.from, schedulesQuery.range.to)

  const renderView = () => {
    if (schedulesQuery.isPending) return <LoadingState rows={8} />
    if (schedulesQuery.error) return <ErrorState error={schedulesQuery.error} onRetry={schedulesQuery.refetch} />
    switch (params.view) {
      case 'month':
        return (
          <MonthView
            range={schedulesQuery.range}
            anchorKey={params.date}
            schedules={schedules}
            onEventClick={openDetails}
            onDayClick={(date) => setParams({ view: 'day', date })}
          />
        )
      case 'list':
        return <ScheduleListView schedules={schedules} onEventClick={openDetails} showTeacher={isAdminView} />
      default:
        return (
          <TimeGridView
            days={days}
            schedules={schedules}
            onEventClick={openDetails}
            onSlotClick={canManage ? openCreate : undefined}
          />
        )
    }
  }

  return (
    <>
      <PageHeader
        title="Schedules"
        description={isAdminView ? 'All classes across teachers. Times shown in Vietnam time (GMT+7).' : 'Your classes. Times shown in Vietnam time (GMT+7).'}
        actions={
          canManage && (
            <Button onClick={() => openCreate(params.view === 'day' ? params.date : todayKey(), '')}>
              <Plus /> New class
            </Button>
          )
        }
      />

      {hasPermission && !canManage && (
        <p className="mb-4 flex items-start gap-2 rounded-md bg-warning-soft p-3 text-sm text-warning">
          <Info className="mt-0.5 size-4 shrink-0" />
          {teacherInactive
            ? 'Your teacher record is inactive, so you cannot manage classes.'
            : 'Your login is not linked to a teacher record yet. Ask the administrator to create one with your email.'}
        </p>
      )}

      <Card className="overflow-hidden">
        <CalendarToolbar
          view={params.view}
          date={params.date}
          onNavigate={(direction) => setParams({ date: shiftAnchor(params.view, params.date, direction) })}
          onToday={() => setParams({ date: todayKey() })}
          onViewChange={(view) => setParams({ view })}
        >
          {isAdminView && (
            <FilterSelect
              value={params.teacherId}
              onChange={(teacherId) => setParams({ teacherId })}
              options={(teacherOptions.data ?? []).map((t) => ({ value: t.id, label: t.full_name }))}
              allLabel="All teachers"
            />
          )}
          <FilterSelect
            value={params.studentId}
            onChange={(studentId) => setParams({ studentId })}
            options={(studentOptions.data ?? []).map((s) => ({ value: s.id, label: s.full_name }))}
            allLabel="All students"
          />
          {schedulesQuery.isFetching && !schedulesQuery.isPending && (
            <span className="self-center text-xs text-muted-foreground">Refreshing…</span>
          )}
        </CalendarToolbar>
        {renderView()}
      </Card>

      <ScheduleDetailsDialog
        schedule={dialog?.mode === 'details' ? selected : null}
        onOpenChange={(open) => !open && close()}
        canManage={canManage}
        onEdit={(schedule) => setDialog({ mode: 'edit', schedule })}
        onDelete={(schedule) => setDialog({ mode: 'delete', schedule })}
      />

      {canManage && (
        <>
          <ScheduleFormModal
            open={dialog?.mode === 'create' || dialog?.mode === 'edit'}
            onOpenChange={(open) => !open && close()}
            schedule={dialog?.mode === 'edit' ? selected : null}
            initial={dialog?.mode === 'create' ? dialog.initial : null}
            teacherId={isAdminView ? null : teacherId}
            chooseTeacher={isAdminView}
          />
          <ConfirmDialog
            open={dialog?.mode === 'delete'}
            onOpenChange={(open) => !open && close()}
            title="Delete this class?"
            description={
              dialog?.mode === 'delete'
                ? `"${dialog.schedule.title}" on ${formatDateTime(dialog.schedule.start_time)} will be permanently removed.`
                : ''
            }
            confirmLabel="Delete class"
            isPending={deleteSchedule.isPending}
            onConfirm={() => selected && deleteSchedule.mutate(selected.id)}
          />
        </>
      )}
    </>
  )
}
