import { describe, expect, it } from 'vitest'
import {
  enrichFeaturesSubset,
  ParkingSpatialIndex,
  severityOrder,
  sortFeaturesBySeverity,
} from './spatialIndex'
import type { ParkingFeatureCollection } from '../types/parking'
import type { Slot } from './schedule/types'

const collection: ParkingFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-79.4, 43.65],
          [-79.401, 43.651],
        ],
      },
      properties: {
        Highway: 'A',
        Rule: 'Anytime',
        schedule_category: 'no_parking',
        Side: 'North',
        max: null,
        schedule: { v: 1, status: 'anytime', source: 'Anytime', windows: [] },
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-79.5, 43.7],
          [-79.501, 43.701],
        ],
      },
      properties: {
        Highway: 'B',
        Rule: 'Anytime',
        schedule_category: 'no_parking',
        Side: 'South',
        max: null,
        schedule: { v: 1, status: 'anytime', source: 'Anytime', windows: [] },
      },
    },
  ],
}

const slot: Slot = {
  dayOfWeek: 2,
  minuteOfDay: 900,
  month: 5,
  dayOfMonth: 20,
  year: 2025,
}

describe('ParkingSpatialIndex', () => {
  it('queries only features intersecting a bbox', () => {
    const index = new ParkingSpatialIndex(collection)
    const near = index.queryBBox({
      minLng: -79.41,
      minLat: 43.64,
      maxLng: -79.39,
      maxLat: 43.66,
    })
    expect(near).toHaveLength(1)
    expect(near[0]?.properties.Highway).toBe('A')
  })

  it('returns all features for selection', () => {
    const index = new ParkingSpatialIndex(collection)
    expect(index.allFeatures()).toHaveLength(2)
  })
})

describe('enrichFeaturesSubset', () => {
  it('adds polarity, feature key, and severity', () => {
    const enriched = enrichFeaturesSubset(collection.features, slot, true, null)
    expect(enriched.features[0]?.properties._featureKey).toBeTruthy()
    expect(enriched.features[0]?.properties._polarity).toBe('restricted')
    expect(enriched.features[0]?.properties._severity).toBe(2)
  })
})

describe('severityOrder', () => {
  it('orders allowed, unclear, then restricted', () => {
    expect(severityOrder('inactive')).toBe(0)
    expect(severityOrder('unknown', true)).toBe(1)
    expect(severityOrder('restricted')).toBe(2)
    const sorted = sortFeaturesBySeverity([
      {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
        properties: {
          Highway: 'r',
          Rule: 'r',
          schedule_category: 'no_parking',
          Side: 'N',
          max: null,
          _polarity: 'restricted',
        },
      },
      {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
        properties: {
          Highway: 'a',
          Rule: 'a',
          schedule_category: 'no_parking',
          Side: 'N',
          max: null,
          _polarity: 'inactive',
        },
      },
    ])
    expect(sorted[0]?.properties.Highway).toBe('a')
    expect(sorted[1]?.properties.Highway).toBe('r')
  })
})
