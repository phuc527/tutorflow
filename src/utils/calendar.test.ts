import { describe, expect, test } from 'vitest'
import {
  dayKey,
  daysBetween,
  eventsForDay,
  getViewRange,
  layoutDayEvents,
  parseDayKey,
  shiftAnchor,
  viewTitle,
} from './calendar'
import { appZoneInputToISO, formatDateTime, isoToAppZoneInput, toUtcISO } from './datetime'

describe('app-timezone conversions (process TZ is America/New_York)', () => {
  test('a wall time typed in the form is stored as the right UTC instant', () => {
    expect(appZoneInputToISO('2026-10-01T09:00')).toBe('2026-10-01T02:00:00.000Z')
  })

  test('round trip back to the form value', () => {
    expect(isoToAppZoneInput('2026-10-01T02:00:00.000Z')).toBe('2026-10-01T09:00')
  })

  test('display uses Ho Chi Minh time', () => {
    // 20:30 UTC on 30 Sep is 03:30 on 1 Oct in Vietnam
    expect(formatDateTime('2026-09-30T20:30:00Z')).toBe('01/10/2026 03:30')
    expect(dayKey('2026-09-30T20:30:00Z')).toBe('2026-10-01')
  })
})

describe('view ranges', () => {
  test('day view is midnight to midnight in Vietnam', () => {
    const { from, to } = getViewRange('day', '2026-10-01')
    // TZDate.toISOString() keeps the +07:00 offset; toUtcISO normalises it (what we send to the API)
    expect(toUtcISO(from)).toBe('2026-09-30T17:00:00.000Z')
    expect(toUtcISO(to)).toBe('2026-10-01T17:00:00.000Z')
  })

  test('week view starts on Monday', () => {
    // 1 Oct 2026 is a Thursday → week of Mon 28 Sep
    const { from, to } = getViewRange('week', '2026-10-01')
    expect(dayKey(from)).toBe('2026-09-28')
    expect(daysBetween(from, to).map(dayKey)).toEqual([
      '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
    ])
  })

  test('month view covers whole weeks around the month', () => {
    const { from, to } = getViewRange('month', '2026-10-15')
    expect(dayKey(from)).toBe('2026-09-28')
    expect(dayKey(to)).toBe('2026-11-02')
    expect(daysBetween(from, to)).toHaveLength(35)
  })

  test('navigation and titles', () => {
    expect(shiftAnchor('week', '2026-10-01', 1)).toBe('2026-10-08')
    expect(shiftAnchor('month', '2026-01-31', 1)).toBe('2026-02-28')
    expect(shiftAnchor('day', '2026-10-01', -1)).toBe('2026-09-30')
    expect(viewTitle('month', '2026-10-01')).toBe('October 2026')
    expect(viewTitle('week', '2026-10-01')).toBe('28 Sep – 04 Oct 2026')
  })
})

describe('day layout', () => {
  const s = (id: string, start: string, end: string) => ({ id, start_time: start, end_time: end })

  test('events are placed by minutes from Vietnamese midnight and clipped at day edges', () => {
    const day = parseDayKey('2026-10-01')
    const events = eventsForDay(
      [
        s('a', '2026-10-01T09:00+07:00', '2026-10-01T10:30+07:00'),
        s('overnight', '2026-10-01T23:00+07:00', '2026-10-02T01:00+07:00'),
        s('other-day', '2026-10-02T09:00+07:00', '2026-10-02T10:00+07:00'),
      ],
      day,
    )
    expect(events.map((e) => [e.schedule.id, e.start, e.end])).toEqual([
      ['a', 540, 630],
      ['overnight', 1380, 1440],
    ])
  })

  test('overlapping events get separate lanes; a later free slot reuses lane 0', () => {
    const laid = layoutDayEvents([
      { id: 1, start: 540, end: 600 },
      { id: 2, start: 560, end: 620 },
      { id: 3, start: 600, end: 660 }, // overlaps 2 only → reuses lane 0
      { id: 4, start: 700, end: 720 }, // separate cluster
    ])
    const byId = Object.fromEntries(laid.map((e) => [e.id, [e.lane, e.laneCount]]))
    expect(byId).toEqual({ 1: [0, 2], 2: [1, 2], 3: [0, 2], 4: [0, 1] })
  })
})

describe('chunk reload + billing month', () => {
  test('[FE-1] recognises dynamic-import failures after a redeploy', async () => {
    const { isChunkLoadError } = await import('./chunkReload')
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /assets/PaymentsPage-abc.js'))).toBe(true)
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false)
  })

  test('currentBillingMonth is the first of the month in Vietnam time', async () => {
    const { currentBillingMonth } = await import('./datetime')
    expect(currentBillingMonth()).toMatch(/^\d{4}-\d{2}-01$/)
  })
})
