import type { ParkingFeatureCollection } from '../types/parking'

const DATA_CACHE_NAME = 'parkking-data-v1'

/**
 * Loads GeoJSON using CacheStorage for instant offline/repeat startup.
 * If cached, returns the cached dataset immediately; otherwise fetches over network
 * and caches the response for subsequent offline visits.
 */
export async function loadCachedGeoJSON(
  url: string,
  onProgress?: (msg: string) => void,
): Promise<ParkingFeatureCollection> {
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(DATA_CACHE_NAME)
      const cachedResponse = await cache.match(url)

      if (cachedResponse) {
        onProgress?.('Loading cached curb rules…')
        const data = (await cachedResponse.json()) as ParkingFeatureCollection

        // Silently update cache in the background if online
        void fetch(url)
          .then(async (fresh) => {
            if (fresh.ok) {
              await cache.put(url, fresh)
            }
          })
          .catch(() => {
            // Ignore background fetch failure when offline
          })

        return data
      }
    } catch {
      // If CacheStorage fails (e.g. private browsing quota), fallback to fetch
    }
  }

  onProgress?.('Fetching curb rules…')
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }

  // Clone response before consuming so we can cache it
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(DATA_CACHE_NAME)
      await cache.put(url, res.clone())
    } catch {
      // Ignore cache put failure
    }
  }

  return (await res.json()) as ParkingFeatureCollection
}
