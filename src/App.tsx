import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LocationSheet, type PlacePick } from './components/LocationSheet'
import {
  ParkingMap,
  type ParkingMapHandle,
} from './components/ParkingMap'
import { TimeSheet } from './components/TimeSheet'
import { TopControls } from './components/TopControls'
import { VerdictSheet } from './components/VerdictSheet'
import { useGeolocation } from './hooks/useGeolocation'
import {
  selectNearestCurb,
  type CurbSideGroup,
} from './lib/curbSelection'
import { formatShortAddress, reverseGeocode } from './lib/places'
import {
  addFavorite,
  addRecent,
  clearRecents,
  isFavorite,
  loadFavorites,
  loadRecents,
  removeFavorite,
  removeRecent,
  type SavedLocation,
} from './lib/savedLocations'
import {
  composeCurbVerdictForQuery,
} from './lib/schedule'
import {
  createNowTimeQuery,
  formatTimeQueryChip,
  resolveTimeQuery,
  type TimeQuery,
} from './lib/timeQuery'

type SelectionState = {
  point: { lng: number; lat: number }
  label: string | null
  groups: CurbSideGroup[]
  selectedGroupKey: string | null
}

function App() {
  const mapHandleRef = useRef<ParkingMapHandle | null>(null)
  const geocodeSeqRef = useRef(0)
  const [dataReady, setDataReady] = useState(false)
  const [locationOpen, setLocationOpen] = useState(false)
  const [timeOpen, setTimeOpen] = useState(false)
  const [locationLabel, setLocationLabel] = useState('Search or tap the map')
  const [selection, setSelection] = useState<SelectionState | null>(null)
  const [timeQuery, setTimeQuery] = useState<TimeQuery>(() =>
    createNowTimeQuery(60, 60),
  )
  const [tick, setTick] = useState(0)
  const [recents, setRecents] = useState<SavedLocation[]>(() => loadRecents())
  const [favorites, setFavorites] = useState<SavedLocation[]>(() =>
    loadFavorites(),
  )
  const [sheetHeight, setSheetHeight] = useState(0)
  const [isSheetDragging, setIsSheetDragging] = useState(false)

  const handleSheetVisualHeightChange = useCallback(
    (height: number, isDragging: boolean) => {
      setSheetHeight(height)
      setIsSheetDragging(isDragging)
    },
    [],
  )

  const geo = useGeolocation({ autoLocateOnMount: true })

  const resolved = useMemo(
    () => resolveTimeQuery(timeQuery),
    // tick refreshes "now" mode
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timeQuery, tick],
  )

  const timeChip = useMemo(
    () => formatTimeQueryChip(timeQuery, resolved),
    [timeQuery, resolved],
  )

  useEffect(() => {
    if (timeQuery.mode !== 'now') return
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000)
    return () => window.clearInterval(id)
  }, [timeQuery.mode])

  const applyMapFilter = useCallback(() => {
    mapHandleRef.current?.applyScheduleFilter(
      resolved.slot,
      resolved.effectiveEndMinute,
      true,
    )
  }, [resolved])

  useEffect(() => {
    if (!dataReady) return
    applyMapFilter()
  }, [dataReady, applyMapFilter])

  const verdict = useMemo(() => {
    if (!selection) return null
    const { groups, selectedGroupKey } = selection
    const selected =
      (selectedGroupKey && groups.find((g) => g.groupKey === selectedGroupKey)) ||
      groups[0] ||
      null

    if (!selected) {
      return composeCurbVerdictForQuery([], resolved, {
        street: null,
        side: null,
        sideDisplay: null,
      })
    }

    return composeCurbVerdictForQuery(selected.features, resolved, {
      street: selected.street,
      side: selected.side,
      sideDisplay: selected.sideDisplay,
    })
  }, [selection, resolved])

  useEffect(() => {
    if (!selection) {
      mapHandleRef.current?.clearHighlight()
      return
    }
    const { groups, selectedGroupKey } = selection
    const selected =
      (selectedGroupKey && groups.find((g) => g.groupKey === selectedGroupKey)) ||
      groups[0] ||
      null
    if (selected) {
      mapHandleRef.current?.setHighlightKeys(selected.featureKeys)
    } else {
      mapHandleRef.current?.clearHighlight()
    }
  }, [selection])

  const selectAtPoint = useCallback(
    async (
      lng: number,
      lat: number,
      label: string | null,
      options?: { fly?: boolean; preferredGroupKey?: string | null },
    ) => {
      const handle = mapHandleRef.current
      const index = handle?.getIndex()
      if (!handle || !index) return

      const currentZoom = handle.getMap()?.getZoom() ?? 17
      const targetZoom = Math.max(currentZoom, 17)

      if (options?.fly !== false) {
        void handle.flyTo(lng, lat, targetZoom)
      }

      const result = selectNearestCurb(
        index.allFeatures(),
        { lng, lat },
        { preferredGroupKey: options?.preferredGroupKey },
      )

      const shortLabel = label ? formatShortAddress(label) : null
      const displayLabel =
        shortLabel ??
        result.selected?.street ??
        `${lat.toFixed(5)}°N, ${Math.abs(lng).toFixed(5)}°W`

      setLocationLabel(displayLabel)
      setSelection({
        point: { lng, lat },
        label: displayLabel,
        groups: result.groups,
        selectedGroupKey: result.selectedGroupKey,
      })

      if (label) {
        setRecents(addRecent({ label: displayLabel, lat, lng }))
      } else {
        // Asynchronously reverse geocode tapped location to resolve real street address
        const seq = ++geocodeSeqRef.current
        void reverseGeocode(lat, lng).then((resolvedAddress) => {
          if (geocodeSeqRef.current !== seq || !resolvedAddress) return
          setLocationLabel(resolvedAddress)
          setSelection((prev) =>
            prev &&
            Math.abs(prev.point.lat - lat) < 1e-6 &&
            Math.abs(prev.point.lng - lng) < 1e-6
              ? { ...prev, label: resolvedAddress }
              : prev,
          )
          setRecents(addRecent({ label: resolvedAddress, lat, lng }))
        })
      }
    },
    [],
  )

  const handleMapReady = useCallback((handle: ParkingMapHandle) => {
    mapHandleRef.current = handle
  }, [])

  const handleDataLoaded = useCallback(() => {
    setDataReady(true)
  }, [])

  const handlePointSelected = useCallback(
    (lngLat: [number, number]) => {
      void selectAtPoint(lngLat[0], lngLat[1], null, { fly: true })
    },
    [selectAtPoint],
  )

  const handlePlace = useCallback(
    (place: PlacePick) => {
      void selectAtPoint(place.lng, place.lat, place.label)
    },
    [selectAtPoint],
  )

  const handleLocate = useCallback(async () => {
    const pos = await geo.locate()
    if (!pos) return
    void selectAtPoint(pos.lng, pos.lat, 'Current location')
  }, [geo, selectAtPoint])

  const didAutoLocateRef = useRef(false)
  useEffect(() => {
    if (didAutoLocateRef.current || !dataReady) return
    if (geo.status !== 'granted' || !geo.position) return
    didAutoLocateRef.current = true
    void selectAtPoint(
      geo.position.lng,
      geo.position.lat,
      'Current location',
    )
  }, [dataReady, geo.status, geo.position, selectAtPoint])

  const handleSelectGroup = useCallback((groupKey: string) => {
    setSelection((prev) =>
      prev ? { ...prev, selectedGroupKey: groupKey } : prev,
    )
  }, [])

  const favoriteId = useCallback((place: PlacePick) => {
    return `${place.lat.toFixed(5)},${place.lng.toFixed(5)}|${place.label}`
  }, [])

  const isTrackingLocation = useMemo(() => {
    if (!geo.position) return false
    if (!selection) return true
    const dLat = Math.abs(selection.point.lat - geo.position.lat)
    const dLng = Math.abs(selection.point.lng - geo.position.lng)
    return dLat < 0.0004 && dLng < 0.0004
  }, [geo.position, selection])

  return (
    <div className="app-shell">
      <div className="absolute inset-0">
        <ParkingMap
          onMapReady={handleMapReady}
          onDataLoaded={handleDataLoaded}
          onPointSelected={handlePointSelected}
          userPosition={geo.position ? { lng: geo.position.lng, lat: geo.position.lat } : null}
          searchPin={
            selection
              ? {
                  lng: selection.point.lng,
                  lat: selection.point.lat,
                  label: selection.label ?? undefined,
                }
              : null
          }
        />
      </div>

      <TopControls
        locationLabel={locationLabel}
        timeLabel={timeChip}
        offsetY={selection != null ? sheetHeight : 0}
        isDragging={isSheetDragging}
        hasLocation={Boolean(geo.position || geo.status === 'granted')}
        isTrackingLocation={isTrackingLocation}
        onOpenLocation={() => setLocationOpen(true)}
        onOpenTime={() => setTimeOpen(true)}
        onLocate={() => void handleLocate()}
        locating={geo.status === 'prompting' || geo.status === 'locating'}
        disabled={!dataReady}
        errorMessage={geo.errorMessage ?? (geo.status === 'denied' ? 'Location permission denied.' : null)}
      />

      <VerdictSheet
        visible={selection != null}
        verdict={verdict}
        groups={selection?.groups ?? []}
        selectedGroupKey={selection?.selectedGroupKey ?? null}
        onSelectGroup={handleSelectGroup}
        onClose={() => {
          setSelection(null)
          setSheetHeight(0)
          setIsSheetDragging(false)
        }}
        onVisualHeightChange={handleSheetVisualHeightChange}
        resolved={resolved}
      />



      <LocationSheet
        open={locationOpen}
        onClose={() => setLocationOpen(false)}
        onSelect={handlePlace}
        recents={recents}
        favorites={favorites}
        onRemoveRecent={(id) => setRecents(removeRecent(id))}
        onClearRecents={() => setRecents(clearRecents())}
        onToggleFavorite={(place) => {
          const id = favoriteId(place)
          if (isFavorite(id)) {
            setFavorites(removeFavorite(id))
          } else {
            setFavorites(addFavorite(place))
          }
        }}
        onRemoveFavorite={(id) => setFavorites(removeFavorite(id))}
        isFavoriteId={(id) => isFavorite(id)}
      />

      <TimeSheet
        open={timeOpen}
        onClose={() => setTimeOpen(false)}
        query={timeQuery}
        onApply={setTimeQuery}
        midnightPreview={resolved.truncatedAtMidnight}
      />
    </div>
  )
}

export default App
