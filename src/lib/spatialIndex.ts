import type { ParkingFeature, ParkingFeatureCollection } from '../types/parking'
import { forEachPosition, isLineGeometry } from './geometry'
import { evaluateInRange, type Slot } from './schedule'
import { ruleFeatureKey } from './labels'

export type BBox = {
  minLng: number
  minLat: number
  maxLng: number
  maxLat: number
}

export type IndexedFeature = {
  feature: ParkingFeature
  featureKey: string
  minLng: number
  minLat: number
  maxLng: number
  maxLat: number
  /** Coarse cell keys covering the feature bbox. */
  cells: string[]
}

const DEFAULT_CELL_DEG = 0.01 // ~1.1 km

function featureBBox(feature: ParkingFeature): BBox | null {
  if (!isLineGeometry(feature.geometry)) return null
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity
  forEachPosition(feature.geometry, (lng, lat) => {
    if (lng < minLng) minLng = lng
    if (lat < minLat) minLat = lat
    if (lng > maxLng) maxLng = lng
    if (lat > maxLat) maxLat = lat
  })
  if (!Number.isFinite(minLng)) return null
  return { minLng, minLat, maxLng, maxLat }
}

function cellKey(ix: number, iy: number): string {
  return `${ix}:${iy}`
}

function cellsForBBox(bbox: BBox, cellDeg: number): string[] {
  const minX = Math.floor(bbox.minLng / cellDeg)
  const maxX = Math.floor(bbox.maxLng / cellDeg)
  const minY = Math.floor(bbox.minLat / cellDeg)
  const maxY = Math.floor(bbox.maxLat / cellDeg)
  const cells: string[] = []
  for (let ix = minX; ix <= maxX; ix++) {
    for (let iy = minY; iy <= maxY; iy++) {
      cells.push(cellKey(ix, iy))
    }
  }
  return cells
}

export class ParkingSpatialIndex {
  readonly features: IndexedFeature[]
  private readonly cellDeg: number
  private readonly cells = new Map<string, number[]>()

  constructor(
    collection: ParkingFeatureCollection,
    cellDeg = DEFAULT_CELL_DEG,
  ) {
    this.cellDeg = cellDeg
    this.features = []
    for (const feature of collection.features) {
      const bbox = featureBBox(feature)
      if (!bbox) continue
      const index = this.features.length
      const cells = cellsForBBox(bbox, cellDeg)
      for (const c of cells) {
        const list = this.cells.get(c)
        if (list) list.push(index)
        else this.cells.set(c, [index])
      }
      this.features.push({
        feature,
        featureKey: ruleFeatureKey(feature.properties),
        ...bbox,
        cells,
      })
    }
  }

  queryBBox(bbox: BBox, padDeg = 0): ParkingFeature[] {
    const padded: BBox = {
      minLng: bbox.minLng - padDeg,
      minLat: bbox.minLat - padDeg,
      maxLng: bbox.maxLng + padDeg,
      maxLat: bbox.maxLat + padDeg,
    }
    const cellSet = cellsForBBox(padded, this.cellDeg)
    const seen = new Set<number>()
    const out: ParkingFeature[] = []
    for (const c of cellSet) {
      const idxs = this.cells.get(c)
      if (!idxs) continue
      for (const i of idxs) {
        if (seen.has(i)) continue
        seen.add(i)
        const item = this.features[i]
        if (
          item.maxLng < padded.minLng ||
          item.minLng > padded.maxLng ||
          item.maxLat < padded.minLat ||
          item.minLat > padded.maxLat
        ) {
          continue
        }
        out.push(item.feature)
      }
    }
    return out
  }

  /** All features — used for GPS/search candidate discovery after fly-to. */
  allFeatures(): ParkingFeature[] {
    return this.features.map((f) => f.feature)
  }
}

export function enrichFeaturesSubset(
  features: ParkingFeature[],
  slot: Slot,
  includeUnknown: boolean,
  endMinuteOfDay: number | null = null,
): ParkingFeatureCollection {
  const enriched = features
    .map((feature) => {
      const evaluation = evaluateInRange(
        feature.properties,
        slot,
        endMinuteOfDay,
        includeUnknown,
      )
      const featureKey = ruleFeatureKey(feature.properties)
      return {
        ...feature,
        properties: {
          ...feature.properties,
          _polarity: evaluation.polarity,
          _visible: evaluation.visible,
          _unparsed: evaluation.unparsed,
          _partial: evaluation.partial,
          _failed: evaluation.failed,
          _featureKey: featureKey,
          _severity: severityOrder(evaluation.polarity, evaluation.unparsed),
        },
      }
    })
    .filter((f) => f.properties._visible !== false)

  return {
    type: 'FeatureCollection',
    features: sortFeaturesBySeverity(enriched),
  }
}

/**
 * Higher MapLibre line-sort-key draws on top.
 * Allowed first (0), unclear second (1), restrictions last (2).
 */
export function severityOrder(
  polarity: string | undefined,
  unparsed?: boolean,
): number {
  if (unparsed || polarity === 'unknown') return 1
  if (polarity === 'restricted' || polarity === 'not_permitted') return 2
  return 0
}

export function sortFeaturesBySeverity(
  features: ParkingFeature[],
): ParkingFeature[] {
  return [...features].sort((a, b) => {
    const sa = severityOrder(a.properties._polarity, a.properties._unparsed)
    const sb = severityOrder(b.properties._polarity, b.properties._unparsed)
    return sa - sb
  })
}
