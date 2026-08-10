import { beforeEach, describe, expect, it } from 'vitest'
import {
  addFavorite,
  addRecent,
  clearRecents,
  hasGpsIntent,
  isFavorite,
  loadFavorites,
  loadRecents,
  markGpsIntent,
  removeFavorite,
  removeRecent,
} from './savedLocations'

function mockStorage() {
  const store = new Map<string, string>()
  const localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v)
    },
    removeItem: (k: string) => {
      store.delete(k)
    },
    clear: () => store.clear(),
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorage,
    configurable: true,
  })
}

beforeEach(() => {
  mockStorage()
})

describe('savedLocations', () => {
  it('stores recents without verdicts and caps length', () => {
    clearRecents()
    for (let i = 0; i < 12; i++) {
      addRecent({ label: `Place ${i}`, lat: 43.65 + i * 0.001, lng: -79.38 })
    }
    const recents = loadRecents()
    expect(recents.length).toBeLessThanOrEqual(8)
    expect(recents[0]?.label).toBe('Place 11')
    expect(Object.keys(recents[0]!)).not.toContain('verdict')
  })

  it('supports favorites and removals', () => {
    const list = addFavorite({
      label: 'Home',
      lat: 43.65,
      lng: -79.4,
    })
    expect(list.some((f) => f.label === 'Home')).toBe(true)
    const id = list[0]!.id
    expect(isFavorite(id)).toBe(true)
    removeFavorite(id)
    expect(loadFavorites().some((f) => f.id === id)).toBe(false)
  })

  it('removes and clears recents', () => {
    clearRecents()
    const [a] = addRecent({ label: 'A', lat: 1, lng: 2 })
    addRecent({ label: 'B', lat: 3, lng: 4 })
    removeRecent(a!.id)
    expect(loadRecents().some((r) => r.id === a!.id)).toBe(false)
    clearRecents()
    expect(loadRecents()).toEqual([])
  })

  it('persists gps intent flag', () => {
    markGpsIntent()
    expect(hasGpsIntent()).toBe(true)
  })
})
