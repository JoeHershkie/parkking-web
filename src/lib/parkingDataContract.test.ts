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
})
