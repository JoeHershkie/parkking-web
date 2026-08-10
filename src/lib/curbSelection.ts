import type { ParkingFeature } from '../types/parking'
import { geometryMidpoint, isLineGeometry, lineParts } from './geometry'
import { ruleFeatureKey } from './labels'
import {
  curbGroupKey,
  formatSideLabel,
  normalizeSide,
  normalizeStreet,
} from './sideNormalize'

export type LngLat = { lng: number; lat: number }

export type CurbCandidate = {
  feature: ParkingFeature
  /** Stable source-derived key (survives time/viewport updates). */
  featureKey: string
  distanceMeters: number
  street: string
  side: string
  sideDisplay: string
  groupKey: string
}

export type CurbSideGroup = {
  groupKey: string
  street: string
  side: string
  sideDisplay: string
  features: ParkingFeature[]
  featureKeys: string[]
  /** Distance of nearest feature in the group to the query point. */
  nearestDistanceMeters: number
}

const EARTH_RADIUS_M = 6_371_000

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export function haversineMeters(a: LngLat, b: LngLat): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Approximate meters-per-degree at a latitude (for local flat projection). */
function metersPerDegree(lat: number): { mx: number; my: number } {
  const my = (Math.PI / 180) * EARTH_RADIUS_M
  const mx = my * Math.cos(toRad(lat))
  return { mx: Math.max(mx, 1e-6), my }
}

function project(
  lng: number,
  lat: number,
  originLat: number,
): { x: number; y: number } {
  const { mx, my } = metersPerDegree(originLat)
  return { x: lng * mx, y: lat * my }
}

function distancePointToSegmentMeters(
  point: LngLat,
  a: [number, number],
  b: [number, number],
): number {
  const originLat = point.lat
  const p = project(point.lng, point.lat, originLat)
  const pa = project(a[0], a[1], originLat)
  const pb = project(b[0], b[1], originLat)
  const dx = pb.x - pa.x
  const dy = pb.y - pa.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) {
    return Math.hypot(p.x - pa.x, p.y - pa.y)
  }
  let t = ((p.x - pa.x) * dx + (p.y - pa.y) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const cx = pa.x + t * dx
  const cy = pa.y + t * dy
  return Math.hypot(p.x - cx, p.y - cy)
}

export function distancePointToLineStringMeters(
  point: LngLat,
  coordinates: [number, number][],
): number {
  if (coordinates.length === 0) return Infinity
  if (coordinates.length === 1) {
    return haversineMeters(point, {
      lng: coordinates[0][0],
      lat: coordinates[0][1],
    })
  }
  let min = Infinity
  for (let i = 0; i < coordinates.length - 1; i++) {
    const d = distancePointToSegmentMeters(
      point,
      coordinates[i],
      coordinates[i + 1],
    )
    if (d < min) min = d
  }
  return min
}

export function distancePointToFeatureMeters(
  point: LngLat,
  feature: ParkingFeature,
): number {
  if (!isLineGeometry(feature.geometry)) return Infinity
  let min = Infinity
  for (const part of lineParts(feature.geometry)) {
    const d = distancePointToLineStringMeters(
      point,
      part as [number, number][],
    )
    if (d < min) min = d
  }
  return min
}

export function stableFeatureKey(feature: ParkingFeature): string {
  return ruleFeatureKey(feature.properties)
}

/**
 * Find nearest curb line candidates within maxDistanceMeters of a point.
 * Uses geometric distance to line segments (not screen pixels).
 */
export function findNearestCurbCandidates(
  features: ParkingFeature[],
  point: LngLat,
  options: {
    maxDistanceMeters?: number
    maxCandidates?: number
  } = {},
): CurbCandidate[] {
  const maxDistanceMeters = options.maxDistanceMeters ?? 80
  const maxCandidates = options.maxCandidates ?? 40

  const scored: CurbCandidate[] = []
  for (const feature of features) {
    const distanceMeters = distancePointToFeatureMeters(point, feature)
    if (distanceMeters > maxDistanceMeters) continue
    const street = normalizeStreet(feature.properties.Highway)
    const side = feature.properties.Side
    const sideNorm = normalizeSide(side)
    scored.push({
      feature,
      featureKey: stableFeatureKey(feature),
      distanceMeters,
      street,
      side,
      sideDisplay: formatSideLabel(side),
      groupKey: curbGroupKey(street, sideNorm),
    })
  }

  scored.sort((a, b) => a.distanceMeters - b.distanceMeters)
  return scored.slice(0, maxCandidates)
}

/**
 * Group candidates that share normalized street+side AND are geometrically local
 * to the nearest feature of that group (not whole-street global grouping).
 */
export function groupLocalCurbSides(
  candidates: CurbCandidate[],
  options: {
    /** Max distance between a candidate and the group's nearest feature. */
    localClusterMeters?: number
  } = {},
): CurbSideGroup[] {
  const localClusterMeters = options.localClusterMeters ?? 120
  if (candidates.length === 0) return []

  const byGroup = new Map<string, CurbCandidate[]>()
  for (const c of candidates) {
    const list = byGroup.get(c.groupKey)
    if (list) list.push(c)
    else byGroup.set(c.groupKey, [c])
  }

  const groups: CurbSideGroup[] = []
  for (const [, members] of byGroup) {
    members.sort((a, b) => a.distanceMeters - b.distanceMeters)
    const nearest = members[0]
    const clustered = members.filter((m) =>
      featureLocalTo(m.feature, nearest.feature, localClusterMeters),
    )
    const use = clustered.length > 0 ? clustered : [nearest]

    const seen = new Set<string>()
    const deduped: ParkingFeature[] = []
    const keys: string[] = []
    for (const m of use) {
      const key = m.featureKey
      if (seen.has(key)) continue
      seen.add(key)
      deduped.push(m.feature)
      keys.push(key)
    }

    groups.push({
      groupKey: nearest.groupKey,
      street: nearest.street,
      side: nearest.side,
      sideDisplay: nearest.sideDisplay,
      features: deduped,
      featureKeys: keys,
      nearestDistanceMeters: nearest.distanceMeters,
    })
  }

  groups.sort((a, b) => a.nearestDistanceMeters - b.nearestDistanceMeters)
  return groups
}

function featureLocalTo(
  a: ParkingFeature,
  b: ParkingFeature,
  maxMeters: number,
): boolean {
  const midA = midpoint(a)
  const midB = midpoint(b)
  if (!midA || !midB) return false
  return haversineMeters(midA, midB) <= maxMeters
}

function midpoint(feature: ParkingFeature): LngLat | null {
  if (!isLineGeometry(feature.geometry)) return null
  return geometryMidpoint(feature.geometry)
}

export type SelectionResult = {
  groups: CurbSideGroup[]
  selectedGroupKey: string | null
  selected: CurbSideGroup | null
}

/**
 * Full nearest-curb flow: candidates → local street-side groups → auto-select nearest.
 */
export function selectNearestCurb(
  features: ParkingFeature[],
  point: LngLat,
  options?: {
    maxDistanceMeters?: number
    localClusterMeters?: number
    preferredGroupKey?: string | null
  },
): SelectionResult {
  const candidates = findNearestCurbCandidates(features, point, {
    maxDistanceMeters: options?.maxDistanceMeters,
  })
  const groups = groupLocalCurbSides(candidates, {
    localClusterMeters: options?.localClusterMeters,
  })

  if (groups.length === 0) {
    return { groups: [], selectedGroupKey: null, selected: null }
  }

  const preferred = options?.preferredGroupKey
  const selected =
    (preferred && groups.find((g) => g.groupKey === preferred)) || groups[0]

  return {
    groups,
    selectedGroupKey: selected.groupKey,
    selected,
  }
}
