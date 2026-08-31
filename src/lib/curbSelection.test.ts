import { describe, expect, it } from 'vitest'
import type { ParkingFeature } from '../types/parking'
import {
  findNearestCurbCandidates,
  groupLocalCurbSides,
  selectNearestCurb,
} from './curbSelection'

function line(
  street: string,
  side: string,
  coords: [number, number][],
  rule = 'rule',
): ParkingFeature {
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: coords },
    properties: {
      Highway: street,
      Rule: rule,
      schedule_category: 'no_parking',
      Side: side,
      max: null,
    },
  }
}

describe('curbSelection', () => {
  const nearNorth = line('Queen St', 'N', [
    [-79.4, 43.65],
    [-79.401, 43.65],
  ], 'north rule')
  const nearSouth = line('Queen St', 'South', [
    [-79.4, 43.6499],
    [-79.401, 43.6499],
  ], 'south rule')
  const farSameStreet = line('Queen St', 'North', [
    [-79.42, 43.66],
    [-79.421, 43.66],
  ], 'far rule')

  it('finds nearest by geometric distance, not pixel radius', () => {
    const candidates = findNearestCurbCandidates(
      [nearNorth, nearSouth, farSameStreet],
      { lng: -79.4005, lat: 43.65005 },
      { maxDistanceMeters: 80 },
    )
    expect(candidates.length).toBeGreaterThanOrEqual(2)
    expect(candidates[0].street).toBe('Queen St')
    expect(candidates.every((c) => c.distanceMeters <= 80)).toBe(true)
  })

  it('groups local street sides without whole-street merging', () => {
    const candidates = findNearestCurbCandidates(
      [nearNorth, nearSouth, farSameStreet],
      { lng: -79.4005, lat: 43.65 },
      { maxDistanceMeters: 2000 },
    )
    const groups = groupLocalCurbSides(candidates, {
      localClusterMeters: 120,
    })
    const north = groups.find((g) => g.sideDisplay.includes('North'))
    expect(north).toBeTruthy()
    // Far segment on same street/side should not join the local cluster.
    expect(north!.features.some((f) => f.properties.Rule === 'far rule')).toBe(
      false,
    )
  })

  it('auto-selects nearest group and supports preferred key', () => {
    const result = selectNearestCurb(
      [nearNorth, nearSouth],
      { lng: -79.4005, lat: 43.6502 },
    )
    expect(result.selected).toBeTruthy()
    expect(result.groups.length).toBeGreaterThanOrEqual(1)

    const other = result.groups.find(
      (g) => g.groupKey !== result.selectedGroupKey,
    )
    if (other) {
      const preferred = selectNearestCurb(
        [nearNorth, nearSouth],
        { lng: -79.4005, lat: 43.6502 },
        { preferredGroupKey: other.groupKey },
      )
      expect(preferred.selectedGroupKey).toBe(other.groupKey)
    }
  })

  it('correctly handles MultiLineString features applying to Both sides', () => {
    const bothSidesLine: ParkingFeature = {
      type: 'Feature',
      geometry: {
        type: 'MultiLineString',
        coordinates: [
          [[-79.4, 43.6501], [-79.401, 43.6501]], // North side strip
          [[-79.4, 43.6499], [-79.401, 43.6499]], // South side strip
        ],
      },
      properties: {
        Highway: 'Dual Side St',
        Rule: 'Anytime',
        schedule_category: 'no_parking',
        Side: 'Both',
        max: null,
      },
    }

    // Tapping near the North strip
    const resNorth = selectNearestCurb([bothSidesLine], {
      lng: -79.4005,
      lat: 43.65012,
    })
    expect(resNorth.selected).toBeTruthy()
    expect(resNorth.selected!.street).toBe('Dual Side St')
    expect(resNorth.selected!.sideDisplay).toBe('Both')

    // Tapping near the South strip
    const resSouth = selectNearestCurb([bothSidesLine], {
      lng: -79.4005,
      lat: 43.64988,
    })
    expect(resSouth.selected).toBeTruthy()
    expect(resSouth.selected!.street).toBe('Dual Side St')
    expect(resSouth.selected!.sideDisplay).toBe('Both')
  })

  it('keeps co-located rules on the same curb segment while isolating adjacent corner segments', () => {
    // 70m mid-block line with 2 overlapping rules (rush-hour limit + pay & display)
    const midblockRushHour = line(
      'College St',
      'North',
      [
        [-79.4079, 43.6565],
        [-79.4087, 43.6563],
      ],
      'rush hour stopping',
    )
    const midblockMeter = line(
      'College St',
      'North',
      [
        [-79.4079, 43.6565],
        [-79.4087, 43.6563],
      ],
      'pay and display',
    )
    // 15m corner segment starting 30m away
    const cornerAnytime = line(
      'College St',
      'North',
      [
        [-79.4088, 43.6563],
        [-79.409, 43.6562],
      ],
      'anytime no stopping',
    )

    const allFeatures = [midblockRushHour, midblockMeter, cornerAnytime]

    // 1. Tapping mid-block (near -79.4083, 43.6564)
    const midblockTap = selectNearestCurb(allFeatures, {
      lng: -79.4083,
      lat: 43.65642,
    })
    expect(midblockTap.selected).toBeTruthy()
    expect(midblockTap.selected!.features.length).toBe(2)
    const midblockRules = midblockTap.selected!.features.map(
      (f) => f.properties.Rule,
    )
    expect(midblockRules).toContain('rush hour stopping')
    expect(midblockRules).toContain('pay and display')
    expect(midblockRules).not.toContain('anytime no stopping')

    // 2. Tapping corner (near -79.4089, 43.65625)
    const cornerTap = selectNearestCurb(allFeatures, {
      lng: -79.4089,
      lat: 43.65626,
    })
    expect(cornerTap.selected).toBeTruthy()
    const cornerRules = cornerTap.selected!.features.map(
      (f) => f.properties.Rule,
    )
    expect(cornerRules).toContain('anytime no stopping')
  })

  it('generates distinct feature keys for separate segments with identical rule text', () => {
    const segA = line('Queen St', 'North', [
      [-79.4, 43.65],
      [-79.401, 43.65],
    ], 'no parking')
    const segB = line('Queen St', 'North', [
      [-79.42, 43.66],
      [-79.421, 43.66],
    ], 'no parking')

    const resA = selectNearestCurb([segA, segB], { lng: -79.4005, lat: 43.65005 })
    const resB = selectNearestCurb([segA, segB], { lng: -79.4205, lat: 43.66005 })

    expect(resA.selected).toBeTruthy()
    expect(resB.selected).toBeTruthy()
    expect(resA.selected!.featureKeys).not.toEqual(resB.selected!.featureKeys)
  })
})

