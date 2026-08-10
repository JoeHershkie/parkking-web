import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LocationSheet, type PlacePick } from './components/LocationSheet'
import { MapKey } from './components/MapKey'
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
  type CurbVerdict,
} from './lib/schedule'
import {
  createNowTimeQuery,
  formatTimeQueryChip,
  resolveTimeQuery,
  type TimeQuery,
} from './lib/timeQuery'
import type { ParkingFeatureCollection } from './types/parking'
// Mobile-first shell: full-screen map + floating chrome (no App.css document layout).

type SelectionState = {
  point: { lng: number; lat: number }
  label: string | null
  groups: CurbSideGroup[]
  selectedGroupKey: string | null
}

function App() {
  const mapHandleRef = useRef<ParkingMapHandle | null>(null)
  const [dataReady, setDataReady] = useState(false)
  const [visibleCount, setVisibleCount] = useState<number | null>(null)
  const [locationOpen, setLocationOpen] = useState(false)
  const [timeOpen, setTimeOpen] = useState(false)
  const [locationLabel, setLocationLabel] = useState('Search or tap the map')
  const [selection, setSelection] = useState<SelectionState | null>(null)
  const [verdict, setVerdict] = useState<CurbVerdict | null>(null)
  const [timeQuery, setTimeQuery] = useState<TimeQuery>(() =>
    createNowTimeQuery(60, 60),
  )
  const [tick, setTick] = useState(0)
  const [recents, setRecents] = useState<SavedLocation[]>(() => loadRecents())
  const [favorites, setFavorites] = useState<SavedLocation[]>(() =>
    loadFavorites(),
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
    const count = mapHandleRef.current?.applyScheduleFilter(
      resolved.slot,
      resolved.effectiveEndMinute,
      true,
    )
    if (count != null) setVisibleCount(count)
  }, [resolved])

  useEffect(() => {
    if (!dataReady) return
    applyMapFilter()
  }, [dataReady, applyMapFilter])

  const recomputeVerdict = useCallback(
    (groups: CurbSideGroup[], groupKey: string | null) => {
      const selected =
        (groupKey && groups.find((g) => g.groupKey === groupKey)) ||
        groups[0] ||
        null

      if (!selected) {
        setVerdict(
          composeCurbVerdictForQuery([], resolved, {
            street: null,
            side: null,
            sideDisplay: null,
          }),
        )
        mapHandleRef.current?.clearHighlight()
        return
      }

      const next = composeCurbVerdictForQuery(selected.features, resolved, {
        street: selected.street,
        side: selected.side,
        sideDisplay: selected.sideDisplay,
      })
      setVerdict(next)
      mapHandleRef.current?.setHighlightKeys(selected.featureKeys)
    },
    [resolved],
  )

  useEffect(() => {
    if (!selection) return
    recomputeVerdict(selection.groups, selection.selectedGroupKey)
  }, [selection, resolved, recomputeVerdict])

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

      if (options?.fly !== false) {
        await handle.flyTo(lng, lat, 17)
      }

      const result = selectNearestCurb(
        index.allFeatures(),
        { lng, lat },
        { preferredGroupKey: options?.preferredGroupKey },
      )

      const displayLabel =
        label ??
        result.selected?.street ??
        `${lat.toFixed(5)}°N, ${Math.abs(lng).toFixed(5)}°W`

      setLocationLabel(displayLabel)
      setSelection({
        point: { lng, lat },
        label,
        groups: result.groups,
        selectedGroupKey: result.selectedGroupKey,
      })

      if (label) {
        setRecents(addRecent({ label, lat, lng }))
      }
    },
    [],
  )

  const handleMapReady = useCallback((handle: ParkingMapHandle) => {
    mapHandleRef.current = handle
  }, [])

  const handleDataLoaded = useCallback((_data: ParkingFeatureCollection) => {
    setDataReady(true)
  }, [])

  const handlePointSelected = useCallback(
    (lngLat: [number, number]) => {
      void selectAtPoint(lngLat[0], lngLat[1], null, { fly: false })
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

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-slate-900">
      <div className="absolute inset-0">
        <ParkingMap
          onMapReady={handleMapReady}
          onDataLoaded={handleDataLoaded}
          onPointSelected={handlePointSelected}
        />
      </div>

      <TopControls
        locationLabel={locationLabel}
        timeLabel={timeChip}
        onOpenLocation={() => setLocationOpen(true)}
        onOpenTime={() => setTimeOpen(true)}
        onLocate={() => void handleLocate()}
        locating={geo.status === 'prompting' || geo.status === 'locating'}
        disabled={!dataReady}
      />

      {(geo.errorMessage || geo.status === 'denied') && (
        <div className="pointer-events-none absolute inset-x-0 top-[4.75rem] z-20 safe-pad-x">
          <p className="pointer-events-auto mx-auto max-w-[var(--overlay-max)] rounded-xl border border-status-restricted/30 bg-status-restricted-soft px-3 py-2 text-xs font-semibold text-status-restricted">
            {geo.errorMessage ?? 'Location permission denied.'}
          </p>
        </div>
      )}

      <MapKey visibleCount={visibleCount} />

      <VerdictSheet
        visible={selection != null}
        verdict={verdict}
        groups={selection?.groups ?? []}
        selectedGroupKey={selection?.selectedGroupKey ?? null}
        onSelectGroup={handleSelectGroup}
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
