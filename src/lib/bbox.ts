import type { ParkingFeature } from '../types/parking'
import { forEachPosition, isLineGeometry } from './geometry'

export type LngLatBounds = [[number, number], [number, number]]

export function boundsFromFeatures(
  features: ParkingFeature[],
): LngLatBounds | null {
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity

  for (const feature of features) {
    if (!isLineGeometry(feature.geometry)) continue
    forEachPosition(feature.geometry, (lng, lat) => {
      if (lng < minLng) minLng = lng
      if (lat < minLat) minLat = lat
      if (lng > maxLng) maxLng = lng
      if (lat > maxLat) maxLat = lat
    })
  }

  if (!Number.isFinite(minLng)) return null
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ]
}
