import { describe, expect, it } from 'vitest'
import { formatSideLabel, normalizeSide, sideAbbrev } from './sideNormalize'

describe('sideNormalize', () => {
  it('normalizes common aliases', () => {
    expect(normalizeSide('N')).toBe('North')
    expect(normalizeSide('southbound')).toBe('South')
    expect(normalizeSide('E/B')).toBe('East')
  })

  it('formats display labels', () => {
    expect(formatSideLabel('West')).toBe('West side')
    expect(formatSideLabel('Both')).toBe('Both')
  })

  it('abbreviates sides for curb chips', () => {
    expect(sideAbbrev('North')).toBe('N')
    expect(sideAbbrev('southbound')).toBe('S')
    expect(sideAbbrev('North And West')).toBe('NW')
    expect(sideAbbrev('West, South And East')).toBe('SEW')
  })
})
