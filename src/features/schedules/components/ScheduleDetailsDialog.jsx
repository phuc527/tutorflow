import { BookOpen, Clock, GraduationCap, MapPin, Pencil, StickyNote, Trash2, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatInAppZone } from '@/utils/datetime'
import { studentName, timeRange } from './eventStyle'

function Row({ icon: Icon, label, children }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  )
}

/** Read-only details; Edit/Delete buttons appear only when `canManage`. */
export function ScheduleDetailsDialog({ schedule, onOpenChange, canManage, onEdit, onDelete }) {
  return (
    <Dialog open={Boolean(schedule)} onOpenChange={onOpenChange}>
      <DialogContent>
        {schedule && (
          <>
            <DialogHeader>
              <DialogTitle>{schedule.title}</DialogTitle>
              <DialogDescription>{formatInAppZone(schedule.start_time, 'EEEE, dd/MM/yyyy')}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <Row icon={Clock} label="Time (GMT+7)">
                <span className="tabular-nums">{timeRange(schedule)}</span>
              </Row>
              <Row icon={BookOpen} label="Subject">{schedule.subject}</Row>
              <Row icon={User} label="Student">{studentName(schedule)}</Row>
              <Row icon={GraduationCap} label="Teacher">{schedule.teacher?.full_name ?? '—'}</Row>
              <Row icon={MapPin} label="Location">{schedule.location ?? '—'}</Row>
              {schedule.notes && (
                <div className="sm:col-span-2">
                  <Row icon={StickyNote} label="Notes">
                    <span className="whitespace-pre-line">{schedule.notes}</span>
                  </Row>
                </div>
              )}
            </div>
            {canManage && (
              <DialogFooter>
                <Button variant="outline" className="text-danger" onClick={() => onDelete(schedule)}>
                  <Trash2 /> Delete
                </Button>
                <Button onClick={() => onEdit(schedule)}>
                  <Pencil /> Edit
                </Button>
              </DialogFooter>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
