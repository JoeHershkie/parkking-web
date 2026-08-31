import { describe, expect, it, vi } from 'vitest'
import { formatShortAddress } from './places'

describe('formatShortAddress', () => {
  it('extracts the street portion before commas', () => {
    expect(
      formatShortAddress('432 Lytton Blvd, North York, ON M5N 1S4, Canada'),
    ).toBe('432 Lytton Blvd')
    expect(formatShortAddress('1300 Bloor St W, Toronto, ON')).toBe(
      '1300 Bloor St W',
    )
    expect(formatShortAddress('Sugo, 1281 Bloor St W, Toronto, ON')).toBe('Sugo')
  })

  it('handles strings without commas', () => {
    expect(formatShortAddress('432 Lytton Blvd')).toBe('432 Lytton Blvd')
    expect(formatShortAddress('Current location')).toBe('Current location')
  })

  it('handles empty input', () => {
    expect(formatShortAddress('')).toBe('')
  })
})

describe('reverseGeocode', () => {
  const originalFetch = globalThis.fetch

  it('formats address from Nominatim response with house_number and road', async () => {
    const { reverseGeocode } = await import('./places')
    globalThis.fetch = (async (url: RequestInfo | URL) => {
      const urlStr = url.toString()
      if (urlStr.includes('nominatim.openstreetmap.org')) {
        return {
          ok: true,
          json: async () => ({
            place_id: 123,
            address: {
              house_number: '334',
              road: 'Queen Street West',
              city: 'Toronto',
            },
          }),
        } as Response
      }
      return { ok: false } as Response
    }) as typeof fetch

    const address = await reverseGeocode(43.6495, -79.395)
    expect(address).toBe('334 Queen Street West')
    globalThis.fetch = originalFetch
  })

  it('returns road name when house_number is missing', async () => {
    const { reverseGeocode } = await import('./places')
    globalThis.fetch = (async (url: RequestInfo | URL) => {
      const urlStr = url.toString()
      if (urlStr.includes('nominatim.openstreetmap.org')) {
        return {
          ok: true,
          json: async () => ({
            place_id: 123,
            address: {
              road: 'Spadina Avenue',
              city: 'Toronto',
            },
          }),
        } as Response
      }
      return { ok: false } as Response
    }) as typeof fetch

    const address = await reverseGeocode(43.65, -79.39)
    expect(address).toBe('Spadina Avenue')
    globalThis.fetch = originalFetch
  })

  it('falls back to Google Geocoding API when Nominatim fails', async () => {
    const { reverseGeocode } = await import('./places')
    globalThis.fetch = (async (url: RequestInfo | URL) => {
      const urlStr = url.toString()
      if (urlStr.includes('nominatim.openstreetmap.org')) {
        throw new Error('Nominatim down')
      }
      if (urlStr.includes('maps.googleapis.com')) {
        return {
          ok: true,
          json: async () => ({
            status: 'OK',
            results: [
              {
                formatted_address: '100 King St W, Toronto, ON M5X 1A9, Canada',
                types: ['street_address'],
              },
            ],
          }),
        } as Response
      }
      return { ok: false } as Response
    }) as typeof fetch

    // Simulate key present
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key')

    const address = await reverseGeocode(43.648, -79.381)
    expect(address).toBe('100 King St W')

    vi.unstubAllEnvs()
    globalThis.fetch = originalFetch
  })


  it('returns null when reverse geocoding fails completely', async () => {
    const { reverseGeocode } = await import('./places')
    globalThis.fetch = (async () => {
      throw new Error('Network error')
    }) as typeof fetch

    const address = await reverseGeocode(0, 0)
    expect(address).toBeNull()
    globalThis.fetch = originalFetch
  })
})


