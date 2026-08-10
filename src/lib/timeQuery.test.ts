import { describe, expect, it } from 'vitest'
import {
  createNowTimeQuery,
  formatDurationLabel,
  MIDNIGHT_MINUTE,
  resolveTimeQuery,
  type TimeQuery,
} from './timeQuery'

describe('resolveTimeQuery', () => {
  it('uses now for mode=now', () => {
    const fixed = new Date(2025, 4, 20, 14, 30, 0)
    const q = createNowTimeQuery(60, 60)
    const r = resolveTimeQuery(q, fixed)
    expect(r.slot.minuteOfDay).toBe(14 * 60 + 30)
    expect(r.effectiveEndMinute).toBe(14 * 60 + 30 + 60)
    expect(r.truncatedAtMidnight).toBe(false)
  })

  it('truncates at midnight and preserves requested duration', () => {
    const q: TimeQuery = {
      mode: 'custom',
      date: '2025-05-20',
      startMinute: 22 * 60,
      requestedDurationMinutes: 180,
      durationPreset: 180,
    }
    const r = resolveTimeQuery(q)
    expect(r.truncatedAtMidnight).toBe(true)
    expect(r.effectiveEndMinute).toBe(MIDNIGHT_MINUTE)
    expect(r.requestedDurationMinutes).toBe(180)
  })

  it('point-checks when duration is zero', () => {
    const q: TimeQuery = {
      mode: 'custom',
      date: '2025-05-20',
      startMinute: 600,
      requestedDurationMinutes: 0,
      durationPreset: 'custom',
    }
    const r = resolveTimeQuery(q)
    expect(r.effectiveEndMinute).toBeNull()
    expect(r.truncatedAtMidnight).toBe(false)
  })
})

describe('formatDurationLabel', () => {
  it('formats minutes and hours', () => {
    expect(formatDurationLabel(30)).toBe('30m')
    expect(formatDurationLabel(60)).toBe('1h')
    expect(formatDurationLabel(120)).toBe('2h')
  })
})
