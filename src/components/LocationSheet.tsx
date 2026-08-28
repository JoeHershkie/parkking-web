import { useCallback, useEffect, useRef, useState } from 'react'
import { Clock3, MapPin, Search, Star, Trash2, X } from 'lucide-react'
import {
  autocompleteSuggestions,
  createSessionToken,
  getPlacesApiKey,
  placeDetails,
  type PlaceSuggestion,
} from '../lib/places'
import type { SavedLocation } from '../lib/savedLocations'
import { ModalSheet } from './ModalSheet'

export type PlacePick = {
  label: string
  lat: number
  lng: number
}

type LocationSheetProps = {
  open: boolean
  onClose: () => void
  onSelect: (place: PlacePick) => void
  recents: SavedLocation[]
  favorites: SavedLocation[]
  onRemoveRecent: (id: string) => void
  onClearRecents: () => void
  onToggleFavorite: (place: PlacePick) => void
  onRemoveFavorite: (id: string) => void
  isFavoriteId: (id: string) => boolean
}

const DEBOUNCE_MS = 300

export function LocationSheet({
  open,
  onClose,
  onSelect,
  recents,
  favorites,
  onRemoveRecent,
  onClearRecents,
  onToggleFavorite,
  onRemoveFavorite,
  isFavoriteId,
}: LocationSheetProps) {
  const apiKey = getPlacesApiKey()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sessionRef = useRef(createSessionToken())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setSuggestions([])
    setError(null)
    sessionRef.current = createSessionToken()
  }, [open])

  // Focus without scrolling the page — keeps the map stationary behind the sheet.
  useEffect(() => {
    if (!open) return
    const id = window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(id)
  }, [open])

  const fetchSuggestions = useCallback(
    async (value: string) => {
      if (!apiKey || !value.trim()) {
        setSuggestions([])
        return
      }
      setLoading(true)
      setError(null)
      try {
        const results = await autocompleteSuggestions(value, sessionRef.current)
        setSuggestions(results)
      } catch (e) {
        setSuggestions([])
        setError(e instanceof Error ? e.message : 'Autocomplete failed')
      } finally {
        setLoading(false)
      }
    },
    [apiKey],
  )

  useEffect(() => {
    if (!open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setSuggestions([])
      return
    }
    debounceRef.current = setTimeout(() => {
      void fetchSuggestions(query)
    }, DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, open, fetchSuggestions])

  const pickSaved = (loc: SavedLocation) => {
    onSelect({ label: loc.label, lat: loc.lat, lng: loc.lng })
    onClose()
  }

  const pickSuggestion = async (s: PlaceSuggestion) => {
    setLoading(true)
    setError(null)
    try {
      const details = await placeDetails(s.placeId, sessionRef.current)
      sessionRef.current = createSessionToken()
      onSelect({
        label: details.formattedAddress,
        lat: details.lat,
        lng: details.lng,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load place')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalSheet open={open} title="Location" onClose={onClose}>
      <div className="space-y-4 pb-2">
        <label className="relative block">
          <span className="sr-only">Search address</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
            aria-hidden
          />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              apiKey ? 'Search Toronto address…' : 'API key not configured'
            }
            disabled={!apiKey}
            className="tap-target w-full rounded-xl border border-border bg-surface-muted py-2.5 pl-10 pr-10 text-base text-ink placeholder:text-ink-subtle"
            autoComplete="off"
          />
          {query ? (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-ink-muted"
              aria-label="Clear search"
              onClick={() => setQuery('')}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </label>

        {!apiKey ? (
          <p className="text-sm text-status-unclear">
            Set <code className="text-xs">VITE_GOOGLE_MAPS_API_KEY</code> to
            enable address search.
          </p>
        ) : null}
        {loading ? (
          <p className="text-sm text-ink-muted" role="status">
            Searching…
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-status-restricted" role="alert">
            {error}
          </p>
        ) : null}

        {suggestions.length > 0 ? (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {suggestions.map((s) => (
              <li key={s.placeId}>
                <button
                  type="button"
                  className="tap-target flex w-full items-start gap-2 px-3 py-3 text-left text-sm hover:bg-surface-muted"
                  onClick={() => void pickSuggestion(s)}
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                  <span className="font-medium text-ink">{s.label}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {favorites.length > 0 ? (
          <section>
            <h3 className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-ink-muted">
              Favorites
            </h3>
            <ul className="space-y-1">
              {favorites.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center gap-1 rounded-xl border border-border"
                >
                  <button
                    type="button"
                    className="tap-target flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left text-sm"
                    onClick={() => pickSaved(f)}
                  >
                    <Star className="h-4 w-4 shrink-0 fill-brand text-brand" />
                    <span className="truncate font-medium">{f.label}</span>
                  </button>
                  <button
                    type="button"
                    className="tap-target px-3 text-ink-muted"
                    aria-label={`Remove favorite ${f.label}`}
                    onClick={() => onRemoveFavorite(f.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-ink-muted">
              Recent
            </h3>
            {recents.length > 0 ? (
              <button
                type="button"
                className="text-xs font-semibold text-ink-muted hover:text-ink"
                onClick={onClearRecents}
              >
                Clear history
              </button>
            ) : null}
          </div>
          {recents.length === 0 ? (
            <p className="text-sm text-ink-subtle">No recent locations yet.</p>
          ) : (
            <ul className="space-y-1">
              {recents.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-1 rounded-xl border border-border"
                >
                  <button
                    type="button"
                    className="tap-target flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left text-sm"
                    onClick={() => pickSaved(r)}
                  >
                    <Clock3 className="h-4 w-4 shrink-0 text-ink-subtle" />
                    <span className="truncate font-medium">{r.label}</span>
                  </button>
                  <button
                    type="button"
                    className="tap-target px-2 text-ink-muted"
                    aria-label={
                      isFavoriteId(r.id)
                        ? `Unfavorite ${r.label}`
                        : `Favorite ${r.label}`
                    }
                    onClick={() =>
                      onToggleFavorite({
                        label: r.label,
                        lat: r.lat,
                        lng: r.lng,
                      })
                    }
                  >
                    <Star
                      className={`h-4 w-4 ${
                        isFavoriteId(r.id)
                          ? 'fill-brand text-brand'
                          : 'text-ink-subtle'
                      }`}
                    />
                  </button>
                  <button
                    type="button"
                    className="tap-target px-3 text-ink-muted"
                    aria-label={`Remove ${r.label} from recent`}
                    onClick={() => onRemoveRecent(r.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </ModalSheet>
  )
}
