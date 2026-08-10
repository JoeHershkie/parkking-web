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
})
