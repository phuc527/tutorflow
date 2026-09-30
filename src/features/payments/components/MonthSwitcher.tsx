import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addMonths } from 'date-fns'
import { Button } from '@/components/ui/button'
import { parseDayKey, dayKey } from '@/utils/calendar'
import { formatInAppZone } from '@/utils/datetime'

/** Prev / "October 2026" / next. Works in every browser (unlike <input type="month"> on desktop Safari). */
export function MonthSwitcher({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  const shift = (n: number) => onChange(dayKey(addMonths(parseDayKey(month), n)))
  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label="Previous month">
        <ChevronLeft />
      </Button>
      <span className="min-w-36 text-center text-sm font-semibold" aria-live="polite">
        {formatInAppZone(parseDayKey(month), 'MMMM yyyy')}
      </span>
      <Button variant="outline" size="icon" onClick={() => shift(1)} aria-label="Next month">
        <ChevronRight />
      </Button>
    </div>
  )
}
