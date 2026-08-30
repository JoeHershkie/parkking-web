import { useEffect, useRef, useState } from 'react'
import maplibregl, { type MapLayerMouseEvent } from 'maplibre-gl'
import { BASE_MAP_STYLE_URL } from '../lib/basemap'
import { loadCachedGeoJSON } from '../lib/cache'
import {
  CURB_ZOOM_MIN,
  lineColorExpression,
  lineOpacityExpression,
  lineSortKeyExpression,
  lineWidthExpression,
  selectedBorderColor,
  selectedCasingOpacityExpression,
  selectedCasingWidthExpression,
  selectedLineOpacityExpression,
  selectedLineWidthExpression,
} from '../lib/mapStyle'
import type { Slot } from '../lib/schedule'
import {
  enrichFeaturesSubset,
  ParkingSpatialIndex,
  type BBox,
} from '../lib/spatialIndex'
import type { ParkingFeatureCollection } from '../types/parking'
import {
  PARKING_HIGHLIGHT_CASING_LAYER_ID,
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
  flyTo: (
    lng: number,
    lat: number,
    zoom?: number,
    options?: { offsetFraction?: number },
  ) => Promise<void>
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
  userPosition?: { lng: number; lat: number } | null
  searchPin?: { lng: number; lat: number; label?: string } | null
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

  // Base parking lines
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

  // Selected outline / casing (thin black outline, rendered under selected fill)
  map.addLayer({
    id: PARKING_HIGHLIGHT_CASING_LAYER_ID,
    type: 'line',
    source: PARKING_SOURCE_ID,
    minzoom: CURB_ZOOM_MIN,
    filter: HIDDEN_FILTER,
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': selectedBorderColor,
      'line-width': selectedCasingWidthExpression,
      'line-opacity': selectedCasingOpacityExpression,
    },
  })

  // Selected fill (verdict-colored stroke, rendered thicker than base line)
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
      'line-color': lineColorExpression,
      'line-width': selectedLineWidthExpression,
      'line-opacity': selectedLineOpacityExpression,
    },
  })
}

function createUserLocationElement(): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'user-location-marker'
  el.innerHTML = '<div class="user-location-halo"></div><div class="user-location-dot"></div>'
  return el
}

function createSearchPinElement(label?: string): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'apple-search-pin-marker'
  el.innerHTML = `
    <div class="apple-search-pin-balloon">
      <svg width="42" height="50" viewBox="0 0 42 50" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="applePinGrad" x1="21" y1="0" x2="21" y2="46" gradientUnits="userSpaceOnUse">
            <stop stop-color="#FF386B"/>
            <stop offset="1" stop-color="#E51950"/>
          </linearGradient>
        </defs>
        <path d="M21 1C10.5066 1 2 9.50659 2 20C2 28.5 12 38.5 20.1 46.2C20.6 46.7 21.4 46.7 21.9 46.2C30 38.5 40 28.5 40 20C40 9.50659 31.4934 1 21 1Z" fill="url(#applePinGrad)" stroke="#FFFFFF" stroke-width="2"/>
        <circle cx="21" cy="18" r="5.5" fill="white"/>
        <path d="M19.5 22L20.5 30H21.5L22.5 22H19.5Z" fill="white"/>
      </svg>
      <div class="apple-search-pin-ground-dot"></div>
    </div>
    ${label ? `<div class="apple-search-pin-label">${label}</div>` : ''}
  `
  return el
}

export function ParkingMap({
  onMapReady,
  onDataLoaded,
  onPointSelected,
  onZoomChange,
  userPosition,
  searchPin,
}: ParkingMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const userMarkerRef = useRef<maplibregl.Marker | null>(null)
  const searchPinMarkerRef = useRef<maplibregl.Marker | null>(null)
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
  const [loadingText, setLoadingText] = useState('Loading curb rules…')
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    onMapReadyRef.current = onMapReady
    onDataLoadedRef.current = onDataLoaded
    onPointSelectedRef.current = onPointSelected
    onZoomChangeRef.current = onZoomChange
  }, [onMapReady, onDataLoaded, onPointSelected, onZoomChange])

  // Sync user location marker (Apple Maps style blue dot)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (!userPosition) {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove()
        userMarkerRef.current = null
      }
      return
    }

    if (!userMarkerRef.current) {
      const el = createUserLocationElement()
      userMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([userPosition.lng, userPosition.lat])
        .addTo(map)
    } else {
      userMarkerRef.current.setLngLat([userPosition.lng, userPosition.lat])
    }
  }, [userPosition])

  // Sync searched location pin (Apple Maps pink balloon pin)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (!searchPin) {
      if (searchPinMarkerRef.current) {
        searchPinMarkerRef.current.remove()
        searchPinMarkerRef.current = null
      }
      return
    }

    if (searchPinMarkerRef.current) {
      searchPinMarkerRef.current.remove()
      searchPinMarkerRef.current = null
    }

    const el = createSearchPinElement(searchPin.label)
    searchPinMarkerRef.current = new maplibregl.Marker({
      element: el,
      anchor: 'bottom',
      offset: [0, 8],
    })
      .setLngLat([searchPin.lng, searchPin.lat])
      .addTo(map)
  }, [searchPin])

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

    const syncMapSize = () => {
      map.resize()
    }

    window.addEventListener('resize', syncMapSize)
    window.addEventListener('orientationchange', syncMapSize)

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => syncMapSize())
        : null
    if (containerRef.current) {
      resizeObserver?.observe(containerRef.current)
    }

    map.on('load', syncMapSize)
    map.once('idle', syncMapSize)

    const applyHighlightFilter = () => {
      const keys = highlightKeysRef.current
      const filter: maplibregl.FilterSpecification =
        keys.length === 0
          ? HIDDEN_FILTER
          : ([
              'in',
              ['get', '_featureKey'],
              ['literal', keys],
            ] as maplibregl.FilterSpecification)

      if (map.getLayer(PARKING_HIGHLIGHT_CASING_LAYER_ID)) {
        map.setFilter(PARKING_HIGHLIGHT_CASING_LAYER_ID, filter)
      }
      if (map.getLayer(PARKING_HIGHLIGHT_LAYER_ID)) {
        map.setFilter(PARKING_HIGHLIGHT_LAYER_ID, filter)
      }
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
      flyTo: (
        lng: number,
        lat: number,
        zoom = 17,
        options?: { offsetFraction?: number },
      ) =>
        new Promise((resolve) => {
          const onMoveEnd = () => {
            map.off('moveend', onMoveEnd)
            refreshViewport()
            resolve()
          }
          map.once('moveend', onMoveEnd)

          // Position target point at ~2/3 of viewport height (1/3 down from top)
          const fraction = options?.offsetFraction ?? 0.167
          const containerHeight =
            map.getContainer()?.clientHeight ||
            (typeof window !== 'undefined' ? window.innerHeight : 800)
          const offsetY = Math.round(containerHeight * fraction)

          map.flyTo({
            center: [lng, lat],
            zoom,
            offset: [0, -offsetY],
            duration: 800,
          })
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
        const data = await loadCachedGeoJSON(GEOJSON_URL, (msg) => setLoadingText(msg))
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

    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = 'pointer'
    }
    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = ''
      if (hoveredIdRef.current != null) {
        map.setFeatureState(
          { source: PARKING_SOURCE_ID, id: hoveredIdRef.current },
          { hover: false },
        )
        hoveredIdRef.current = null
      }
    }

    map.on('mouseenter', PARKING_LAYER_ID, handleMouseEnter)
    map.on('mouseleave', PARKING_LAYER_ID, handleMouseLeave)
    map.on('mouseenter', PARKING_HIGHLIGHT_LAYER_ID, handleMouseEnter)
    map.on('mouseleave', PARKING_HIGHLIGHT_LAYER_ID, handleMouseLeave)
    map.on('mouseenter', PARKING_HIGHLIGHT_CASING_LAYER_ID, handleMouseEnter)
    map.on('mouseleave', PARKING_HIGHLIGHT_CASING_LAYER_ID, handleMouseLeave)

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
      if (userMarkerRef.current) {
        userMarkerRef.current.remove()
        userMarkerRef.current = null
      }
      if (searchPinMarkerRef.current) {
        searchPinMarkerRef.current.remove()
        searchPinMarkerRef.current = null
      }
      window.removeEventListener('resize', syncMapSize)
      window.removeEventListener('orientationchange', syncMapSize)
      resizeObserver?.disconnect()
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
          {loadingText}
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
