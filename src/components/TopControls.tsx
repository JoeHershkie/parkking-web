import { Clock, LocateFixed, MapPin } from 'lucide-react'

type TopControlsProps = {
  locationLabel: string
  timeLabel: string
  locating?: boolean
  disabled?: boolean
  onOpenLocation: () => void
  onOpenTime: () => void
  onLocate: () => void
}

export function TopControls({
  locationLabel,
  timeLabel,
  locating,
  disabled,
  onOpenLocation,
  onOpenTime,
  onLocate,
}: TopControlsProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 safe-pad-top safe-pad-x">
      <div className="pointer-events-auto mx-auto flex max-w-[var(--overlay-max)] items-stretch gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={onOpenLocation}
          className="tap-target flex min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-control)] border border-border bg-surface-elevated px-3.5 py-2.5 text-left shadow-float backdrop-blur-md disabled:opacity-60"
        >
          <MapPin className="h-4 w-4 shrink-0 text-brand" aria-hidden />
          <span className="min-w-0">
            <span className="block text-[9px] font-extrabold uppercase tracking-wider leading-none text-ink-muted">
              Location
            </span>
            <span className="mt-0.5 block truncate text-xs font-extrabold text-ink">
              {locationLabel}
            </span>
          </span>
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={onOpenTime}
          className="tap-target flex shrink-0 items-center gap-2 rounded-[var(--radius-control)] border border-border bg-surface-elevated px-3 py-2.5 text-left shadow-float backdrop-blur-md disabled:opacity-60"
        >
          <Clock className="h-4 w-4 shrink-0 text-brand-ink" aria-hidden />
          <span className="min-w-0">
            <span className="block text-[9px] font-extrabold uppercase tracking-wider leading-none text-ink-muted">
              Time
            </span>
            <span className="mt-0.5 block truncate text-xs font-extrabold text-ink">
              {timeLabel}
            </span>
          </span>
        </button>

        <button
          type="button"
          disabled={disabled || locating}
          onClick={onLocate}
          title="Use my location"
          aria-label="Use my location"
          className="tap-target flex w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-border bg-surface-elevated text-brand shadow-float backdrop-blur-md disabled:opacity-60"
        >
          <LocateFixed
            className={`h-5 w-5 ${locating ? 'animate-pulse' : ''}`}
            aria-hidden
          />
        </button>
      </div>
    </div>
  )
}
