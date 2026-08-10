import type { Geometry } from 'geojson'
import type { Position } from 'geojson'
import type { ParkingFeature, ParkingGeometry } from '../types/parking'

/** Line parts for LineString / MultiLineString (skips unsupported geometries). */
export function lineParts(geometry: ParkingGeometry): Position[][] {
  if (geometry.type === 'LineString') return [geometry.coordinates]
  if (geometry.type === 'MultiLineString') return geometry.coordinates
  return []
}

export function isLineGeometry(geometry: Geometry): geometry is ParkingGeometry {
  return (
    geometry.type === 'LineString' || geometry.type === 'MultiLineString'
  )
}

export function forEachPosition(
  geometry: ParkingGeometry,
  visit: (lng: number, lat: number) => void,
): void {
  for (const part of lineParts(geometry)) {
    for (const pos of part) {
      const lng = pos[0]
      const lat = pos[1]
      if (typeof lng === 'number' && typeof lat === 'number') {
        visit(lng, lat)
      }
    }
  }
}

export function geometryMidpoint(
  geometry: ParkingGeometry,
): { lng: number; lat: number } | null {
  const parts = lineParts(geometry)
  const primary = parts[0]
  if (!primary?.length) return null
  const mid = primary[Math.floor(primary.length / 2)]
  return { lng: mid[0], lat: mid[1] }
}

/** Narrow raw GeoJSON features to line geometries used by the map. */
export function filterLineFeatures(
  features: ParkingFeature[],
): ParkingFeature[] {
  return features.filter((f) => isLineGeometry(f.geometry))
}
