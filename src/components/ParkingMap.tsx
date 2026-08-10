import { useEffect, useRef, useState } from 'react'
import maplibregl, { type MapLayerMouseEvent } from 'maplibre-gl'
import { BASE_MAP_STYLE_URL } from '../lib/basemap'
import {
  CURB_ZOOM_MIN,
  lineColorExpression,
  lineOpacityExpression,
  lineSortKeyExpression,
  lineWidthExpression,
} from '../lib/mapStyle'
import type { Slot } from '../lib/schedule'
import {
  enrichFeaturesSubset,
  ParkingSpatialIndex,
  type BBox,
} from '../lib/spatialIndex'
import type { ParkingFeatureCollection } from '../types/parking'
import {
  PARKING_HIGHLIGHT_LAYER_ID,
  PARKING_LAYER_ID,
  PARKING_SOURCE_ID,
} from '../types/parking'
import './ParkingMap.css'

const GEOJSON_URL = '/data/final_parking_map.geojson'
const TORONTO_CENTER: [number, number] = [-79.38, 43.65]
const EMPTY: ParkingFeatureCollection = {
  type: 'FeatureCollection',
  features: [],
}
const HIDDEN_FILTER: maplibregl.FilterSpecification = ['==', 1, 0]
const VIEWPORT_PAD_DEG = 0.01

export interface ParkingMapHandle {
  getMap: () => maplibregl.Map | null
  getIndex: () => ParkingSpatialIndex | null
  clearHighlight: () => void
  setHighlightKeys: (keys: string[]) => void
  flyTo: (lng: number, lat: number, zoom?: number) => Promise<void>
  applyScheduleFilter: (
    slot: Slot,
    endMinuteOfDay: number | null,
    includeUnknown: boolean,
  ) => number | null
  refreshViewport: () => number | null
}

interface ParkingMapProps {
  onMapReady: (handle: ParkingMapHandle) => void
  onDataLoaded: (data: ParkingFeatureCollection) => void
  onPointSelected: (lngLat: [number, number]) => void
  onZoomChange?: (zoom: number, curbVisible: boolean) => void
}

function mapBoundsToBBox(map: maplibregl.Map): BBox {
  const b = map.getBounds()
  return {
    minLng: b.getWest(),
    minLat: b.getSouth(),
    maxLng: b.getEast(),
    maxLat: b.getNorth(),
  }
}

function addParkingLayers(map: maplibregl.Map) {
  map.addSource(PARKING_SOURCE_ID, {
    type: 'geojson',
    data: EMPTY,
    generateId: true,
  })

  map.addLayer({
    id: PARKING_LAYER_ID,
    type: 'line',
    source: PARKING_SOURCE_ID,
    minzoom: CURB_ZOOM_MIN,
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
      'line-sort-key': lineSortKeyExpression,
    },
    paint: {
      'line-color': lineColorExpression,
      'line-width': lineWidthExpression,
      'line-opacity': lineOpacityExpression,
    },
  })

  map.addLayer({
    id: PARKING_HIGHLIGHT_LAYER_ID,
    type: 'line',
    source: PARKING_SOURCE_ID,
    minzoom: CURB_ZOOM_MIN,
    filter: HIDDEN_FILTER,
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': '#0f172a',
      'line-width': 10,
      'line-opacity': 0.35,
      'line-blur': 0.5,
    },
  })
}

export function ParkingMap({
  onMapReady,
  onDataLoaded,
  onPointSelected,
  onZoomChange,
}: ParkingMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const indexRef = useRef<ParkingSpatialIndex | null>(null)
  const filterRef = useRef<{
    slot: Slot
    endMinuteOfDay: number | null
    includeUnknown: boolean
  } | null>(null)
  const highlightKeysRef = useRef<string[]>([])
  const hoveredIdRef = useRef<string | number | null>(null)
  const onMapReadyRef = useRef(onMapReady)
  const onDataLoadedRef = useRef(onDataLoaded)
  const onPointSelectedRef = useRef(onPointSelected)
  const onZoomChangeRef = useRef(onZoomChange)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  )
  const [loadError, setLoadError] = useState<string | null>(null)

  onMapReadyRef.current = onMapReady
  onDataLoadedRef.current = onDataLoaded
  onPointSelectedRef.current = onPointSelected
  onZoomChangeRef.current = onZoomChange

  useEffect(() => {
    if (!containerRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASE_MAP_STYLE_URL,
      center: TORONTO_CENTER,
      zoom: 12,
      maxBounds: [
        [-80.2, 43.4],
        [-78.8, 44.2],
      ],
      attributionControl: false,
    })

    mapRef.current = map

    const applyHighlightFilter = () => {
      if (!map.getLayer(PARKING_HIGHLIGHT_LAYER_ID)) return
      const keys = highlightKeysRef.current
      if (keys.length === 0) {
        map.setFilter(PARKING_HIGHLIGHT_LAYER_ID, HIDDEN_FILTER)
        return
      }
      map.setFilter(PARKING_HIGHLIGHT_LAYER_ID, [
        'in',
        ['get', '_featureKey'],
        ['literal', keys],
      ] as maplibregl.FilterSpecification)
    }

    const refreshViewport = (): number | null => {
      const index = indexRef.current
      const source = map.getSource(PARKING_SOURCE_ID) as
        | maplibregl.GeoJSONSource
        | undefined
      const filter = filterRef.current
      if (!index || !source || !filter) return null

      if (map.getZoom() < CURB_ZOOM_MIN) {
        source.setData(EMPTY)
        return 0
      }

      const subset = index.queryBBox(mapBoundsToBBox(map), VIEWPORT_PAD_DEG)
      const enriched = enrichFeaturesSubset(
        subset,
        filter.slot,
        filter.includeUnknown,
        filter.endMinuteOfDay,
      )
      source.setData(enriched)
      applyHighlightFilter()
      return enriched.features.length
    }

    const setHighlightKeys = (keys: string[]) => {
      highlightKeysRef.current = keys
      applyHighlightFilter()
    }

    const applyScheduleFilter = (
      slot: Slot,
      endMinuteOfDay: number | null,
      includeUnknown: boolean,
    ): number | null => {
      filterRef.current = { slot, endMinuteOfDay, includeUnknown }
      return refreshViewport()
    }

    const handle: ParkingMapHandle = {
      getMap: () => mapRef.current,
      getIndex: () => indexRef.current,
      clearHighlight: () => setHighlightKeys([]),
      setHighlightKeys,
      flyTo: (lng, lat, zoom = 17) =>
        new Promise((resolve) => {
          const onMoveEnd = () => {
            map.off('moveend', onMoveEnd)
            refreshViewport()
            resolve()
          }
          map.once('moveend', onMoveEnd)
          map.flyTo({ center: [lng, lat], zoom, duration: 800 })
        }),
      applyScheduleFilter,
      refreshViewport,
    }

    const emitZoom = () => {
      const zoom = map.getZoom()
      onZoomChangeRef.current?.(zoom, zoom >= CURB_ZOOM_MIN)
    }

    let cancelled = false

    map.on('load', async () => {
      try {
        const res = await fetch(GEOJSON_URL)
        if (!res.ok) {
          setLoadError(`HTTP ${res.status}`)
          setLoadState('error')
          return
        }
        const data = (await res.json()) as ParkingFeatureCollection
        if (cancelled || mapRef.current !== map) return
        indexRef.current = new ParkingSpatialIndex(data)
        addParkingLayers(map)
        setLoadError(null)
        setLoadState('ready')
        onDataLoadedRef.current(data)
        onMapReadyRef.current(handle)
        emitZoom()
        refreshViewport()
      } catch (err) {
        if (cancelled || mapRef.current !== map) return
        setLoadError(err instanceof Error ? err.message : 'Unknown error')
        setLoadState('error')
      }
    })

    map.on('moveend', () => {
      refreshViewport()
      emitZoom()
    })
    map.on('zoomend', emitZoom)

    map.on('mouseenter', PARKING_LAYER_ID, () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', PARKING_LAYER_ID, () => {
      map.getCanvas().style.cursor = ''
      if (hoveredIdRef.current != null) {
        map.setFeatureState(
          { source: PARKING_SOURCE_ID, id: hoveredIdRef.current },
          { hover: false },
        )
        hoveredIdRef.current = null
      }
    })

    map.on('mousemove', PARKING_LAYER_ID, (e: MapLayerMouseEvent) => {
      if (!e.features?.length) return
      const id = e.features[0].id
      if (id == null) return
      if (hoveredIdRef.current != null && hoveredIdRef.current !== id) {
        map.setFeatureState(
          { source: PARKING_SOURCE_ID, id: hoveredIdRef.current },
          { hover: false },
        )
      }
      hoveredIdRef.current = id
      map.setFeatureState({ source: PARKING_SOURCE_ID, id }, { hover: true })
    })

    map.on('click', (e) => {
      onPointSelectedRef.current([e.lngLat.lng, e.lngLat.lat])
    })

    return () => {
      cancelled = true
      map.remove()
      mapRef.current = null
      indexRef.current = null
    }
  }, [])

  return (
    <div className="parking-map-wrap">
      <div ref={containerRef} className="parking-map" />
      {loadState === 'loading' && (
        <div className="map-overlay map-overlay-loading" role="status">
          Loading curb rules…
        </div>
      )}
      {loadState === 'error' && (
        <div className="map-overlay map-overlay-error" role="alert">
          Could not load map data
          {loadError ? `: ${loadError}` : '.'} Ensure{' '}
          <code>public/data/final_parking_map.geojson</code> exists.
        </div>
      )}
    </div>
  )
}
