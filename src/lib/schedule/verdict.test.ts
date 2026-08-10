import { describe, expect, it } from 'vitest'
import type { ParkingFeature } from '../../types/parking'
import { composeCurbVerdict } from './verdict'
import type { Schedule, Slot } from './types'

const TUE_3PM: Slot = {
  dayOfWeek: 2,
  minuteOfDay: 900,
  month: 5,
  dayOfMonth: 20,
  year: 2025,
}

const MON_FRI_8_6: Schedule = {
  v: 1,
  status: 'ok',
  source: 'Mon–Fri 8am–6pm',
  windows: [
    {
      days: [1, 2, 3, 4, 5],
      startMinute: 480,
      endMinute: 1080,
    },
  ],
}

function feature(
  category: string,
  schedule: Schedule | undefined,
  extras?: Partial<ParkingFeature['properties']>,
): ParkingFeature {
  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [
        [-79.4, 43.65],
        [-79.401, 43.651],
      ],
    },
    properties: {
      Highway: 'Test St',
      Rule: 'test rule',
      schedule_category: category,
      Side: 'North',
      max: null,
      maxMinutes: null,
      schedule,
      ...extras,
    },
  }
}

describe('composeCurbVerdict', () => {
  it('returns likely allowed when no features', () => {
    const v = composeCurbVerdict({
      features: [],
      slot: TUE_3PM,
      effectiveEndMinute: null,
      requestedDurationMinutes: 60,
    })
    expect(v.status).toBe('likely_allowed')
    expect(v.signageReminder).toBe('Check posted signs.')
    expect(v.primaryReason).toMatch(/incomplete/i)
  })

  it('marks active no parking as not allowed', () => {
    const v = composeCurbVerdict({
      features: [feature('no_parking', MON_FRI_8_6)],
      slot: TUE_3PM,
      effectiveEndMinute: 960,
      requestedDurationMinutes: 60,
    })
    expect(v.status).toBe('not_allowed')
    expect(v.activeRestrictions[0]?.kind).toBe('no_parking')
  })

  it('prefers no stopping over no parking', () => {
    const v = composeCurbVerdict({
      features: [
        feature('no_parking', MON_FRI_8_6),
        feature('no_stopping', MON_FRI_8_6),
      ],
      slot: TUE_3PM,
      effectiveEndMinute: null,
      requestedDurationMinutes: 60,
    })
    expect(v.status).toBe('not_allowed')
    expect(v.primaryReason).toMatch(/stopping/i)
  })

  it('warns when requested duration exceeds max stay', () => {
    const v = composeCurbVerdict({
      features: [
        feature('restricted_periods', MON_FRI_8_6, {
          max: '1 hour',
          maxMinutes: 60,
        }),
      ],
      slot: TUE_3PM,
      effectiveEndMinute: 1020,
      requestedDurationMinutes: 120,
    })
    expect(v.status).toBe('not_allowed')
    expect(v.maxStayWarning).toMatch(/1 hour/i)
  })

  it('returns schedule unclear for failed schedules without hard restriction', () => {
    const failed: Schedule = {
      v: 1,
      status: 'failed',
      source: 'bad',
      windows: [],
    }
    const v = composeCurbVerdict({
      features: [feature('no_parking', failed)],
      slot: TUE_3PM,
      effectiveEndMinute: null,
      requestedDurationMinutes: 60,
    })
    expect(v.status).toBe('schedule_unclear')
  })

  it('includes midnight warning when truncated', () => {
    const v = composeCurbVerdict({
      features: [],
      slot: TUE_3PM,
      effectiveEndMinute: 1439,
      requestedDurationMinutes: 180,
      truncatedAtMidnight: true,
    })
    expect(v.midnightWarning).toMatch(/midnight/i)
  })

  it('allows parking when restriction is inactive', () => {
    const sat: Slot = { ...TUE_3PM, dayOfWeek: 6, dayOfMonth: 24 }
    const v = composeCurbVerdict({
      features: [feature('no_parking', MON_FRI_8_6)],
      slot: sat,
      effectiveEndMinute: null,
      requestedDurationMinutes: 60,
    })
    expect(v.status).toBe('parking_allowed')
  })

  it('does not let a non-covering permitted window ban a covering sibling rule', () => {
    const daytime: Schedule = {
      v: 1,
      status: 'ok',
      source: 'Mon–Fri 8am–6pm',
      windows: [
        { days: [1, 2, 3, 4, 5], startMinute: 480, endMinute: 1080 },
      ],
    }
    const school: Schedule = {
      v: 1,
      status: 'ok',
      source: 'Mon–Fri 8–9 and 14:30–15:30',
      windows: [
        { days: [1, 2, 3, 4, 5], startMinute: 480, endMinute: 540 },
        { days: [1, 2, 3, 4, 5], startMinute: 870, endMinute: 930 },
      ],
    }
    // 5:35pm Monday — inside daytime window, outside school window
    const slot: Slot = {
      dayOfWeek: 1,
      minuteOfDay: 17 * 60 + 35,
      month: 8,
      dayOfMonth: 10,
      year: 2026,
    }
    const v = composeCurbVerdict({
      features: [
        feature('restricted_periods', daytime, {
          max: '1 hour',
          maxMinutes: 60,
          Rule: '8:00 a.m. to 6:00 p.m., Mon. to Fri.',
        }),
        feature('restricted_periods', school, {
          max: '10 mins.',
          maxMinutes: 10,
          Rule: '8:00 a.m. to 9:00 a.m. and 2:30 p.m. to 3:30 p.m., Mon. to Fri.',
        }),
      ],
      slot,
      effectiveEndMinute: 17 * 60 + 45,
      requestedDurationMinutes: 10,
    })
    expect(v.status).toBe('parking_allowed')
    expect(v.primaryReason).not.toMatch(/outside the permitted/i)
  })

  it('still bans when every permitted-window rule excludes the interval', () => {
    const school: Schedule = {
      v: 1,
      status: 'ok',
      source: 'Mon–Fri 8–9',
      windows: [
        { days: [1, 2, 3, 4, 5], startMinute: 480, endMinute: 540 },
      ],
    }
    const v = composeCurbVerdict({
      features: [feature('restricted_periods', school)],
      slot: TUE_3PM,
      effectiveEndMinute: null,
      requestedDurationMinutes: 30,
    })
    expect(v.status).toBe('not_allowed')
    expect(v.primaryReason).toMatch(/outside the permitted/i)
  })
})
