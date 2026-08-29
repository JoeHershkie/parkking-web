import { Clock, Loader2, MapPin, Navigation } from 'lucide-react'

type TopControlsProps = {
  locationLabel: string
  timeLabel: string
  locating?: boolean
  hasLocation?: boolean
  isTrackingLocation?: boolean
  disabled?: boolean
  errorMessage?: string | null
  offsetY?: number
  onOpenLocation: () => void
  onOpenTime: () => void
  onLocate: () => void
}

export function TopControls({
  locationLabel,
  timeLabel,
  locating,
  hasLocation = false,
  isTrackingLocation = false,
  disabled,
  errorMessage,
  offsetY = 0,
  onOpenLocation,
  onOpenTime,
  onLocate,
}: TopControlsProps) {
  return (
    <div
      style={{
        transform: offsetY > 0 ? `translateY(-${offsetY}px)` : 'translateY(0)',
      }}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center safe-pad-x safe-pad-bottom pb-3 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
    >
      <div className="pointer-events-auto flex w-full max-w-[var(--overlay-max)] flex-col gap-2">
        {/* Location Error Banner */}
        {errorMessage && (
          <div className="rounded-[14px] ios-glass border border-status-restricted/30 bg-status-restricted-soft/95 px-3.5 py-2 text-xs font-semibold text-status-restricted shadow-sm">
            {errorMessage}
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* Pill-shaped Location button */}
          <button
            type="button"
            disabled={disabled}
            onClick={onOpenLocation}
            className="tap-target flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-full ios-glass px-4 py-2 text-left disabled:opacity-50 transition active:scale-[0.98] cursor-pointer"
            aria-label="Location"
            aria-description={locationLabel}
          >
            <MapPin className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-900 leading-tight">
              {locationLabel}
            </span>
          </button>

          {/* Pill-shaped Time button */}
          <button
            type="button"
            disabled={disabled}
            onClick={onOpenTime}
            className="tap-target flex h-11 shrink-0 items-center gap-2 rounded-full ios-glass px-4 py-2 text-left disabled:opacity-50 transition active:scale-[0.98] cursor-pointer"
            aria-label="Time"
            aria-description={timeLabel}
          >
            <Clock className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            <span className="truncate text-xs font-bold text-slate-900 leading-tight">
              {timeLabel}
            </span>
          </button>

          {/* Circular GPS Button */}
          <button
            type="button"
            disabled={disabled || locating}
            onClick={onLocate}
            title={isTrackingLocation ? 'Tracking current location' : 'Use my location'}
            aria-label={isTrackingLocation ? 'Tracking current location' : 'Use my location'}
            className="tap-target flex h-11 w-11 shrink-0 items-center justify-center rounded-full ios-glass disabled:opacity-50 transition active:scale-[0.94] cursor-pointer"
          >
            {locating ? (
              <Loader2 className="h-5 w-5 animate-spin text-brand" aria-hidden />
            ) : isTrackingLocation ? (
              <Navigation className="h-4 w-4 fill-brand text-brand" aria-hidden />
            ) : hasLocation ? (
              <Navigation className="h-4 w-4 text-brand stroke-[2.25]" aria-hidden />
            ) : (
              <Navigation className="h-4 w-4 text-slate-500 stroke-[2.25]" aria-hidden />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
