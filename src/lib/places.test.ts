import { describe, expect, it } from 'vitest'
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
