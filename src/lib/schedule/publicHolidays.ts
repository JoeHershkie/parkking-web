import Holidays from 'date-holidays'
import type { Slot } from './types'

const cache = new Map<number, Holidays>()

function holidaysForYear(year: number): Holidays {
  let hd = cache.get(year)
  if (!hd) {
    hd = new Holidays('CA', 'ON')
    cache.set(year, hd)
  }
  return hd
}

/** Ontario statutory public holidays (observed when applicable). */
export function isPublicHoliday(slot: Slot): boolean {
  if (slot.year == null || slot.dayOfMonth == null) return false
  // Sample midday (16:00 UTC = 12:00 EDT / 11:00 EST in Toronto) so timezone offsets
  // don't shift the date to the previous day on UTC runners/servers.
  const dateUtc = new Date(
    Date.UTC(slot.year, slot.month - 1, slot.dayOfMonth, 16, 0, 0),
  )
  const result = holidaysForYear(slot.year).isHoliday(dateUtc)
  if (!result) return false
  const list = Array.isArray(result) ? result : [result]
  return list.some((h) => h.type === 'public')
}
