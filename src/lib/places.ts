const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete'
const PLACES_BASE = 'https://places.googleapis.com/v1'

const TORONTO_BIAS = {
  circle: {
    center: { latitude: 43.65, longitude: -79.38 },
    radius: 30_000,
  },
}

export type PlaceSuggestion = {
  placeId: string
  label: string
}

export type PlaceLocation = {
  lat: number
  lng: number
  formattedAddress: string
}

export function formatShortAddress(address: string): string {
  if (!address) return ''
  const trimmed = address.trim()
  const firstComma = trimmed.indexOf(',')
  if (firstComma > 0) {
    return trimmed.slice(0, firstComma).trim()
  }
  return trimmed
}

export function createSessionToken(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'))
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10).join(''),
  ].join('-')
}

export function getPlacesApiKey(): string | undefined {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  return typeof key === 'string' && key.trim() ? key.trim() : undefined
}

export async function autocompleteSuggestions(
  input: string,
  sessionToken: string,
): Promise<PlaceSuggestion[]> {
  const apiKey = getPlacesApiKey()
  if (!apiKey || !input.trim()) return []

  const res = await fetch(AUTOCOMPLETE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
    },
    body: JSON.stringify({
      input: input.trim(),
      sessionToken,
      includedRegionCodes: ['ca'],
      locationBias: TORONTO_BIAS,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Places autocomplete failed (${res.status}): ${err}`)
  }

  const data = (await res.json()) as {
    suggestions?: Array<{
      placePrediction?: {
        placeId?: string
        text?: { text?: string }
      }
    }>
  }

  const suggestions: PlaceSuggestion[] = []
  for (const s of data.suggestions ?? []) {
    const pred = s.placePrediction
    const placeId = pred?.placeId
    const label = pred?.text?.text
    if (placeId && label) {
      suggestions.push({ placeId, label })
    }
  }
  return suggestions
}

export async function placeDetails(
  placeId: string,
  sessionToken: string,
): Promise<PlaceLocation> {
  const apiKey = getPlacesApiKey()
  if (!apiKey) throw new Error('Google Maps API key is not configured')

  const resourceName = placeId.startsWith('places/')
  ? placeId
    : `places/${placeId}`

  const url = new URL(`${PLACES_BASE}/${resourceName}`)
  url.searchParams.set('sessionToken', sessionToken)

  const res = await fetch(url.toString(), {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'location,formattedAddress,displayName',
    },
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Place details failed (${res.status}): ${err}`)
  }

  const data = (await res.json()) as {
    location?: { latitude?: number; longitude?: number }
    formattedAddress?: string
    displayName?: { text?: string }
  }

  const lat = data.location?.latitude
  const lng = data.location?.longitude
  if (lat == null || lng == null) {
    throw new Error('Place has no coordinates')
  }

  const formattedAddress =
    data.formattedAddress ??
    data.displayName?.text ??
    'Selected location'

  return { lat, lng, formattedAddress }
}
