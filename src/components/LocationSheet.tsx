import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Loader2,
  MapPin,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react'
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

const DEBOUNCE_MS = 280

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
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sessionRef = useRef(createSessionToken())
  const inputRef = useRef<HTMLInputElement>(null)

  const apiKey = getPlacesApiKey()

  useEffect(() => {
    if (!open) return
    // Focus immediately so virtual keyboard opens directly on iOS/mobile
    inputRef.current?.focus({ preventScroll: true })
    const timer = setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true })
    }, 30)
    return () => clearTimeout(timer)
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
    if (!open || !query.trim()) return
    const timer = setTimeout(() => {
      void fetchSuggestions(query)
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
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

  const displayedSuggestions = query.trim() ? suggestions : []

  return (
    <ModalSheet open={open} hideHeader={true} fullscreen={true} onClose={onClose} variant="bottom">
      <div className="space-y-2 pb-2">
        {/* iOS-styled Pill Search Bar without outline */}
        <label className="relative block pt-1">
          <span className="sr-only">Search address</span>
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search address"
            disabled={!apiKey}
            autoFocus
            className="tap-target h-[42px] w-full min-w-0 max-w-full rounded-[21px] bg-[#EBECEE] py-2.5 pl-10 pr-10 text-base font-normal text-slate-900 placeholder:text-slate-400 border-0 outline-none focus:outline-none focus:ring-0 focus:border-0 caret-brand transition-colors"
            autoComplete="off"
          />
          {query ? (
            <button
              type="button"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:text-slate-600"
              aria-label="Clear search"
              onClick={() => {
                setQuery('')
                setSuggestions([])
              }}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </label>

        {!apiKey && (
          <p className="px-1 text-xs font-semibold text-status-unclear">
            Configure <code>VITE_GOOGLE_MAPS_API_KEY</code> to enable address autocomplete.
          </p>
        )}

        {loading && (
          <div className="flex items-center gap-2 px-2 py-2 text-xs font-semibold text-slate-500" role="status">
            <Loader2 className="h-4 w-4 animate-spin text-brand" />
            <span>Searching Toronto places…</span>
          </div>
        )}

        {error && (
          <p className="px-2 text-xs font-semibold text-status-restricted" role="alert">
            {error}
          </p>
        )}

        {/* Search Results */}
        {displayedSuggestions.length > 0 && (
          <section className="pt-1">
            <h3 className="mb-1 px-1 text-sm font-semibold text-slate-500">
              Results
            </h3>
            <ul className="divide-y divide-slate-100">
              {displayedSuggestions.map((s) => (
                <li key={s.placeId}>
                  <button
                    type="button"
                    className="tap-target flex w-full items-center gap-3 py-3 text-left hover:bg-slate-50 active:bg-slate-100 transition"
                    onClick={() => void pickSuggestion(s)}
                  >
                    <MapPin className="h-5 w-5 shrink-0 text-brand" />
                    <span className="text-sm font-normal text-slate-900">{s.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Favorites */}
        {favorites.length > 0 && (
          <section className="pt-1">
            <h3 className="mb-1 px-1 text-sm font-semibold text-slate-500">
              Favorites
            </h3>
            <ul className="divide-y divide-slate-100">
              {favorites.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center gap-2 py-1 hover:bg-slate-50 transition"
                >
                  <button
                    type="button"
                    className="tap-target flex min-w-0 flex-1 items-center gap-3 py-2 text-left"
                    onClick={() => pickSaved(f)}
                  >
                    <Star className="h-5 w-5 shrink-0 fill-amber-400 text-amber-400" />
                    <span className="truncate text-sm font-normal text-slate-900">{f.label}</span>
                  </button>
                  <button
                    type="button"
                    className="tap-target p-2 text-slate-400 hover:text-red-500"
                    aria-label={`Remove favorite ${f.label}`}
                    onClick={() => onRemoveFavorite(f.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Recents */}
        <section className="pt-1">
          <div className="flex items-center justify-between px-1 py-1.5">
            <h3 className="text-sm font-semibold text-slate-500">
              Recent
            </h3>
            {recents.length > 0 ? (
              <button
                type="button"
                className="text-sm font-normal text-brand hover:opacity-80 cursor-pointer"
                onClick={onClearRecents}
              >
                Clear history
              </button>
            ) : null}
          </div>
          {recents.length === 0 ? (
            <p className="px-1 py-2 text-xs text-slate-400">No recent locations yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recents.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 py-1 hover:bg-slate-50 transition"
                >
                  <button
                    type="button"
                    className="tap-target flex min-w-0 flex-1 items-center py-2 text-left"
                    onClick={() => pickSaved(r)}
                  >
                    <span className="truncate text-sm font-normal text-slate-900">{r.label}</span>
                  </button>
                  <div className="flex shrink-0 items-center">
                    <button
                      type="button"
                      className="tap-target p-2 text-slate-400 hover:text-amber-500"
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
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-300'
                        }`}
                      />
                    </button>
                    <button
                      type="button"
                      className="tap-target p-2 text-slate-400 hover:text-red-500"
                      aria-label={`Remove ${r.label} from recent`}
                      onClick={() => onRemoveRecent(r.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </ModalSheet>
  )
}
