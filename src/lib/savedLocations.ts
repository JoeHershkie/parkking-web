export type SavedLocation = {
  id: string
  label: string
  lat: number
  lng: number
  savedAt: number
}

const RECENTS_KEY = 'parking-web:recents'
const FAVORITES_KEY = 'parking-web:favorites'
const GPS_INTENT_KEY = 'parking-web:gps-intent'
const MAX_RECENTS = 8

function readList(key: string): SavedLocation[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isSavedLocation)
  } catch {
    return []
  }
}

function writeList(key: string, list: SavedLocation[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list))
  } catch {
    // Ignore quota / private mode failures.
  }
}

function isSavedLocation(value: unknown): value is SavedLocation {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.label === 'string' &&
    typeof v.lat === 'number' &&
    typeof v.lng === 'number' &&
    typeof v.savedAt === 'number'
  )
}

function makeId(lat: number, lng: number, label: string): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}|${label}`
}

export function loadRecents(): SavedLocation[] {
  return readList(RECENTS_KEY)
}

export function loadFavorites(): SavedLocation[] {
  return readList(FAVORITES_KEY)
}

/** Persist a recent as coords + label only — never verdicts. */
export function addRecent(input: {
  label: string
  lat: number
  lng: number
}): SavedLocation[] {
  const entry: SavedLocation = {
    id: makeId(input.lat, input.lng, input.label),
    label: input.label,
    lat: input.lat,
    lng: input.lng,
    savedAt: Date.now(),
  }
  const next = [
    entry,
    ...loadRecents().filter((r) => r.id !== entry.id),
  ].slice(0, MAX_RECENTS)
  writeList(RECENTS_KEY, next)
  return next
}

export function clearRecents(): SavedLocation[] {
  writeList(RECENTS_KEY, [])
  return []
}

export function removeRecent(id: string): SavedLocation[] {
  const next = loadRecents().filter((r) => r.id !== id)
  writeList(RECENTS_KEY, next)
  return next
}

export function addFavorite(input: {
  label: string
  lat: number
  lng: number
}): SavedLocation[] {
  const entry: SavedLocation = {
    id: makeId(input.lat, input.lng, input.label),
    label: input.label,
    lat: input.lat,
    lng: input.lng,
    savedAt: Date.now(),
  }
  const next = [
    entry,
    ...loadFavorites().filter((f) => f.id !== entry.id),
  ]
  writeList(FAVORITES_KEY, next)
  return next
}

export function removeFavorite(id: string): SavedLocation[] {
  const next = loadFavorites().filter((f) => f.id !== id)
  writeList(FAVORITES_KEY, next)
  return next
}

export function isFavorite(id: string): boolean {
  return loadFavorites().some((f) => f.id === id)
}

export function markGpsIntent(): void {
  try {
    localStorage.setItem(GPS_INTENT_KEY, '1')
  } catch {
    // ignore
  }
}

export function hasGpsIntent(): boolean {
  try {
    return localStorage.getItem(GPS_INTENT_KEY) === '1'
  } catch {
    return false
  }
}
