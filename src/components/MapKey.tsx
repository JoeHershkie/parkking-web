import { LINE_COLORS } from '../lib/mapStyle'

type MapKeyProps = {
  visibleCount: number | null
}

export function MapKey({ visibleCount }: MapKeyProps) {
  return (
    <div className="pointer-events-none absolute bottom-[calc(var(--safe-bottom)+0.5rem)] left-0 z-10 safe-pad-x">
      <div className="pointer-events-auto max-w-[11rem] rounded-2xl border border-border bg-surface-elevated px-3 py-2 shadow-float backdrop-blur-md">
        <ul className="space-y-1 text-[11px] font-semibold text-ink">
          <li className="flex items-center gap-2">
            <span
              className="h-1.5 w-4 rounded-full"
              style={{ background: LINE_COLORS.allowed }}
            />
            Allowed
          </li>
          <li className="flex items-center gap-2">
            <span
              className="h-1.5 w-4 rounded-full"
              style={{ background: LINE_COLORS.restricted }}
            />
            Restricted
          </li>
          <li className="flex items-center gap-2">
            <span
              className="h-1.5 w-4 rounded-full"
              style={{ background: LINE_COLORS.ambiguous }}
            />
            Unclear
          </li>
        </ul>
        {visibleCount != null && (
          <p className="mt-1.5 text-[10px] font-medium text-ink-subtle">
            {visibleCount.toLocaleString()} nearby
          </p>
        )}
      </div>
    </div>
  )
}
