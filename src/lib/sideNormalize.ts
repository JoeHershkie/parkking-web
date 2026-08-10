/**
 * Normalize inconsistent Side spellings from the dataset for grouping/display.
 * Preserves the original value separately for details.
 */
const SIDE_ALIASES: Record<string, string> = {
  n: 'North',
  north: 'North',
  northbound: 'North',
  'n/b': 'North',
  nb: 'North',
  s: 'South',
  south: 'South',
  southbound: 'South',
  's/b': 'South',
  sb: 'South',
  e: 'East',
  east: 'East',
  eastbound: 'East',
  'e/b': 'East',
  eb: 'East',
  w: 'West',
  west: 'West',
  westbound: 'West',
  'w/b': 'West',
  wb: 'West',
  both: 'Both',
  'both sides': 'Both',
  either: 'Either',
  'either side': 'Either',
}

export function normalizeSide(side: string | null | undefined): string {
  if (side == null || side.trim() === '') return 'Unknown'
  const key = side.trim().toLowerCase()
  return SIDE_ALIASES[key] ?? titleCaseSide(side.trim())
}

function titleCaseSide(value: string): string {
  return value
    .split(/\s+/)
    .map((part) =>
      part.length === 0
        ? part
        : part[0].toUpperCase() + part.slice(1).toLowerCase(),
    )
    .join(' ')
}

export function normalizeStreet(street: string | null | undefined): string {
  if (street == null || street.trim() === '') return 'Unknown street'
  return street.trim().replace(/\s+/g, ' ')
}

export function curbGroupKey(street: string, side: string): string {
  return `${normalizeStreet(street).toLowerCase()}|${normalizeSide(side).toLowerCase()}`
}

export function formatSideLabel(side: string): string {
  const normalized = normalizeSide(side)
  if (normalized === 'Both' || normalized === 'Either') return normalized
  if (normalized === 'Unknown') return 'Unknown side'
  return `${normalized} side`
}

const CARDINAL_LETTER: Record<string, string> = {
  North: 'N',
  South: 'S',
  East: 'E',
  West: 'W',
}

const SIDE_LETTER_ORDER = ['N', 'S', 'E', 'W'] as const

/**
 * Compact curb-side chip label: N/S/E/W, or combined letters for compound sides.
 */
export function sideAbbrev(side: string): string {
  const normalized = normalizeSide(side)
  if (normalized === 'Both' || normalized === 'Either') return 'B'
  if (normalized === 'Unknown') return '?'

  const direct = CARDINAL_LETTER[normalized]
  if (direct) return direct

  const found: string[] = []
  for (const [name, letter] of Object.entries(CARDINAL_LETTER)) {
    if (new RegExp(`\\b${name}\\b`, 'i').test(normalized)) {
      found.push(letter)
    }
  }
  if (found.length === 0) return normalized.slice(0, 1).toUpperCase()

  return (
    SIDE_LETTER_ORDER.filter((l) => found.includes(l)).join('') ||
    found.join('')
  )
}

export function compareSideAbbrevs(a: string, b: string): number {
  const ai = SIDE_LETTER_ORDER.indexOf(a as (typeof SIDE_LETTER_ORDER)[number])
  const bi = SIDE_LETTER_ORDER.indexOf(b as (typeof SIDE_LETTER_ORDER)[number])
  const ao = ai === -1 ? 99 : ai
  const bo = bi === -1 ? 99 : bi
  if (ao !== bo) return ao - bo
  return a.localeCompare(b)
}
