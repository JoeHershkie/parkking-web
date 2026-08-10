import {
  formatSlotLabel,
  slotFromDate,
  slotFromDateString,
  slotToDateString,
  type Slot,
} from './schedule'

export const DURATION_PRESETS = [30, 60, 120, 180] as const
export type DurationPreset = (typeof DURATION_PRESETS)[number] | 'custom'

export type TimeMode = 'now' | 'custom'

export type TimeQuery = {
  mode: TimeMode
  /** Calendar date YYYY-MM-DD when mode is custom; ignored when now. */
  date: string
  /** Start minute of day when mode is custom. */
  startMinute: number
  /** Requested duration in minutes (preserved even when truncated). */
  requestedDurationMinutes: number
  durationPreset: DurationPreset
}

export type ResolvedTimeQuery = {
  slot: Slot
  /** Effective end minute of day, or null when duration is zero/point check. */
  effectiveEndMinute: number | null
  requestedDurationMinutes: number
  truncatedAtMidnight: boolean
  label: string
}

export const MIDNIGHT_MINUTE = 23 * 60 + 59

export function createNowTimeQuery(
  durationMinutes = 60,
  preset: DurationPreset = 60,
): TimeQuery {
  const now = new Date()
  return {
    mode: 'now',
    date: slotToDateString(slotFromDate(now)),
    startMinute: now.getHours() * 60 + now.getMinutes(),
    requestedDurationMinutes: durationMinutes,
    durationPreset: preset,
  }
}

export function resolveTimeQuery(
  query: TimeQuery,
  now: Date = new Date(),
): ResolvedTimeQuery {
  const slot =
    query.mode === 'now'
      ? slotFromDate(now)
      : slotFromDateString(query.date, query.startMinute)

  const requested = Math.max(0, query.requestedDurationMinutes)
  if (requested <= 0) {
    return {
      slot,
      effectiveEndMinute: null,
      requestedDurationMinutes: requested,
      truncatedAtMidnight: false,
      label: formatSlotLabel(slot, null),
    }
  }

  const rawEnd = slot.minuteOfDay + requested
  const truncatedAtMidnight = rawEnd > MIDNIGHT_MINUTE
  const effectiveEnd = truncatedAtMidnight
    ? MIDNIGHT_MINUTE
    : rawEnd

  // Point check when start equals end after clamp (e.g. start at 23:59).
  const effectiveEndMinute =
    effectiveEnd > slot.minuteOfDay ? effectiveEnd : null

  return {
    slot,
    effectiveEndMinute,
    requestedDurationMinutes: requested,
    truncatedAtMidnight,
    label: formatSlotLabel(slot, effectiveEndMinute),
  }
}

export function formatDurationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const hours = minutes / 60
  if (Number.isInteger(hours)) return hours === 1 ? '1h' : `${hours}h`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function formatTimeQueryChip(query: TimeQuery, resolved: ResolvedTimeQuery): string {
  const startH = Math.floor(resolved.slot.minuteOfDay / 60)
  const startM = resolved.slot.minuteOfDay % 60
  const start = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`
  const dur = formatDurationLabel(query.requestedDurationMinutes)
  if (query.mode === 'now') return `Now · ${dur}`
  return `${start} · ${dur}`
}

export const MIDNIGHT_WARNING =
  'Checked through midnight only; later rules were not evaluated.'
