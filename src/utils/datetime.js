import { format as fnsFormat } from 'date-fns'
import { TZDate, tz } from '@date-fns/tz'
import { APP_TIMEZONE } from '@/constants/app'

/*
  Time handling rule for the whole app:
  - The database stores timestamptz (an absolute instant, UTC internally).
  - The UI ALWAYS shows and accepts times in Asia/Ho_Chi_Minh,
    regardless of the browser's own timezone.
*/

const inAppZone = { in: tz(APP_TIMEZONE) }

/** Format a Date / ISO string / epoch in the app timezone. Returns '—' for empty values. */
export function formatInAppZone(value, pattern = 'dd/MM/yyyy HH:mm') {
  if (value === null || value === undefined || value === '') return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return fnsFormat(date, pattern, inAppZone)
}

export const formatDate = (value) => formatInAppZone(value, 'dd/MM/yyyy')
export const formatTime = (value) => formatInAppZone(value, 'HH:mm')
export const formatDateTime = (value) => formatInAppZone(value, 'dd/MM/yyyy HH:mm')

/** The current instant, as a Date whose calendar fields are in the app timezone. */
export function nowInAppZone() {
  return TZDate.tz(APP_TIMEZONE)
}

/** First day of the current month in the app timezone, as 'yyyy-MM-01' (the payments.billing_month format). */
export function currentBillingMonth() {
  return formatInAppZone(new Date(), 'yyyy-MM-01')
}

/**
 * Convert an <input type="datetime-local"> value ("2026-09-30T14:00"),
 * which has no timezone, into an ISO instant by reading it as app-timezone wall time.
 */
export function appZoneInputToISO(localValue) {
  if (!localValue) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(localValue)
  if (!match) return null
  const [, y, mo, d, h, mi] = match.map(Number)
  const wallTime = new TZDate(y, mo - 1, d, h, mi, 0, 0, APP_TIMEZONE)
  return new Date(wallTime.getTime()).toISOString() // normalise to UTC "Z" form
}

/** Reverse of appZoneInputToISO: ISO instant → "yyyy-MM-ddTHH:mm" in app timezone. */
export function isoToAppZoneInput(value) {
  if (!value) return ''
  return formatInAppZone(value, "yyyy-MM-dd'T'HH:mm")
}

/** Any date (including a TZDate, whose toISOString keeps its offset) → canonical UTC "…Z" string for the API. */
export function toUtcISO(value) {
  return new Date(new Date(value).getTime()).toISOString()
}

/** payments.billing_month ('2026-10-01', a DATE with no time) → '10/2026'. Vietnam has no DST, so +07:00 is fixed. */
export function formatBillingMonth(billingMonth, pattern = 'MM/yyyy') {
  return formatInAppZone(`${billingMonth}T00:00:00+07:00`, pattern)
}
