import { useCallback, useEffect, useRef, useState } from 'react'
import { hasGpsIntent, markGpsIntent } from '../lib/savedLocations'

export type GeolocationStatus =
  | 'idle'
  | 'prompting'
  | 'locating'
  | 'granted'
  | 'denied'
  | 'unavailable'
  | 'error'

export type GeoPosition = {
  lat: number
  lng: number
  accuracy: number | null
}

async function queryPermissionState(): Promise<PermissionState | 'unknown'> {
  if (!navigator.permissions?.query) return 'unknown'
  try {
    const result = await navigator.permissions.query({
      name: 'geolocation' as PermissionName,
    })
    return result.state
  } catch {
    // Safari often rejects geolocation permission queries.
    return 'unknown'
  }
}

function readPosition(): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation unavailable'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? null,
        })
      },
      (err) => {
        reject(err)
      },
      {
        enableHighAccuracy: true,
        timeout: 12_000,
        maximumAge: 30_000,
      },
    )
  })
}

/**
 * Permission only after explicit first use. Auto-locate later only if already
 * granted (Safari-safe when Permissions API is unavailable — then rely on
 * prior local intent + a soft attempt).
 */
export function useGeolocation(options?: { autoLocateOnMount?: boolean }) {
  const [status, setStatus] = useState<GeolocationStatus>('idle')
  const [position, setPosition] = useState<GeoPosition | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const attemptedAuto = useRef(false)

  const locate = useCallback(async (explicit: boolean) => {
    if (!navigator.geolocation) {
      setStatus('unavailable')
      setErrorMessage('Location is not available on this device.')
      return null
    }

    if (explicit) {
      markGpsIntent()
      setStatus('prompting')
    } else {
      setStatus('locating')
    }
    setErrorMessage(null)

    try {
      const pos = await readPosition()
      setPosition(pos)
      setStatus('granted')
      return pos
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? (err as GeolocationPositionError).code
          : null
      if (code === 1) {
        setStatus('denied')
        setErrorMessage('Location permission denied.')
      } else if (code === 2) {
        setStatus('unavailable')
        setErrorMessage('Location unavailable.')
      } else {
        setStatus('error')
        setErrorMessage('Could not get your location.')
      }
      return null
    }
  }, [])

  useEffect(() => {
    if (!options?.autoLocateOnMount || attemptedAuto.current) return
    attemptedAuto.current = true

    void (async () => {
      if (!hasGpsIntent()) return
      const perm = await queryPermissionState()
      if (perm === 'granted') {
        await locate(false)
      } else if (perm === 'unknown' && hasGpsIntent()) {
        // Safari-safe: Permissions API unavailable; only soft-attempt if user
        // previously used GPS (may still prompt on some browsers — acceptable).
        await locate(false)
      }
    })()
  }, [options?.autoLocateOnMount, locate])

  return {
    status,
    position,
    errorMessage,
    locate: () => locate(true),
  }
}
