import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import type { ParkingFeatureCollection } from '../types/parking'

describe('Parking data contract', () => {
  const geojsonPath = path.resolve(__dirname, '../../public/data/final_parking_map.geojson')
  const fileExists = fs.existsSync(geojsonPath)

  it('validates GeoJSON file exists in public/data', () => {
    expect(fileExists).toBe(true)
  })

  it('validates GeoJSON structure and geometry contract', () => {
    if (!fileExists) return
    const raw = fs.readFileSync(geojsonPath, 'utf-8')
    const data = JSON.parse(raw) as ParkingFeatureCollection

    expect(data.type).toBe('FeatureCollection')
    expect(Array.isArray(data.features)).toBe(true)
    expect(data.features.length).toBeGreaterThan(1000)

    const sample = data.features.slice(0, 500)
    for (const f of sample) {
      expect(['LineString', 'MultiLineString']).toContain(f.geometry.type)
      expect(typeof f.properties.Highway).toBe('string')
      expect(typeof f.properties.Side).toBe('string')
      expect(typeof f.properties.Rule).toBe('string')

      if (f.properties.schedule) {
        expect(f.properties.schedule.v).toBe(1)
        expect(['ok', 'anytime', 'partial', 'failed']).toContain(f.properties.schedule.status)
        if (f.properties.schedule.windows) {
          for (const w of f.properties.schedule.windows) {
            expect(Array.isArray(w.days)).toBe(true)
            expect(w.startMinute).toBeGreaterThanOrEqual(0)
            expect(w.endMinute).toBeGreaterThanOrEqual(0)
          }
        }
      }

      // Check coordinates within GTA bounds
      const coords =
        f.geometry.type === 'LineString'
          ? (f.geometry.coordinates as [number, number][])
          : (f.geometry.coordinates as [number, number][][]).flat()

      for (const [lng, lat] of coords) {
        expect(lng).toBeGreaterThanOrEqual(-80.2)
        expect(lng).toBeLessThanOrEqual(-78.8)
        expect(lat).toBeGreaterThanOrEqual(43.4)
        expect(lat).toBeLessThanOrEqual(44.2)
      }
    }
  })

  it('validates streets with rules on opposite sides have distinct parallel geometries', () => {
    if (!fileExists) return
    const raw = fs.readFileSync(geojsonPath, 'utf-8')
    const data = JSON.parse(raw) as ParkingFeatureCollection

    // Find Aberdeen Avenue features for North and South
    const aberdeenNorth = data.features.find(
      (f) => f.properties.Highway === 'Aberdeen Avenue' && f.properties.Side === 'North',
    )
    const aberdeenSouth = data.features.find(
      (f) => f.properties.Highway === 'Aberdeen Avenue' && f.properties.Side === 'South',
    )

    expect(aberdeenNorth).toBeDefined()
    expect(aberdeenSouth).toBeDefined()
    expect(aberdeenNorth!.geometry.coordinates).not.toEqual(aberdeenSouth!.geometry.coordinates)

    // Check that curb_geometry_method or median_offset_m is present on features
    expect(aberdeenNorth!.properties.curb_geometry_method).toBeDefined()
  })

  it('validates bylaws that apply to Both sides contain multi-part geometries for both curb strips', () => {
    if (!fileExists) return
    const raw = fs.readFileSync(geojsonPath, 'utf-8')
    const data = JSON.parse(raw) as ParkingFeatureCollection

    // Find features with Side: Both or side_mode: multi
    const bothSideFeatures = data.features.filter(
      (f) => f.properties.Side === 'Both' || f.properties.side_mode === 'multi',
    )

    expect(bothSideFeatures.length).toBeGreaterThan(0)

    // Verify that multi-part curb features exist with MultiLineString containing at least 2 distinct line parts
    const multiLineFeatures = bothSideFeatures.filter(
      (f) => f.geometry.type === 'MultiLineString' && f.geometry.coordinates.length >= 2,
    )

    expect(multiLineFeatures.length).toBeGreaterThan(1000)

    // For a sample MultiLineString feature, verify parts have different coordinates (one per side)
    const sample = multiLineFeatures[0]
    const part0 = sample.geometry.coordinates[0]
    const part1 = sample.geometry.coordinates[1]
    expect(part0).not.toEqual(part1)
  })

  it('validates curb segments along the continuous side of T-intersections remain unbroken', () => {
    if (!fileExists) return
    const raw = fs.readFileSync(geojsonPath, 'utf-8')
    const data = JSON.parse(raw) as ParkingFeatureCollection & {
      metadata?: { t_intersections_healed?: number }
    }

    expect(data.metadata?.t_intersections_healed).toBeGreaterThan(500)

    // Verify Abitibi Avenue or Delma Drive has continuous LineString features
    const continuousFeatures = data.features.filter(
      (f) =>
        f.geometry.type === 'LineString' &&
        ['Abitibi Avenue', 'Delma Drive', 'Manning Avenue'].includes(
          f.properties.Highway,
        ),
    )
    expect(continuousFeatures.length).toBeGreaterThan(0)
  })
})
